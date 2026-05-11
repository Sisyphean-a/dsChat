import type {
  ActiveProviderSettings,
  ChatMessage,
  ProcessTimelineItem,
  ToolTraceRecord,
} from '../../types/chat'
import type { ChatRequestOptions, StreamDelta } from '../chatCompletion'
import { getEnabledTools } from '../tools/toolRegistry'
import { getProviderAdapter, type ProviderConversationMessage } from './providerAdapter'
import { ToolFlowError, isToolFlowError, toToolFlowError } from './toolFlowErrors'
import {
  type ProviderRoundResult,
  streamProviderRound,
  toProviderConversationMessages,
  toRuntimeToolSettings,
} from './toolOrchestratorCore'
import {
  cloneToolTraces,
  createPlannedToolTrace,
  createToolCallSignature,
  markToolTraceFailed,
  markToolTraceRunning,
  markToolTraceSucceeded,
  safeParseJson,
} from './toolTraceRuntime'
import {
  createReasoningTimelineItem,
  createToolTimelineItem,
} from './toolTimelineNarration'
import { runWithAbortTimeout } from './toolTimeouts'
import type { AiTool, NormalizedToolCall, ToolSettings } from './toolTypes'

const MAX_TOTAL_TOOL_CALLS = 12
const ORCHESTRATOR_TIMEOUT_MS = 150000
const PROVIDER_ROUND_TIMEOUT_MS = 45000
const TOOL_EXECUTION_TIMEOUT_MS = 20000
const TOOL_STATUS_CONTINUING = '已获得工具结果，正在整理回答...'

interface RuntimeState {
  timeline: ProcessTimelineItem[]
  timelineCounter: number
  previousCallSignature: string
  roundCount: number
  toolCallCount: number
  traces: ToolTraceRecord[]
}

export async function streamWithToolOrchestrator(
  messages: ChatMessage[],
  settings: ActiveProviderSettings,
  onDelta: (delta: StreamDelta) => void,
  signal?: AbortSignal,
  requestOptions?: ChatRequestOptions,
): Promise<string> {
  const runtimeSettings = toRuntimeToolSettings(requestOptions?.toolSettings)
  const adapter = getProviderAdapter(settings.provider)
  const tools = getEnabledTools(runtimeSettings)
  validateOrchestratorPreconditions(runtimeSettings, tools.length, adapter.supportsTools, settings.label)

  const contextMessages = toProviderConversationMessages(messages)
  const runtime = createRuntimeState()

  onDelta({ processTimeline: [], toolTraces: [] })

  return runToolLoop({
    contextMessages,
    onDelta,
    requestOptions,
    runtime,
    settings,
    signal,
    tools,
    runtimeSettings,
  })
}

async function runToolLoop(options: {
  contextMessages: ProviderConversationMessage[]
  onDelta: (delta: StreamDelta) => void
  requestOptions?: ChatRequestOptions
  runtime: RuntimeState
  settings: ActiveProviderSettings
  signal?: AbortSignal
  tools: AiTool[]
  runtimeSettings: ToolSettings
}): Promise<string> {
  const startedAtMs = Date.now()
  let aggregatedContent = ''
  const adapter = getProviderAdapter(options.settings.provider)

  while (true) {
    assertOrchestratorWithinTimeBudget(startedAtMs)
    const round = await executeProviderRound({
      adapter,
      contextMessages: options.contextMessages,
      onDelta: options.onDelta,
      requestOptions: options.requestOptions,
      settings: options.settings,
      signal: options.signal,
      tools: options.tools,
    })

    if (round.content) {
      aggregatedContent += round.content
    }
    appendReasoningTimeline(round, options.runtime)
    emitRuntimeState(options.onDelta, options.runtime)

    if (!round.toolCalls.length) {
      return finalizeRoundContent(round, aggregatedContent, options.settings.label)
    }

    options.runtime.roundCount += 1
    assertToolRoundBudget(options.runtime, options.runtimeSettings.maxToolRounds, round.toolCalls.length)
    options.contextMessages.push(createAssistantToolMessage(round))

    await executeRoundToolCalls({
      contextMessages: options.contextMessages,
      onDelta: options.onDelta,
      round: options.runtime.roundCount,
      runtime: options.runtime,
      settings: options.runtimeSettings,
      signal: options.signal,
      toolCalls: round.toolCalls,
      tools: options.tools,
    })
    options.onDelta({
      streamingStatus: TOOL_STATUS_CONTINUING,
      processTimeline: cloneProcessTimeline(options.runtime.timeline),
      toolTraces: cloneToolTraces(options.runtime.traces),
    })
  }
}

