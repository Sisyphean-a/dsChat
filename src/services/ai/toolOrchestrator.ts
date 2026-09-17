import type { ActiveProviderSettings, ThinkingLevel } from '../../types/chat'
import type { MessageMapping } from './messageMapping'
import type { ProviderConversationMessage } from './providerAdapter'
import { ProviderRequestError, type ProviderStream } from './providerStream'
import type { ReplyStreamEvent } from './replyStreamEvents'
import { ToolFlowError } from './toolFlowErrors'
import { executeToolCall } from './toolExecution'
import { createToolCallSignature } from './toolTraceRuntime'
import { createReasoningTimelineItem } from './toolTimelineNarration'
import type { AiTool, NormalizedToolCall, ToolExecutionContext } from './toolTypes'

const TOOL_STATUS_CONTINUING = '已获得工具结果，正在整理回答...'

export type { ReplyStreamEvent } from './replyStreamEvents'

export interface ToolOrchestratorRequest {
  messages: ProviderConversationMessage[]
  settings: ActiveProviderSettings
  signal?: AbortSignal
  thinkingLevel: ThinkingLevel
  /** 本回合可调用的工具，由回合计划解析。 */
  tools: AiTool[]
  /** 工具执行上下文：当前回合附件与工具设置。 */
  toolContext: ToolExecutionContext
}

export interface ToolOrchestrator {
  stream: (request: ToolOrchestratorRequest) => AsyncIterable<ReplyStreamEvent>
}

export interface ToolOrchestratorOptions {
  messageMapping: MessageMapping
  providerStream: ProviderStream
}

interface RoundOutcome {
  content: string
  reasoningContent: string
  toolCalls: NormalizedToolCall[]
}

export function createToolOrchestrator(options: ToolOrchestratorOptions): ToolOrchestrator {
  return {
    stream: (request) => streamToolReply(options, request),
  }
}

async function* streamToolReply(
  options: ToolOrchestratorOptions,
  request: ToolOrchestratorRequest,
): AsyncGenerator<ReplyStreamEvent> {
  const context = request.messages.map(cloneConversationMessage)
  let previousCallSignatures = new Set<string>()
  let round = 1
  let usedTools = false

  while (true) {
    const outcome = yield* streamProviderRound(
      options.providerStream,
      context,
      request,
      round,
    )
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
      request.tools,
      request.toolContext,
      request.signal,
      outcome.toolCalls,
      round,
    )
    yield { type: 'status', status: TOOL_STATUS_CONTINUING }
    round += 1
  }
}

async function* streamProviderRound(
  providerStream: ProviderStream,
  messages: ProviderConversationMessage[],
  request: ToolOrchestratorRequest,
  round: number,
): AsyncGenerator<ReplyStreamEvent, RoundOutcome> {
  let content = ''
  let reasoningContent = ''
  let toolCalls: NormalizedToolCall[] = []
  for await (const event of providerStream.stream({
    messages,
    settings: request.settings,
    signal: request.signal,
    thinkingLevel: request.thinkingLevel,
    tools: request.tools.map((tool) => tool.definition),
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
  return { content, reasoningContent, toolCalls }
}

async function* executeBatch(
  mapping: MessageMapping,
  context: ProviderConversationMessage[],
  tools: AiTool[],
  toolContext: ToolExecutionContext,
  signal: AbortSignal | undefined,
  calls: NormalizedToolCall[],
  round: number,
): AsyncGenerator<ReplyStreamEvent> {
  for (const call of calls) {
    const result = yield* executeToolCall({
      call,
      context: toolContext,
      round,
      signal,
      tools,
    })
    context.push(mapping.createToolResultMessage(call.id, result))
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

function cloneConversationMessage(message: ProviderConversationMessage): ProviderConversationMessage {
  return {
    ...message,
    attachments: message.attachments?.map((attachment) => ({ ...attachment })),
    toolCalls: message.toolCalls?.map((call) => ({ ...call })),
  }
}
