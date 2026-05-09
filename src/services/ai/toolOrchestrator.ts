import type { ActiveProviderSettings, ChatMessage, ToolSettings as ChatToolSettings } from '../../types/chat'
import type { ChatRequestOptions, StreamDelta } from '../chatCompletion'
import { getEnabledTools } from '../tools/toolRegistry'
import { createProviderFailureMessage } from './providerErrors'
import {
  createProviderStreamState,
  getProviderAdapter,
  type ProviderConversationMessage,
} from './providerAdapter'
import { consumeSseBuffer, extractEventPayload } from './sse'
import type { AiTool, NormalizedToolCall, ToolSettings } from './toolTypes'

const TOOL_STATUS_DECIDING = '正在判断是否需要调用工具...'
const TOOL_STATUS_CONTINUING = '已获得 Tavily 搜索结果，正在继续思考...'

interface ProviderRoundResult {
  content: string
  toolCalls: NormalizedToolCall[]
}

export async function streamWithToolOrchestrator(
  messages: ChatMessage[],
  settings: ActiveProviderSettings,
  onDelta: (delta: StreamDelta) => void,
  signal?: AbortSignal,
  requestOptions?: ChatRequestOptions,
): Promise<string> {
  const toolSettings = toRuntimeToolSettings(requestOptions?.toolSettings)
  if (!toolSettings.enabled) {
    throw new Error('工具调用未启用。')
  }

  const adapter = getProviderAdapter(settings.provider)
  if (!adapter.supportsTools) {
    throw new Error(`${settings.label} 当前配置暂不支持工具调用。`)
  }

  const tools = getEnabledTools(toolSettings)
  const contextMessages = toProviderConversationMessages(messages)
  let roundCount = 0

  onDelta({ streamingStatus: TOOL_STATUS_DECIDING })

  while (true) {
    const round = await streamProviderRound({
      adapter,
      contextMessages,
      settings,
      onDelta,
      signal,
      requestOptions: {
        ...requestOptions,
        toolSettings: requestOptions?.toolSettings,
      },
      tools,
    })

    if (!round.toolCalls.length) {
      if (!round.content.trim()) {
        throw new Error(`${settings.label} 未返回可用内容。`)
      }

      return round.content
    }

    roundCount += 1
    if (roundCount > toolSettings.maxToolRounds) {
      throw new Error(`工具调用轮数超过上限：${toolSettings.maxToolRounds}`)
    }

    const assistantToolMessage: ProviderConversationMessage = {
      role: 'assistant',
      content: '',
      toolCalls: round.toolCalls,
    }
    contextMessages.push(assistantToolMessage)

    for (const call of round.toolCalls) {
      const tool = tools.find((item) => item.definition.function.name === call.name)
      if (!tool) {
        throw new Error(`未知工具：${call.name}`)
      }

      const args = parseToolArguments(call.argumentsJson)
      const queryLabel = resolveToolQueryLabel(args)
      onDelta({
        streamingStatus: queryLabel
          ? `正在调用 ${call.name}：${queryLabel}`
          : `正在调用 ${call.name}`,
      })

      const result = await tool.execute(args, {
        settings: toolSettings,
        signal,
      })

      contextMessages.push({
        role: 'tool',
        content: result.content,
        toolCallId: call.id,
      })
    }

    onDelta({ streamingStatus: TOOL_STATUS_CONTINUING })
  }
}

async function streamProviderRound(options: {
  adapter: ReturnType<typeof getProviderAdapter>
  contextMessages: ProviderConversationMessage[]
  settings: ActiveProviderSettings
  onDelta: (delta: StreamDelta) => void
  signal?: AbortSignal
  requestOptions?: ChatRequestOptions
  tools: AiTool[]
}): Promise<ProviderRoundResult> {
  const {
    adapter,
    contextMessages,
    settings,
    onDelta,
    signal,
    requestOptions,
    tools,
  } = options

  const response = await fetch(adapter.createRequestUrl(settings.baseUrl), {
    method: 'POST',
    headers: createHeaders(settings),
    body: JSON.stringify(adapter.createPayload({
      messages: contextMessages,
      settings,
      stream: true,
      requestOptions,
      tools: tools.map((item) => item.definition),
    })),
    signal,
  })

  if (!response.ok) {
    throw new Error(await createProviderFailureMessage(settings.label, response))
  }

  if (!response.body) {
    throw new Error('当前环境不支持流式响应读取。')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const state = createProviderStreamState()
  let buffer = ''
  let content = ''
  let toolCalls: NormalizedToolCall[] = []

  while (true) {
    const chunk = await reader.read()
    if (chunk.done) {
      break
    }

    buffer += decoder.decode(chunk.value, { stream: true })
    const consumed = consumeSseBuffer(buffer)
    buffer = consumed.rest

    for (const event of consumed.events) {
      const deltas = adapter.parseSseEvent(event, state)
      const done = consumeProviderDeltas(deltas, onDelta, {
        content,
        toolCalls,
      })
      content = done.content
      toolCalls = done.toolCalls
      if (done.done) {
        return {
          content,
          toolCalls,
        }
      }
    }
  }

  const trailingEvent = extractEventPayload(buffer)
  if (trailingEvent) {
    const deltas = adapter.parseSseEvent(trailingEvent, state)
    const trailing = consumeProviderDeltas(deltas, onDelta, {
      content,
      toolCalls,
    })
    content = trailing.content
    toolCalls = trailing.toolCalls
  }

  return {
    content,
    toolCalls,
  }
}

function consumeProviderDeltas(
  deltas: ReturnType<ReturnType<typeof getProviderAdapter>['parseSseEvent']>,
  onDelta: (delta: StreamDelta) => void,
  current: { content: string; toolCalls: NormalizedToolCall[] },
): { content: string; done: boolean; toolCalls: NormalizedToolCall[] } {
  let content = current.content
  let done = false
  let toolCalls = current.toolCalls

  for (const delta of deltas) {
    if (delta.type === 'content_delta') {
      content += delta.content
      onDelta({ content: delta.content })
      continue
    }

    if (delta.type === 'reasoning_delta') {
      onDelta({ reasoningContent: delta.content })
      continue
    }

    if (delta.type === 'status') {
      onDelta({ streamingStatus: delta.status })
      continue
    }

    if (delta.type === 'tool_calls_done') {
      toolCalls = delta.calls
      continue
    }

    if (delta.type === 'done') {
      done = true
    }
  }

  return {
    content,
    done,
    toolCalls,
  }
}

function createHeaders(settings: ActiveProviderSettings): HeadersInit {
  return {
    Authorization: `Bearer ${settings.apiKey}`,
    'Content-Type': 'application/json',
  }
}

function toRuntimeToolSettings(settings: ChatToolSettings | undefined): ToolSettings {
  return {
    enabled: settings?.enabled ?? false,
    tavilyApiKey: settings?.tavilyApiKey ?? '',
    maxToolRounds: settings?.maxToolRounds ?? 3,
  }
}

function toProviderConversationMessages(messages: ChatMessage[]): ProviderConversationMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
    attachments: message.attachments?.map((item) => ({ ...item })),
  }))
}

function parseToolArguments(argumentsJson: string): unknown {
  try {
    return JSON.parse(argumentsJson)
  } catch {
    throw new Error(`工具参数解析失败：${argumentsJson}`)
  }
}

function resolveToolQueryLabel(args: unknown): string {
  if (typeof args !== 'object' || args === null) {
    return ''
  }

  const query = (args as { query?: unknown }).query
  return typeof query === 'string' ? query.trim() : ''
}