async function executeProviderRound(options: {
  adapter: ReturnType<typeof getProviderAdapter>
  contextMessages: ProviderConversationMessage[]
  settings: ActiveProviderSettings
  onDelta: (delta: StreamDelta) => void
  signal?: AbortSignal
  requestOptions?: ChatRequestOptions
  tools: AiTool[]
}): Promise<ProviderRoundResult> {
  try {
    return await runWithAbortTimeout({
      operation: (roundSignal) => streamProviderRound({
        ...options,
        signal: roundSignal,
      }),
      parentSignal: options.signal,
      timeoutCode: 'provider_round_timeout',
      timeoutMessage: `${options.settings.label} 模型请求超时（${PROVIDER_ROUND_TIMEOUT_MS}ms）。`,
      timeoutMs: PROVIDER_ROUND_TIMEOUT_MS,
    })
  } catch (error) {
    if (isToolFlowError(error)) {
      throw error
    }

    throw toToolFlowError(error, 'provider_round_failure', `${options.settings.label} 工具轮次请求失败。`)
  }
}

async function executeRoundToolCalls(options: {
  contextMessages: ProviderConversationMessage[]
  onDelta: (delta: StreamDelta) => void
  round: number
  runtime: RuntimeState
  settings: ToolSettings
  signal?: AbortSignal
  toolCalls: NormalizedToolCall[]
  tools: AiTool[]
}): Promise<void> {
  for (const call of options.toolCalls) {
    await executeSingleToolCall({ ...options, call })
  }
}

async function executeSingleToolCall(options: {
  contextMessages: ProviderConversationMessage[]
  onDelta: (delta: StreamDelta) => void
  runtime: RuntimeState
  settings: ToolSettings
  signal?: AbortSignal
  call: NormalizedToolCall
  tools: AiTool[]
  round: number
}): Promise<void> {
  const traceIndex = appendPlannedToolTrace(options.call, options.onDelta, options.round, options.runtime)
  let parsedToolArgs: unknown = undefined
  const timelineIndex = appendRunningToolTimeline(options.call.name, options.round, options.runtime, parsedToolArgs)
  const traceStartAt = Date.now()

  try {
    const args = parseToolArguments(options.call.argumentsJson)
    parsedToolArgs = args
    options.runtime.timeline[timelineIndex] = createToolTimelineItem({
      id: options.runtime.timeline[timelineIndex].id,
      round: options.round,
      status: 'running',
      toolName: options.call.name,
      toolArgs: parsedToolArgs,
    })
    assertToolCallIsNotDuplicated(options.call, options.runtime)
    options.runtime.toolCallCount += 1

    const tool = resolveToolByCallName(options.tools, options.call.name)
    emitToolCallStatus(options.onDelta, options.call.name, args)
    options.runtime.traces[traceIndex] = markToolTraceRunning(options.runtime.traces[traceIndex], traceStartAt)
    emitRuntimeState(options.onDelta, options.runtime)
    await waitForStatusRender()

    const result = await runWithAbortTimeout({
      operation: (toolSignal) => tool.execute(args, { settings: options.settings, signal: toolSignal }),
      parentSignal: options.signal,
      timeoutCode: 'tool_execute_timeout',
      timeoutMessage: `工具调用超时（${options.call.name}，${TOOL_EXECUTION_TIMEOUT_MS}ms）。`,
      timeoutMs: TOOL_EXECUTION_TIMEOUT_MS,
    })

    options.runtime.traces[traceIndex] = markToolTraceSucceeded(options.runtime.traces[traceIndex], result.content, Date.now())
    options.runtime.timeline[timelineIndex] = createToolTimelineItem({
      id: options.runtime.timeline[timelineIndex].id,
      round: options.round,
      status: 'done',
      toolName: options.call.name,
      toolArgs: parsedToolArgs,
      durationMs: options.runtime.traces[traceIndex].durationMs,
      resultContent: result.content,
    })
    emitRuntimeState(options.onDelta, options.runtime)
    options.contextMessages.push({ role: 'tool', content: result.content, toolCallId: options.call.id })
  } catch (error) {
    const typed = classifyToolCallError(error, options.call.name)
    options.runtime.traces[traceIndex] = markToolTraceFailed(
      options.runtime.traces[traceIndex],
      typed.code,
      typed.message,
      Date.now(),
    )
    options.runtime.timeline[timelineIndex] = createToolTimelineItem({
      id: options.runtime.timeline[timelineIndex].id,
      round: options.round,
      status: 'error',
      toolName: options.call.name,
      toolArgs: parsedToolArgs,
      durationMs: options.runtime.traces[traceIndex].durationMs,
      errorMessage: typed.message,
    })
    emitRuntimeState(options.onDelta, options.runtime)
    throw typed
  }
}

