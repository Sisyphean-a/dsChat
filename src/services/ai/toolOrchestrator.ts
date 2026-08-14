import type { ActiveProviderSettings, MessageAttachment, ThinkingLevel } from '../../types/chat'
import type { MessageMapping } from './messageMapping'
import type { ProviderConversationMessage } from './providerAdapter'
import { ProviderRequestError, type ProviderStream } from './providerStream'
import type { ReplyStreamEvent } from './replyStreamEvents'
import { ToolFlowError, toToolFlowError } from './toolFlowErrors'
import { executeToolCall, getToolExecutionTimeoutMs } from './toolExecution'
import { createToolCallSignature } from './toolTraceRuntime'
import { createReasoningTimelineItem } from './toolTimelineNarration'
import type { AiTool, NormalizedToolCall, ToolSettings } from './toolTypes'

const ORCHESTRATOR_TIMEOUT_MS = 150000
const PROVIDER_ROUND_TIMEOUT_MS = 45000
const TOOL_STATUS_CONTINUING = '已获得工具结果，正在整理回答...'

export type { ReplyStreamEvent } from './replyStreamEvents'

export interface ToolOrchestratorRequest {
  attachments?: MessageAttachment[]
  messages: ProviderConversationMessage[]
  settings: ActiveProviderSettings
  signal?: AbortSignal
  thinkingLevel: ThinkingLevel
  toolSettings: ToolSettings
}

export interface ToolOrchestrator {
  getEnabledTools?: (settings: ToolSettings) => AiTool[]
  stream: (request: ToolOrchestratorRequest) => AsyncIterable<ReplyStreamEvent>
}

export interface ToolOrchestratorOptions {
  getEnabledTools: (settings: ToolSettings) => AiTool[]
  messageMapping: MessageMapping
  providerStream: ProviderStream
}

export function getToolDefinitions(
  getEnabledTools: ToolOrchestratorOptions['getEnabledTools'],
  settings: ToolSettings,
  attachments: MessageAttachment[] = [],
): AiTool['definition'][] {
  return filterToolsForAttachments(
    resolveEnabledTools(getEnabledTools, structuredClone(settings)),
    attachments,
  ).map((tool) => tool.definition)
}

interface RoundOutcome {
  content: string
  reasoningContent: string
  toolCalls: NormalizedToolCall[]
}

export function createToolOrchestrator(options: ToolOrchestratorOptions): ToolOrchestrator {
  return {
    getEnabledTools: options.getEnabledTools,
    stream: (request) => streamToolReply(options, request),
  }
}

async function* streamToolReply(
  options: ToolOrchestratorOptions,
  request: ToolOrchestratorRequest,
): AsyncGenerator<ReplyStreamEvent> {
  const settings = structuredClone(request.toolSettings)
  const tools = filterToolsForAttachments(
    resolveEnabledTools(options.getEnabledTools, settings),
    request.attachments ?? [],
  )
  assertToolsAvailable(settings, tools)

  const context = request.messages.map(cloneConversationMessage)
  const startedAt = Date.now()
  let previousCallSignatures = new Set<string>()
  let round = 1
  let usedTools = false

  while (true) {
    const roundTimeoutMs = Math.min(PROVIDER_ROUND_TIMEOUT_MS, getRemainingTime(startedAt))
    const outcome = yield* streamProviderRound(
      options.providerStream,
      context,
      request,
      tools,
      round,
      roundTimeoutMs,
    )
    assertWithinTimeBudget(startedAt)
    if (!outcome.toolCalls.length) {
      if (usedTools && !outcome.content.trim()) {
        throw new ProviderRequestError('empty-result', `${request.settings.label} 未返回最终回答。`)
      }
      return
    }

    previousCallSignatures = assertNoRepeatedCalls(outcome.toolCalls, previousCallSignatures)
    usedTools = true
    context.push(options.messageMapping.createToolAssistantMessage(outcome))
    yield* executeBatch(
      options.messageMapping,
      context,
      tools,
      settings,
      request.signal,
      request.attachments,
      outcome.toolCalls,
      round,
      startedAt,
    )
    yield { type: 'status', status: TOOL_STATUS_CONTINUING }
    round += 1
  }
}

