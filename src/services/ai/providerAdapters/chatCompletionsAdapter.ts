import { supportsDeepseekThinking } from '../../../constants/providers'
import { modelSupportsTemperature } from '../../../composables/chatAppSettings'
import type { ProviderId } from '../../../types/chat'
import type { ChatRequestOptions } from '../../chatCompletion'
import type { ProviderAdapter, ProviderPayloadInput, ProviderStreamState } from '../providerAdapter'
import type { ProviderStreamDelta } from '../toolTypes'

interface StreamDeltaPayload {
  content?: string | null
  reasoning_content?: string
  reasoning_details?: Array<{ text?: string }>
  tool_calls?: Array<{
    id?: string
    index?: number
    function?: {
      arguments?: string
      name?: string
    }
    type?: 'function'
  }>
}

interface ChatCompletionChunk {
  choices?: Array<{
    delta?: StreamDeltaPayload
    finish_reason?: string | null
  }>
}

interface ChatCompletionTextPart {
  type: 'text'
  text: string
}

interface ChatCompletionImagePart {
  type: 'image_url'
  image_url: {
    url: string
  }
}

type ChatCompletionMessageContent = string | Array<ChatCompletionTextPart | ChatCompletionImagePart>

const DONE_EVENT = '[DONE]'

export const chatCompletionsAdapter: ProviderAdapter = {
  supportsTools: true,
  createRequestUrl(baseUrl: string): string {
    return `${baseUrl.replace(/\/$/, '')}/chat/completions`
  },
  createPayload(input: ProviderPayloadInput): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      messages: input.messages.map((message) => createMessagePayload(message)),
      model: input.settings.model,
      stream: input.stream,
    }

    if (shouldIncludeTemperature(input.settings.provider, input.settings.model, input.requestOptions)) {
      payload.temperature = input.settings.temperature
    }

    if (input.settings.provider === 'deepseek' && supportsDeepseekThinking(input.settings.model)) {
      payload.thinking = {
        type: (input.requestOptions?.thinkingEnabled ?? true) ? 'enabled' : 'disabled',
      }
    }

    if (input.settings.provider === 'minimax') {
      payload.reasoning_split = input.requestOptions?.thinkingEnabled ?? true
    }

    if (input.settings.provider === 'kimi') {
      payload.thinking = {
        type: (input.requestOptions?.thinkingEnabled ?? true) ? 'enabled' : 'disabled',
      }
    }

    if (input.tools?.length) {
      payload.tool_choice = 'auto'
      payload.tools = input.tools
    }

    return payload
  },
  parseSseEvent(event: string, state: ProviderStreamState): ProviderStreamDelta[] {
    if (!event) {
      return []
    }

    if (event === DONE_EVENT) {
      return [{ type: 'done' }]
    }

    const chunk = JSON.parse(event) as ChatCompletionChunk
    const choice = chunk.choices?.[0]
    if (!choice) {
      return []
    }

    const deltas: ProviderStreamDelta[] = []
    const delta = choice.delta
    if (delta) {
      const reasoningDelta = extractReasoningDelta(delta, state)
      if (reasoningDelta) {
        deltas.push({ type: 'reasoning_delta', content: reasoningDelta })
      }

      const contentDelta = extractContentDelta(delta, state)
      if (contentDelta) {
        deltas.push({ type: 'content_delta', content: contentDelta })
      }

      appendToolCalls(delta, state)
    }

    if (choice.finish_reason === 'tool_calls') {
      deltas.push({
        type: 'tool_calls_done',
        calls: flushToolCalls(state),
      })
    }

    return deltas
  },
}

function createMessagePayload(
  message: ProviderPayloadInput['messages'][number],
): Record<string, unknown> {
  if (message.role === 'tool') {
    return {
      role: 'tool',
      content: message.content,
      tool_call_id: message.toolCallId,
    }
  }

  const payload: Record<string, unknown> = {
    role: message.role,
    content: createMessageContent(message.content, message.attachments ?? []),
  }

  if (message.role === 'assistant' && message.toolCalls?.length) {
    payload.tool_calls = message.toolCalls.map((call) => ({
      id: call.id,
      type: 'function',
      function: {
        name: call.name,
        arguments: call.argumentsJson,
      },
    }))
  }

  return payload
}

function createMessageContent(
  content: string,
  attachments: ProviderPayloadInput['messages'][number]['attachments'],
): ChatCompletionMessageContent {
  if (!attachments?.length) {
    return content
  }

  const parts: Array<ChatCompletionTextPart | ChatCompletionImagePart> = []
  if (content.trim()) {
    parts.push({
      type: 'text',
      text: content,
    })
  }

  for (const attachment of attachments) {
    if (attachment.type !== 'image') {
      continue
    }

    parts.push({
      type: 'image_url',
      image_url: {
        url: attachment.dataUrl,
      },
    })
  }

  if (!parts.length) {
    return content
  }

  return parts
}

function shouldIncludeTemperature(
  provider: ProviderId,
  model: string,
  requestOptions?: ChatRequestOptions,
): boolean {
  if (!modelSupportsTemperature(provider, model)) {
    return false
  }

  if (provider !== 'deepseek') {
    return true
  }

  if (!supportsDeepseekThinking(model)) {
    return true
  }

  return (requestOptions?.thinkingEnabled ?? true) === false
}

function extractReasoningDelta(delta: StreamDeltaPayload, state: ProviderStreamState): string {
  if (delta.reasoning_content) {
    state.lastReasoning += delta.reasoning_content
    return delta.reasoning_content
  }

  if (!delta.reasoning_details?.length) {
    return ''
  }

  const fullReasoning = delta.reasoning_details.map((item) => item.text ?? '').join('')
  const reasoningDelta = resolveCumulativeDelta(fullReasoning, state.lastReasoning)
  if (fullReasoning) {
    state.lastReasoning = fullReasoning
  }
  return reasoningDelta
}

function extractContentDelta(delta: StreamDeltaPayload, state: ProviderStreamState): string {
  if (!delta.content) {
    return ''
  }

  const current = delta.content
  const contentDelta = resolveCumulativeDelta(current, state.lastContent)
  if (current) {
    state.lastContent = current
  }
  return contentDelta
}

function appendToolCalls(delta: StreamDeltaPayload, state: ProviderStreamState): void {
  for (const item of delta.tool_calls ?? []) {
    const index = typeof item.index === 'number' ? item.index : 0
    const current = state.toolCalls.get(index)
    const nextName = item.function?.name ?? current?.name ?? ''
    const nextArguments = `${current?.argumentsJson ?? ''}${item.function?.arguments ?? ''}`
    const nextId = item.id ?? current?.id ?? `call-${index}`

    state.toolCalls.set(index, {
      argumentsJson: nextArguments,
      id: nextId,
      name: nextName,
    })
  }
}

function flushToolCalls(state: ProviderStreamState): Array<{ argumentsJson: string; id: string; name: string }> {
  const calls = [...state.toolCalls.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, call]) => call)
  state.toolCalls.clear()
  return calls
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