function validateOrchestratorPreconditions(
  settings: ToolSettings,
  enabledToolsCount: number,
  supportsTools: boolean,
  label: string,
): void {
  if (!settings.enabled) {
    throw new ToolFlowError('tool_config', '工具调用未启用。')
  }
  if (!supportsTools) {
    throw new ToolFlowError('tool_protocol', `${label} 当前配置暂不支持工具调用。`)
  }
  if (!enabledToolsCount) {
    throw new ToolFlowError('tool_config', '请至少启用一个工具。')
  }
}

function createRuntimeState(): RuntimeState {
  return {
    timeline: [],
    timelineCounter: 0,
    previousCallSignature: '',
    roundCount: 0,
    toolCallCount: 0,
    traces: [],
  }
}

function assertOrchestratorWithinTimeBudget(startedAtMs: number): void {
  if (Date.now() - startedAtMs > ORCHESTRATOR_TIMEOUT_MS) {
    throw new ToolFlowError('tool_orchestrator_timeout', `工具总流程超时（${ORCHESTRATOR_TIMEOUT_MS}ms）。`)
  }
}

function finalizeRoundContent(round: ProviderRoundResult, aggregated: string, providerLabel: string): string {
  const finalContent = round.content.trim() ? round.content : aggregated
  if (!finalContent.trim()) {
    throw new ToolFlowError('provider_round_failure', `${providerLabel} 未返回可用内容。`)
  }

  return finalContent
}

function assertToolRoundBudget(state: RuntimeState, maxRoundCount: number, roundCallCount: number): void {
  if (state.roundCount > maxRoundCount) {
    throw new ToolFlowError('tool_round_limit', `工具调用轮数超过上限：${maxRoundCount}`)
  }
  if (state.toolCallCount + roundCallCount > MAX_TOTAL_TOOL_CALLS) {
    throw new ToolFlowError('tool_round_limit', `工具调用次数超过上限：${MAX_TOTAL_TOOL_CALLS}`)
  }
}

function createAssistantToolMessage(round: ProviderRoundResult): ProviderConversationMessage {
  return {
    role: 'assistant',
    content: '',
    reasoningContent: round.reasoningContent,
    toolCalls: round.toolCalls,
  }
}

function appendPlannedToolTrace(
  call: NormalizedToolCall,
  onDelta: (delta: StreamDelta) => void,
  round: number,
  runtime: RuntimeState,
): number {
  const parsedArgs = safeParseJson(call.argumentsJson) ?? { raw: call.argumentsJson.trim() }
  runtime.traces.push(createPlannedToolTrace(call, round, parsedArgs))
  emitRuntimeState(onDelta, runtime)
  return runtime.traces.length - 1
}

