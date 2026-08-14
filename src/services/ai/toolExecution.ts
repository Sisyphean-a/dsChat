import type { MessageAttachment, ProcessTimelineItem, ToolTraceRecord } from '../../types/chat'
import { ProviderStreamStoppedError } from './providerStream'
import type { ReplyStreamEvent } from './replyStreamEvents'
import { ToolFlowError, isToolFlowError, toToolFlowError } from './toolFlowErrors'
import { runWithAbortTimeout } from './toolTimeouts'
import {
  createPlannedToolTrace,
  createToolCallSignature,
  markToolTraceFailed,
  markToolTraceRunning,
  markToolTraceStopped,
  markToolTraceSucceeded,
  safeParseJson,
} from './toolTraceRuntime'
import { createToolTimelineItem } from './toolTimelineNarration'
import type { AiTool, NormalizedToolCall, ToolSettings } from './toolTypes'

export const TOOL_EXECUTION_TIMEOUT_MS = 20000
export const QWEN_IMAGE_TOOL_TIMEOUT_MS = 60000

export function getToolExecutionTimeoutMs(toolName: string): number {
  return toolName.startsWith('qwen_') ? QWEN_IMAGE_TOOL_TIMEOUT_MS : TOOL_EXECUTION_TIMEOUT_MS
}

export async function* executeToolCall(options: {
  attachments?: MessageAttachment[]
  call: NormalizedToolCall
  round: number
  settings: ToolSettings
  signal?: AbortSignal
  timeoutCode?: ToolFlowError['code']
  timeoutMessage?: string
  timeoutMs?: number
  tools: AiTool[]
}): AsyncGenerator<ReplyStreamEvent, string> {
  const args = parseToolArguments(options.call.argumentsJson)
  const tool = resolveToolByCallName(options.tools, options.call.name)
  let trace = createPlannedToolTrace(options.call, options.round, args)
  const timelineId = `tool-${options.round}-${options.call.id}`
  yield { type: 'tool-trace', trace }
  yield { type: 'timeline', item: createRunningTimeline(timelineId, options.round, options.call.name, args) }

  trace = markToolTraceRunning(trace, Date.now())
  yield { type: 'tool-trace', trace }
  yield { type: 'status', status: buildToolCallingStatusText(options.call.name, args) }

  try {
    const timeoutMs = options.timeoutMs ?? TOOL_EXECUTION_TIMEOUT_MS
    const timeoutCode = options.timeoutCode ?? 'tool_execute_timeout'
    const timeoutMessage = options.timeoutMessage ?? `工具调用超时（${options.call.name}，${timeoutMs}ms）。`
    const result = await runWithAbortTimeout({
      operation: (signal) => tool.execute(args, {
        attachments: options.attachments,
        settings: options.settings,
        signal,
      }),
      parentSignal: options.signal,
      timeoutCode,
      timeoutMessage,
      timeoutMs,
    })
    if (options.signal?.aborted) throw new ProviderStreamStoppedError()

    trace = markToolTraceSucceeded(trace, result.content, Date.now())
    yield { type: 'tool-trace', trace }
    yield { type: 'timeline', item: createCompletedTimeline(timelineId, options.round, options.call.name, args, trace, result.content) }
    return result.content
  } catch (error) {
    if (options.signal?.aborted || error instanceof ProviderStreamStoppedError) {
      trace = markToolTraceStopped(trace, Date.now())
      yield { type: 'tool-trace', trace }
      yield { type: 'timeline', item: createStoppedTimeline(timelineId, options.round, options.call.name, args) }
      throw new ProviderStreamStoppedError(error)
    }
    const typed = classifyToolError(error, options.call.name)
    trace = markToolTraceFailed(trace, typed.code, typed.message, Date.now())
    yield { type: 'tool-trace', trace }
    yield { type: 'timeline', item: createFailedTimeline(timelineId, options.round, options.call.name, args, trace, typed.message) }
    throw typed
  }
}

export function createToolBatchSignature(calls: NormalizedToolCall[]): string {
  return calls.map(createToolCallSignature).join('|')
}

function parseToolArguments(argumentsJson: string): unknown {
  const parsed = safeParseJson(argumentsJson)
  if (parsed === null) throw new ToolFlowError('tool_args_parse', `工具参数解析失败：${argumentsJson}`)
  return parsed
}

function resolveToolByCallName(tools: AiTool[], name: string): AiTool {
  const tool = tools.find((item) => item.definition.function.name === name)
  if (!tool) throw new ToolFlowError('tool_unknown', `未知工具：${name}`)
  return tool
}

function classifyToolError(error: unknown, toolName: string): ToolFlowError {
  return isToolFlowError(error) ? error : toToolFlowError(error, 'tool_execute_failure', `工具执行失败：${toolName}`)
}

function createRunningTimeline(id: string, round: number, toolName: string, toolArgs: unknown): ProcessTimelineItem {
  return createToolTimelineItem({ id, round, status: 'running', toolArgs, toolName })
}

function createCompletedTimeline(
  id: string,
  round: number,
  toolName: string,
  toolArgs: unknown,
  trace: ToolTraceRecord,
  content: string,
): ProcessTimelineItem {
  return createToolTimelineItem({ durationMs: trace.durationMs, id, resultContent: content, round, status: 'done', toolArgs, toolName })
}

function createStoppedTimeline(id: string, round: number, toolName: string, toolArgs: unknown): ProcessTimelineItem {
  return createToolTimelineItem({ id, round, status: 'stopped', toolArgs, toolName })
}

function createFailedTimeline(
  id: string,
  round: number,
  toolName: string,
  toolArgs: unknown,
  trace: ToolTraceRecord,
  errorMessage: string,
): ProcessTimelineItem {
  return createToolTimelineItem({ durationMs: trace.durationMs, errorMessage, id, round, status: 'error', toolArgs, toolName })
}

function buildToolCallingStatusText(toolName: string, args: unknown): string {
  if (toolName === 'tavily_search') {
    const query = typeof (args as { query?: unknown })?.query === 'string'
      ? (args as { query: string }).query.trim()
      : ''
    return query ? `正在调用联网搜索（关键词：${query.length > 42 ? `${query.slice(0, 42)}...` : query}）` : '正在调用联网搜索'
  }
  return toolName === 'get_current_time' ? '正在调用时间工具' : `正在调用工具 ${toolName}`
}
