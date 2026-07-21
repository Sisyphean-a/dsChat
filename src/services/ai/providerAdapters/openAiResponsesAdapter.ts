import {
  providerSupportsNativeWebSearch,
  resolveProviderRequestTemperature,
  shouldIncludeProviderRequestTemperature,
  supportsOpenAiNativeWebSearchModel,
} from '../../../constants/providerCapabilities'
import type {
  ProviderAdapter,
  ProviderConversationMessage,
  ProviderRequestInput,
  ProviderStreamState,
} from '../providerAdapter'

interface ResponsesInputContentPart {
  image_url?: string
  text?: string
  type: 'input_image' | 'input_text' | 'output_text'
}

interface ResponsesStreamEvent {
  error?: { message?: string }
  item?: { action?: { query?: string }; phase?: string; type?: string }
  delta?: string
  text?: string
  type?: string
}

const DONE_EVENT = '[DONE]'
const STREAM_STATUS_PROCESSING = '正在处理请求...'
const STREAM_STATUS_SEARCH_START = '正在发起联网搜索...'
const STREAM_STATUS_SEARCHING = '正在联网搜索...'
const STREAM_STATUS_SEARCH_DONE = '已完成检索，正在整理结果...'
const STREAM_STATUS_ANSWERING = '正在生成回答...'

export const openAiResponsesAdapter: ProviderAdapter = {
  createRequest(input) {
    return {
      body: createPayload(input),
      headers: {
        Authorization: `Bearer ${input.settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      url: `${input.settings.baseUrl.replace(/\/$/, '')}/responses`,
    }
  },
  createStreamState(settings) {
    return { lastContent: '', lastReasoning: '', provider: settings.provider, toolCalls: new Map() }
  },
  parseSseEvent(event, state) {
    if (!event) {
      return []
    }
    if (event === DONE_EVENT) {
      return [{ type: 'done' }]
    }

    const data = JSON.parse(event) as ResponsesStreamEvent
    if (data.type === 'response.error') {
      throw new Error(data.error?.message?.trim() || 'OpenAI 请求失败：web_search 调用异常。')
    }
    if (data.type === 'response.completed') {
      return [{ type: 'done' }]
    }

    const deltas: ReturnType<ProviderAdapter['parseSseEvent']> = []
    const status = resolveOpenAiStreamingStatus(data)
    if (status) {
      deltas.push({ type: 'status', status })
    }
    const content = resolveContentDelta(data, state)
    if (content) {
      deltas.push({ type: 'content', content })
    }
    return deltas
  },
  supportsTools: false,
}

function createPayload(input: ProviderRequestInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    input: input.messages.map((message) => ({
      content: createResponsesInputContent(message),
      role: message.role === 'tool' ? 'assistant' : message.role,
    })),
    model: input.settings.model,
    stream: input.stream,
  }
  if (shouldIncludeProviderRequestTemperature(input.settings.provider, input.settings, input.thinkingEnabled)) {
    payload.temperature = resolveProviderRequestTemperature(
      input.settings.provider,
      input.settings.temperature,
      input.thinkingEnabled,
    )
  }
  if (providerSupportsNativeWebSearch(input.settings) && supportsOpenAiNativeWebSearchModel(input.settings.model)) {
    payload.tool_choice = 'auto'
    payload.tools = [{ type: 'web_search' }]
  }
  return payload
}

function createResponsesInputContent(message: ProviderConversationMessage): ResponsesInputContentPart[] {
  const role = message.role === 'tool' ? 'assistant' : message.role
  const textType: ResponsesInputContentPart['type'] = role === 'assistant' ? 'output_text' : 'input_text'
  const parts: ResponsesInputContentPart[] = []
  if (message.content.trim()) {
    parts.push({ text: message.content, type: textType })
  }
  if (role !== 'assistant') {
    for (const attachment of message.attachments ?? []) {
      parts.push({ image_url: attachment.dataUrl, type: 'input_image' })
    }
  }
  return parts.length ? parts : [{ text: message.content, type: textType }]
}

function resolveContentDelta(event: ResponsesStreamEvent, state: ProviderStreamState): string {
  if (event.type === 'response.output_text.delta') {
    const content = event.delta ?? ''
    state.lastContent += content
    return content
  }

  if (event.type !== 'response.output_text.done') {
    return ''
  }

  const complete = event.text ?? ''
  const content = complete.startsWith(state.lastContent)
    ? complete.slice(state.lastContent.length)
    : complete
  state.lastContent += content
  return content
}

function resolveOpenAiStreamingStatus(event: ResponsesStreamEvent): string {
  if (event.type === 'response.created' || event.type === 'response.in_progress') {
    return STREAM_STATUS_PROCESSING
  }
  if (event.type === 'response.web_search_call.in_progress' || event.type === 'response.web_search_call.searching') {
    return STREAM_STATUS_SEARCHING
  }
  if (event.type === 'response.web_search_call.completed') {
    return STREAM_STATUS_SEARCH_DONE
  }
  if (event.type === 'response.output_item.added') {
    if (event.item?.type === 'web_search_call') {
      return STREAM_STATUS_SEARCH_START
    }
    if (event.item?.type === 'message' && event.item.phase === 'final_answer') {
      return STREAM_STATUS_ANSWERING
    }
  }
  if (event.type === 'response.output_item.done' && event.item?.type === 'web_search_call') {
    return describeSearchActionStatus(event.item.action?.query)
  }
  return ''
}

function describeSearchActionStatus(query: string | undefined): string {
  const value = query?.trim()
  if (!value) {
    return STREAM_STATUS_SEARCH_DONE
  }
  return `已完成检索：${value.length > 42 ? `${value.slice(0, 42)}...` : value}`
}