function assertToolCallIsNotDuplicated(call: NormalizedToolCall, state: RuntimeState): void {
  const signature = createToolCallSignature(call)
  if (signature === state.previousCallSignature) {
    throw new ToolFlowError('tool_duplicate_call', `检测到重复工具调用：${call.name}`)
  }

  state.previousCallSignature = signature
}

function resolveToolByCallName(tools: AiTool[], name: string): AiTool {
  const tool = tools.find((item) => item.definition.function.name === name)
  if (!tool) {
    throw new ToolFlowError('tool_unknown', `未知工具：${name}`)
  }

  return tool
}

function classifyToolCallError(error: unknown, toolName: string): ToolFlowError {
  if (isToolFlowError(error)) {
    return error
  }

  return toToolFlowError(error, 'tool_execute_failure', `工具执行失败：${toolName}`)
}

function parseToolArguments(argumentsJson: string): unknown {
  const parsed = safeParseJson(argumentsJson)
  if (parsed !== null) {
    return parsed
  }

  throw new ToolFlowError('tool_args_parse', `工具参数解析失败：${argumentsJson}`)
}

function emitToolCallStatus(
  onDelta: (delta: StreamDelta) => void,
  toolName: string,
  toolArgs: unknown,
): void {
  onDelta({
    streamingStatus: buildToolCallingStatusText(toolName, toolArgs),
  })
}

function buildToolCallingStatusText(toolName: string, toolArgs: unknown): string {
  const displayName = resolveToolDisplayName(toolName)
  const hint = resolveToolCallingHint(toolName, toolArgs)
  if (!hint) {
    return `正在调用${displayName}`
  }

  return `正在调用${displayName}（${hint}）`
}

function resolveToolDisplayName(toolName: string): string {
  if (toolName === 'tavily_search') {
    return '联网搜索'
  }

  if (toolName === 'get_current_time') {
    return '时间工具'
  }

  return `工具 ${toolName}`
}

function resolveToolCallingHint(toolName: string, toolArgs: unknown): string {
  if (toolName === 'tavily_search') {
    const query = typeof (toolArgs as { query?: unknown } | null)?.query === 'string'
      ? (toolArgs as { query: string }).query.trim()
      : ''
    if (!query) {
      return ''
    }

    return `关键词：${compactHint(query)}`
  }

  if (toolName === 'get_current_time') {
    const timezone = typeof (toolArgs as { timezone?: unknown } | null)?.timezone === 'string'
      ? (toolArgs as { timezone: string }).timezone.trim()
      : ''
    if (!timezone) {
      return ''
    }

    return `时区：${compactHint(timezone)}`
  }

  return ''
}

function compactHint(value: string): string {
  return value.length > 42 ? `${value.slice(0, 42)}...` : value
}

async function waitForStatusRender(): Promise<void> {
  await Promise.resolve()
}

function emitRuntimeState(onDelta: (delta: StreamDelta) => void, runtime: RuntimeState): void {
  onDelta({
    processTimeline: cloneProcessTimeline(runtime.timeline),
    toolTraces: cloneToolTraces(runtime.traces),
  })
}

function appendReasoningTimeline(round: ProviderRoundResult, runtime: RuntimeState): void {
  const nextRound = runtime.roundCount + 1
  const id = `reasoning-${nextRound}-${runtime.timelineCounter + 1}`
  const item = createReasoningTimelineItem({
    content: round.reasoningContent,
    id,
    round: nextRound,
  })
  if (!item) {
    return
  }

  runtime.timelineCounter += 1
  runtime.timeline.push(item)
}

function appendRunningToolTimeline(
  toolName: string,
  round: number,
  runtime: RuntimeState,
  toolArgs: unknown,
): number {
  runtime.timelineCounter += 1
  runtime.timeline.push(createToolTimelineItem({
    id: `tool-${round}-${runtime.timelineCounter}`,
    round,
    status: 'running',
    toolName,
    toolArgs,
  }))
  return runtime.timeline.length - 1
}

function cloneProcessTimeline(items: ProcessTimelineItem[]): ProcessTimelineItem[] {
  return items.map((item) => ({ ...item }))
}