async function* streamProviderRound(
  providerStream: ProviderStream,
  messages: ProviderConversationMessage[],
  request: ToolOrchestratorRequest,
  tools: AiTool[],
  round: number,
  timeoutMs: number,
): AsyncGenerator<ReplyStreamEvent, RoundOutcome> {
  const timeout = createTimedSignal(request.signal, timeoutMs)
  let content = ''
  let reasoningContent = ''
  let toolCalls: NormalizedToolCall[] = []
  try {
    for await (const event of providerStream.stream({
      messages,
      settings: request.settings,
      signal: timeout.signal,
      thinkingLevel: request.thinkingLevel,
      tools: tools.map((tool) => tool.definition),
    })) {
      if (event.type === 'content') content += event.content
      if (event.type === 'reasoning') reasoningContent += event.content
      if (event.type === 'tool-calls') toolCalls = event.calls
      yield event
      if (event.type === 'reasoning') {
        const timeline = createReasoningTimelineItem({
          content: reasoningContent,
          id: `reasoning-${round}`,
          round,
        })
        if (timeline) yield { type: 'timeline', item: timeline }
      }
    }
  } catch (error) {
    if (timeout.timedOut()) {
      const orchestratorTimedOut = timeoutMs < PROVIDER_ROUND_TIMEOUT_MS
      throw new ToolFlowError(
        orchestratorTimedOut ? 'tool_orchestrator_timeout' : 'provider_round_timeout',
        orchestratorTimedOut
          ? `工具总流程超时（${ORCHESTRATOR_TIMEOUT_MS}ms）。`
          : `${request.settings.label} 模型请求超时（${PROVIDER_ROUND_TIMEOUT_MS}ms）。`,
        error,
      )
    }
    throw error
  } finally {
    timeout.clear()
  }
  return { content, reasoningContent, toolCalls }
}

async function* executeBatch(
  mapping: MessageMapping,
  context: ProviderConversationMessage[],
  tools: AiTool[],
  settings: ToolSettings,
  signal: AbortSignal | undefined,
  attachments: MessageAttachment[] | undefined,
  calls: NormalizedToolCall[],
  round: number,
  startedAt: number,
): AsyncGenerator<ReplyStreamEvent> {
  for (const call of calls) {
    const toolTimeoutMs = getToolExecutionTimeoutMs(call.name)
    const timeoutMs = Math.min(toolTimeoutMs, getRemainingTime(startedAt))
    const orchestratorTimedOut = timeoutMs < toolTimeoutMs
    const result = yield* executeToolCall({
      attachments,
      call,
      round,
      settings,
      signal,
      timeoutCode: orchestratorTimedOut ? 'tool_orchestrator_timeout' : 'tool_execute_timeout',
      timeoutMessage: orchestratorTimedOut
        ? `工具总流程超时（${ORCHESTRATOR_TIMEOUT_MS}ms）。`
        : `工具调用超时（${call.name}，${toolTimeoutMs}ms）。`,
      timeoutMs,
      tools,
    })
    context.push(mapping.createToolResultMessage(call.id, result))
  }
}

function filterToolsForAttachments(tools: AiTool[], attachments: MessageAttachment[]): AiTool[] {
  if (attachments.length) {
    return tools
  }

  return tools.filter((tool) => !tool.definition.function.name.startsWith('qwen_'))
}

function resolveEnabledTools(getTools: ToolOrchestratorOptions['getEnabledTools'], settings: ToolSettings): AiTool[] {
  try {
    return getTools(settings)
  } catch (error) {
    throw toToolFlowError(error, 'tool_config', '工具配置无效。')
  }
}

function assertNoRepeatedCalls(
  calls: NormalizedToolCall[],
  previous: Set<string>,
): Set<string> {
  const current = new Set(calls.map(createToolCallSignature))
  const repeated = [...current].find((signature) => previous.has(signature))
  if (repeated) {
    const call = calls.find((item) => createToolCallSignature(item) === repeated)
    throw new ToolFlowError('tool_duplicate_call', `检测到重复工具调用：${call?.name ?? ''}`)
  }
  return current
}

function assertToolsAvailable(settings: ToolSettings, tools: AiTool[]): void {
  if (!settings.enabled || !tools.length) {
    throw new ToolFlowError('tool_config', '请至少启用一个工具。')
  }
}

function assertWithinTimeBudget(startedAt: number): void {
  getRemainingTime(startedAt)
}

function getRemainingTime(startedAt: number): number {
  const remaining = ORCHESTRATOR_TIMEOUT_MS - (Date.now() - startedAt)
  if (remaining <= 0) {
    throw new ToolFlowError('tool_orchestrator_timeout', `工具总流程超时（${ORCHESTRATOR_TIMEOUT_MS}ms）。`)
  }
  return remaining
}

function cloneConversationMessage(message: ProviderConversationMessage): ProviderConversationMessage {
  return {
    ...message,
    attachments: message.attachments?.map((attachment) => ({ ...attachment })),
    toolCalls: message.toolCalls?.map((call) => ({ ...call })),
  }
}

function createTimedSignal(parent: AbortSignal | undefined, timeoutMs: number): {
  clear: () => void
  signal: AbortSignal
  timedOut: () => boolean
} {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onAbort = () => controller.abort()
  parent?.addEventListener('abort', onAbort, { once: true })
  if (parent?.aborted) controller.abort()
  return {
    clear: () => {
      clearTimeout(timer)
      parent?.removeEventListener('abort', onAbort)
    },
    signal: controller.signal,
    timedOut: () => timedOut,
  }
}
