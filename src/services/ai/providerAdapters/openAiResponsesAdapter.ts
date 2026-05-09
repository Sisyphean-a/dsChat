import type { ProviderAdapter, ProviderPayloadInput, ProviderStreamState } from '../providerAdapter'
import type { ProviderStreamDelta } from '../toolTypes'

interface ResponsesInputContentPart {
  type: 'input_image' | 'input_text' | 'output_text'
  image_url?: string
  text?: string
}

interface ResponsesStreamEvent {
  error?: {
    message?: string
  }
  item?: {
    action?: { query?: string }
    phase?: string
    type?: string
  }
  delta?: string
  text?: string
  type?: string
}

const DONE_EVENT = '[DONE]'
const OPENAI_AUTO_WEB_SEARCH_MODELS = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.4-nano',
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
] as const
const STREAM_STATUS_PROCESSING = '正在处理请求...'
const STREAM_STATUS_SEARCH_START = '正在发起联网搜索...'
const STREAM_STATUS_SEARCHING = '正在联网搜索...'
const STREAM_STATUS_SEARCH_DONE = '已完成检索，正在整理结果...'
const STREAM_STATUS_ANSWERING = '正在生成回答...'

export const openAiResponsesAdapter: ProviderAdapter = {
  supportsTools: false,
  createRequestUrl(baseUrl: string): string {
    return `${baseUrl.replace(/\/$/, '')}/responses`
  },
  createPayload(input: ProviderPayloadInput): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      input: input.messages.map((message) => ({
        role: message.role === 'tool' ? 'assistant' : message.role,
        content: createResponsesInputContent(message),
      })),
      model: input.settings.model,
      stream: input.stream,
    }

    payload.temperature = input.settings.temperature

    if (supportsOpenAiAutoWebSearch(input.settings.model)) {
      payload.tool_choice = 'auto'
      payload.tools = [{ type: 'web_search' }]
    }

    return payload
  },
  parseSseEvent(event: string, _state: ProviderStreamState): ProviderStreamDelta[] {
    if (!event) {
      return []
    }

    if (event === DONE_EVENT) {
      return [{ type: 'done' }]
    }

    const data = JSON.parse(event) as ResponsesStreamEvent
    if (data.type === 'response.error') {
      const detail = data.error?.message?.trim()
      throw new Error(detail || 'OpenAI 请求失败：web_search 调用异常。')
    }

    if (data.type === 'response.completed') {
      return [{ type: 'done' }]
    }

    const deltas: ProviderStreamDelta[] = []
    const status = resolveOpenAiStreamingStatus(data)
    if (status) {
      deltas.push({ type: 'status', status })
    }

    let contentDelta = ''
    if (data.type === 'response.output_text.delta') {
      contentDelta = data.delta ?? ''
    } else if (data.type === 'response.output_text.done') {
      contentDelta = resolveCumulativeDelta(data.text ?? '', _state.lastContent)
    }

    if (contentDelta) {
      _state.lastContent = `${_state.lastContent}${contentDelta}`
      deltas.push({ type: 'content_delta', content: contentDelta })
    }

    return deltas
  },
}

function createResponsesInputContent(
  message: ProviderPayloadInput['messages'][number],
): ResponsesInputContentPart[] {
  const role = message.role === 'tool' ? 'assistant' : message.role
  const textType: ResponsesInputContentPart['type'] = role === 'assistant' ? 'output_text' : 'input_text'
  const parts: ResponsesInputContentPart[] = []

  if (message.content.trim()) {
    parts.push({
      type: textType,
      text: message.content,
    })
  }

  if (role !== 'assistant') {
    for (const attachment of message.attachments ?? []) {
      if (attachment.type !== 'image') {
        continue
      }

      parts.push({
        type: 'input_image',
        image_url: attachment.dataUrl,
      })
    }
  }

  if (parts.length) {
    return parts
  }

  return [{
    type: textType,
    text: message.content,
  }]
}

function resolveOpenAiStreamingStatus(event: ResponsesStreamEvent): string | '' {
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

  const compact = value.length > 42 ? `${value.slice(0, 42)}...` : value
  return `已完成检索：${compact}`
}

function resolveCumulativeDelta(nextValue: string, currentValue: string): string {
  if (!nextValue) {
    return ''
  }

  if (!currentValue) {
    return nextValue
  }

  return nextValue.startsWith(currentValue)
    ? nextValue.slice(currentValue.length)
    : nextValue
}

function supportsOpenAiAutoWebSearch(model: string): boolean {
  return OPENAI_AUTO_WEB_SEARCH_MODELS.includes(
    model.trim() as (typeof OPENAI_AUTO_WEB_SEARCH_MODELS)[number],
  )
}
