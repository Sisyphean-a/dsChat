import type { ProviderId } from '../../../types/chat'
import {
  resolveProviderRequestTemperature,
  shouldIncludeProviderRequestTemperature,
} from '../../../constants/providerCapabilities'
import { createThinkingPayloadForChatCompletions } from '../../../constants/thinking'
import { normalizeHttpsEndpoint } from '../../endpointValidation'
import { validateImageAttachment } from '../../imageAttachmentValidation'
import type {
  ProviderAdapter,
  ProviderConversationMessage,
  ProviderRequestInput,
  ProviderStreamState,
} from '../providerAdapter'

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
  }>
}

interface ChatCompletionChunk {
  choices?: Array<{
    delta?: StreamDeltaPayload
    finish_reason?: string | null
  }>
}

interface ChatCompletionTextPart {
  text: string
  type: 'text'
}

interface ChatCompletionImagePart {
  image_url: { url: string }
  type: 'image_url'
}

type ChatCompletionMessageContent = string | Array<ChatCompletionTextPart | ChatCompletionImagePart>

const DONE_EVENT = '[DONE]'

export const chatCompletionsAdapter: ProviderAdapter = {
  createRequest(input) {
    return {
      body: createPayload(input),
      headers: createHeaders(input.settings.apiKey),
      url: `${normalizeHttpsEndpoint(input.settings.baseUrl, `${input.settings.label} Base URL`).replace(/\/$/, '')}/chat/completions`,
    }
  },
  createStreamState(settings) {
    return {
      lastContent: '',
      lastReasoning: '',
      provider: settings.provider,
      toolCalls: new Map(),
    }
  },
  parseSseEvent(event, state) {
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

    const deltas: ReturnType<ProviderAdapter['parseSseEvent']> = []
    const delta = choice.delta
    if (delta) {
      const reasoning = extractReasoningDelta(delta, state)
      if (reasoning) {
        deltas.push({ type: 'reasoning', content: reasoning })
      }

      const content = extractContentDelta(delta, state)
      if (content) {
        deltas.push({ type: 'content', content })
      }

      appendToolCalls(delta, state)
    }

    if (choice.finish_reason === 'tool_calls') {
      deltas.push({ type: 'tool-calls', calls: flushToolCalls(state) })
    }

    return deltas
  },
  supportsTools: true,
}

function createPayload(input: ProviderRequestInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    messages: input.messages.map((message) => createMessagePayload(message, input.settings.provider)),
    model: input.settings.model,
    stream: input.stream,
  }

  if (shouldIncludeProviderRequestTemperature(input.settings.provider, input.settings, input.thinkingLevel)) {
    payload.temperature = resolveProviderRequestTemperature(
      input.settings.provider,
      input.settings.temperature,
      input.thinkingLevel,
    )
  }

  Object.assign(payload, createThinkingPayloadForChatCompletions(
    input.settings.provider,
    input.settings,
    input.thinkingLevel,
  ))

  if (input.tools.length) {
    payload.parallel_tool_calls = false
    payload.tool_choice = 'auto'
    payload.tools = input.tools
  }

  return payload
}

function createHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

function createMessagePayload(message: ProviderConversationMessage, provider: ProviderId): Record<string, unknown> {
  if (message.role === 'tool') {
    return { content: message.content, role: 'tool', tool_call_id: message.toolCallId }
  }

  const payload: Record<string, unknown> = {
    content: createMessageContent(message.content, message.attachments ?? []),
    role: message.role,
  }
  if (message.role === 'assistant' && message.toolCalls?.length) {
    payload.content = message.content.trim() ? payload.content : null
    payload.tool_calls = message.toolCalls.map((call) => ({
      function: { arguments: call.argumentsJson, name: call.name },
      id: call.id,
      type: 'function',
    }))
  }
  if (requiresReasoningContentEcho(provider) && message.role === 'assistant' && message.reasoningContent) {
    payload.reasoning_content = message.reasoningContent
  }
  return payload
}

function createMessageContent(
  content: string,
  attachments: ProviderConversationMessage['attachments'],
): ChatCompletionMessageContent {
  if (!attachments?.length) {
    return content
  }
  const parts: Array<ChatCompletionTextPart | ChatCompletionImagePart> = []
  if (content.trim()) {
    parts.push({ text: content, type: 'text' })
  }
  for (const attachment of attachments) {
    validateImageAttachment(attachment)
    parts.push({ image_url: { url: attachment.dataUrl }, type: 'image_url' })
  }
  return parts.length ? parts : content
}

function extractReasoningDelta(delta: StreamDeltaPayload, state: ProviderStreamState): string {
  if (delta.reasoning_content) {
    state.lastReasoning += delta.reasoning_content
    return delta.reasoning_content
  }
  const complete = delta.reasoning_details?.map((item) => item.text ?? '').join('') ?? ''
  const result = resolveCumulativeDelta(complete, state.lastReasoning)
  if (complete) {
    state.lastReasoning = complete
  }
  return result
}

function extractContentDelta(delta: StreamDeltaPayload, state: ProviderStreamState): string {
  const complete = delta.content ?? ''
  if (!complete) return ''
  if (state.provider !== 'minimax') return complete

  const result = resolveCumulativeDelta(complete, state.lastContent)
  state.lastContent = complete
  return result
}

function appendToolCalls(delta: StreamDeltaPayload, state: ProviderStreamState): void {
  for (const item of delta.tool_calls ?? []) {
    const index = item.index ?? 0
    const previous = state.toolCalls.get(index)
    const id = item.id ?? previous?.id ?? ''
    const name = item.function?.name ?? previous?.name ?? ''
    const argumentsJson = `${previous?.argumentsJson ?? ''}${item.function?.arguments ?? ''}`
    state.toolCalls.set(index, { argumentsJson, id, name })
  }
}

function flushToolCalls(state: ProviderStreamState): Array<{ argumentsJson: string; id: string; name: string }> {
  const calls = [...state.toolCalls.entries()].sort(([left], [right]) => left - right).map(([, call]) => call)
  state.toolCalls.clear()
  return calls
}

function resolveCumulativeDelta(next: string, previous: string): string {
  if (!next) {
    return ''
  }
  return previous && next.startsWith(previous) ? next.slice(previous.length) : next
}

function requiresReasoningContentEcho(provider: ProviderId): boolean {
  return provider === 'deepseek' || provider === 'kimi'
}
