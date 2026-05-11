import type {
  ActiveProviderSettings,
  ChatMessage,
  ToolSettings as ChatToolSettings,
} from '../../types/chat'
import { DEFAULT_TAVILY_SEARCH_BASE_URL } from '../../constants/tools'
import type { ChatRequestOptions, StreamDelta } from '../chatCompletion'
import { createProviderFailureMessage } from './providerErrors'
import { createProviderStreamState, getProviderAdapter, type ProviderConversationMessage } from './providerAdapter'
import { consumeSseBuffer, extractEventPayload } from './sse'
import { ToolFlowError } from './toolFlowErrors'
import type { AiTool, NormalizedToolCall, ToolSettings } from './toolTypes'

export interface ProviderRoundResult {
  content: string
  reasoningContent: string
  toolCalls: NormalizedToolCall[]
}

export async function streamProviderRound(options: {
  adapter: ReturnType<typeof getProviderAdapter>
  contextMessages: ProviderConversationMessage[]
  settings: ActiveProviderSettings
  onDelta: (delta: StreamDelta) => void
  signal?: AbortSignal
  requestOptions?: ChatRequestOptions
  tools: AiTool[]
}): Promise<ProviderRoundResult> {
  const response = await fetch(options.adapter.createRequestUrl(options.settings.baseUrl), {
    method: 'POST',
    headers: createHeaders(options.settings),
    body: JSON.stringify(options.adapter.createPayload({
      messages: options.contextMessages,
      settings: options.settings,
      stream: true,
      requestOptions: options.requestOptions,
      tools: options.tools.map((item) => item.definition),
    })),
    signal: options.signal,
  })

  if (!response.ok) {
    throw new ToolFlowError(
      'provider_round_failure',
      await createProviderFailureMessage(options.settings.label, response),
    )
  }

  if (!response.body) {
    throw new ToolFlowError('provider_round_failure', '当前环境不支持流式响应读取。')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const state = createProviderStreamState()
  let buffer = ''
  let content = ''
  let reasoningContent = ''
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
      const done = consumeProviderDeltas(options.adapter.parseSseEvent(event, state), options.onDelta, {
        content,
        reasoningContent,
        toolCalls,
      })
      content = done.content
      reasoningContent = done.reasoningContent
      toolCalls = done.toolCalls
      if (done.done) {
        return { content, reasoningContent, toolCalls }
      }
    }
  }

  const trailingEvent = extractEventPayload(buffer)
  if (trailingEvent) {
    const trailing = consumeProviderDeltas(
      options.adapter.parseSseEvent(trailingEvent, state),
      options.onDelta,
      { content, reasoningContent, toolCalls },
    )
    content = trailing.content
    reasoningContent = trailing.reasoningContent
    toolCalls = trailing.toolCalls
  }

  return { content, reasoningContent, toolCalls }
}

export function toRuntimeToolSettings(settings: ChatToolSettings | undefined): ToolSettings {
  const legacy = settings as Partial<{ tavilyApiKey: string }> | undefined
  return {
    enabled: settings?.enabled ?? false,
    maxToolRounds: settings?.maxToolRounds ?? 6,
    builtinTools: {
      currentTime: { enabled: settings?.builtinTools?.currentTime?.enabled ?? true },
      tavilySearch: {
        enabled: settings?.builtinTools?.tavilySearch?.enabled ?? true,
        apiKey: settings?.builtinTools?.tavilySearch?.apiKey ?? legacy?.tavilyApiKey ?? '',
        baseUrl: resolveTavilySearchBaseUrl(settings?.builtinTools?.tavilySearch?.baseUrl),
      },
    },
    customTools: settings?.customTools?.map((item) => ({
      ...item,
      headers: item.headers.map((header) => ({ ...header })),
    })) ?? [],
  }
}

export function toProviderConversationMessages(messages: ChatMessage[]): ProviderConversationMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
    reasoningContent: message.reasoningContent,
    attachments: message.attachments?.map((item) => ({ ...item })),
  }))
}

function resolveTavilySearchBaseUrl(value: string | undefined): string {
  const normalized = value?.trim() ?? ''
  return normalized || DEFAULT_TAVILY_SEARCH_BASE_URL
}

function consumeProviderDeltas(
  deltas: ReturnType<ReturnType<typeof getProviderAdapter>['parseSseEvent']>,
  onDelta: (delta: StreamDelta) => void,
  current: { content: string; reasoningContent: string; toolCalls: NormalizedToolCall[] },
): { content: string; done: boolean; reasoningContent: string; toolCalls: NormalizedToolCall[] } {
  let content = current.content
  let reasoningContent = current.reasoningContent
  let done = false
  let toolCalls = current.toolCalls

  for (const delta of deltas) {
    if (delta.type === 'content_delta') {
      content += delta.content
      onDelta({ content: delta.content })
      continue
    }

    if (delta.type === 'reasoning_delta') {
      reasoningContent += delta.content
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

  return { content, done, reasoningContent, toolCalls }
}

function createHeaders(settings: ActiveProviderSettings): HeadersInit {
  return {
    Authorization: `Bearer ${settings.apiKey}`,
    'Content-Type': 'application/json',
  }
}
