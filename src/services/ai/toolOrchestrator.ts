import type { ActiveProviderSettings, ThinkingLevel } from '../../types/chat'
import type { MessageMapping } from './messageMapping'
import type { ProviderConversationMessage } from './providerAdapter'
import { ProviderRequestError, type ProviderStream } from './providerStream'
import type { ReplyStreamEvent } from './replyStreamEvents'
import { ToolFlowError, toToolFlowError } from './toolFlowErrors'
import { executeToolCall } from './toolExecution'
import { createToolCallSignature } from './toolTraceRuntime'
import { createReasoningTimelineItem } from './toolTimelineNarration'
import type { AiTool, NormalizedToolCall, ToolSettings } from './toolTypes'

const ORCHESTRATOR_TIMEOUT_MS = 150000
const PROVIDER_ROUND_TIMEOUT_MS = 45000
const TOOL_STATUS_CONTINUING = '已获得工具结果，正在整理回答...'

export type { ReplyStreamEvent } from './replyStreamEvents'

export interface ToolOrchestratorRequest {
  messages: ProviderConversationMessage[]
  settings: ActiveProviderSettings
  signal?: AbortSignal
  thinkingLevel: ThinkingLevel
  toolSettings: ToolSettings
}

export interface ToolOrchestrator {
  stream: (request: ToolOrchestratorRequest) => AsyncIterable<ReplyStreamEvent>
}

export interface ToolOrchestratorOptions {
  getEnabledTools: (settings: ToolSettings) => AiTool[]
  messageMapping: MessageMapping
  providerStream: ProviderStream
}

interface RoundOutcome {
  content: string
  reasoningContent: string
  toolCalls: NormalizedToolCall[]
}

export function createToolOrchestrator(options: ToolOrchestratorOptions): ToolOrchestrator {
  return { stream: (request) => streamToolReply(options, request) }
}

async function* streamToolReply(
  options: ToolOrchestratorOptions,
  request: ToolOrchestratorRequest,
): AsyncGenerator<ReplyStreamEvent> {
  const settings = structuredClone(request.toolSettings)
  const tools = resolveEnabledTools(options.getEnabledTools, settings)
  assertToolsAvailable(settings, tools)

  const context = request.messages.map(cloneConversationMessage)
  const startedAt = Date.now()
  let previousCallSignatures = new Set<string>()
  let round = 1
  let usedTools = false

  while (true) {
    assertWithinTimeBudget(startedAt)
    const outcome = yield* streamProviderRound(options.providerStream, context, request, tools, round)
    if (!outcome.toolCalls.length) {
      if (usedTools && !outcome.content.trim()) {
        throw new ProviderRequestError('empty-result', `${request.settings.label} 未返回最终回答。`)
      }
      return
    }

    previousCallSignatures = assertNoRepeatedCalls(outcome.toolCalls, previousCallSignatures)
    usedTools = true
    context.push(options.messageMapping.createToolAssistantMessage(outcome))
    yield* executeBatch(options.messageMapping, context, tools, settings, request.signal, outcome.toolCalls, round)
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
): AsyncGenerator<ReplyStreamEvent, RoundOutcome> {
  const timeout = createTimedSignal(request.signal, PROVIDER_ROUND_TIMEOUT_MS)
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
      throw new ToolFlowError('provider_round_timeout', `${request.settings.label} 模型请求超时（${PROVIDER_ROUND_TIMEOUT_MS}ms）。`, error)
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
  calls: NormalizedToolCall[],
  round: number,
): AsyncGenerator<ReplyStreamEvent> {
  for (const call of calls) {
    const result = yield* executeToolCall({ call, round, settings, signal, tools })
    context.push(mapping.createToolResultMessage(call.id, result))
  }
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
  if (Date.now() - startedAt > ORCHESTRATOR_TIMEOUT_MS) {
    throw new ToolFlowError('tool_orchestrator_timeout', `工具总流程超时（${ORCHESTRATOR_TIMEOUT_MS}ms）。`)
  }
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
