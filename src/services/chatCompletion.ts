import { modelSupportsTemperature } from '../composables/chatAppSettings'
import type { ActiveProviderSettings, ChatMessage, ProviderId } from '../types/chat'

interface StreamDeltaPayload {
  content?: string | null
  reasoning_content?: string
  reasoning_details?: Array<{ text?: string }>
}

interface ChatChoice {
  delta?: StreamDeltaPayload
  message?: {
    content?: string | null
  }
}

interface ChatCompletionResponse {
  choices?: ChatChoice[]
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

export interface StreamDelta {
  content?: string
  reasoningContent?: string
}

export interface ChatRequestOptions {
  thinkingEnabled?: boolean
}

const DONE_EVENT = '[DONE]'

export function consumeSseBuffer(buffer: string): { events: string[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n')
  const frames = normalized.split('\n\n')
  const rest = normalized.endsWith('\n\n') ? '' : frames.pop() ?? ''
  const events = frames.map(extractEventPayload).filter(Boolean)

  return { events, rest }
}

export async function requestChatCompletion(
  messages: ChatMessage[],
  settings: ActiveProviderSettings,
  requestOptions?: ChatRequestOptions,
): Promise<string> {
  const response = await fetch(createChatUrl(settings.baseUrl), {
    body: JSON.stringify(createPayload(messages, settings, false, requestOptions)),
    headers: createHeaders(settings),
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(await createProviderFailureMessage(
      settings.label,
      response.status,
      response.statusText,
      response,
    ))
  }

  const data = (await response.json()) as ChatCompletionResponse
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) {
    throw new Error(createProviderEmptyMessage(settings.label))
  }

  return content
}

export async function streamChatCompletion(
  messages: ChatMessage[],
  settings: ActiveProviderSettings,
  onDelta: (delta: StreamDelta) => void,
  signal?: AbortSignal,
  requestOptions?: ChatRequestOptions,
): Promise<string> {
  const response = await fetch(createChatUrl(settings.baseUrl), {
    body: JSON.stringify(createPayload(messages, settings, true, requestOptions)),
    headers: createHeaders(settings),
    method: 'POST',
    signal,
  })

  if (!response.ok) {
    throw new Error(await createProviderFailureMessage(
      settings.label,
      response.status,
      response.statusText,
      response,
    ))
  }

  if (!response.body) {
    throw new Error('当前环境不支持流式响应读取。')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let reasoningContent = ''

  while (true) {
    const chunk = await reader.read()
    if (chunk.done) {
      break
    }

    buffer += decoder.decode(chunk.value, { stream: true })
    const consumed = consumeSseBuffer(buffer)
    buffer = consumed.rest

    for (const event of consumed.events) {
      const next = appendDelta({ content, reasoningContent }, event, onDelta, settings.provider)
      if (next.done) {
        return finalizeStreamContent(next.content, settings.label)
      }

      content = next.content
      reasoningContent = next.reasoningContent
    }
  }

  const trailingEvent = extractEventPayload(buffer)
  if (trailingEvent) {
    const trailing = appendDelta({ content, reasoningContent }, trailingEvent, onDelta, settings.provider)
    content = trailing.content
  }

  return finalizeStreamContent(content, settings.label)
}

function extractEventPayload(frame: string): string {
  return frame
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
    .trim()
}

function appendDelta(
  current: { content: string; reasoningContent: string },
  event: string,
  onDelta: (delta: StreamDelta) => void,
  provider: ProviderId,
): { content: string; done: boolean; reasoningContent: string } {
  if (!event) {
    return { ...current, done: false }
  }

  if (event === DONE_EVENT) {
    return { ...current, done: true }
  }

  const data = JSON.parse(event) as ChatCompletionResponse
  const delta = data.choices?.[0]?.delta

  const reasoningDelta = extractReasoningDelta(provider, delta, current.reasoningContent)
  const nextReasoning = reasoningDelta ? `${current.reasoningContent}${reasoningDelta}` : current.reasoningContent
  if (reasoningDelta) {
    onDelta({ reasoningContent: reasoningDelta })
  }

  const contentDelta = extractContentDelta(provider, delta, current.content)
  const nextContent = contentDelta ? `${current.content}${contentDelta}` : current.content
  if (contentDelta) {
    onDelta({ content: contentDelta })
  }

  return {
    content: nextContent,
    done: false,
    reasoningContent: nextReasoning,
  }
}

function extractReasoningDelta(
  provider: ProviderId,
  delta: StreamDeltaPayload | undefined,
  currentReasoning: string,
): string {
  if (!delta) {
    return ''
  }

  if (provider === 'minimax') {
    const fullReasoning = (delta.reasoning_details ?? [])
      .map((detail) => detail.text ?? '')
      .join('')
    return resolveCumulativeDelta(fullReasoning, currentReasoning)
  }

  return delta.reasoning_content ?? ''
}

function extractContentDelta(
  provider: ProviderId,
  delta: StreamDeltaPayload | undefined,
  currentContent: string,
): string {
  if (!delta?.content) {
    return ''
  }

  if (provider === 'minimax') {
    return resolveCumulativeDelta(delta.content, currentContent)
  }

  return delta.content
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

function finalizeStreamContent(content: string, label: string): string {
  if (!content.trim()) {
    throw new Error(createProviderEmptyMessage(label))
  }

  return content
}

function createChatUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/chat/completions`
}

function createHeaders(settings: ActiveProviderSettings): HeadersInit {
  return {
    Authorization: `Bearer ${settings.apiKey}`,
    'Content-Type': 'application/json',
  }
}

function createPayload(
  messages: ChatMessage[],
  settings: ActiveProviderSettings,
  stream: boolean,
  requestOptions?: ChatRequestOptions,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    messages: messages.map(({ content, role, attachments }) => ({
      content: createMessageContent(content, attachments?.map((item) => ({ ...item })) ?? []),
      role,
    })),
    model: settings.model,
    stream,
  }

  if (modelSupportsTemperature(settings.provider, settings.model)) {
    payload.temperature = settings.temperature
  }

  if (settings.provider === 'minimax') {
    payload.reasoning_split = requestOptions?.thinkingEnabled ?? true
  }

  if (settings.provider === 'kimi') {
    payload.thinking = {
      type: (requestOptions?.thinkingEnabled ?? true) ? 'enabled' : 'disabled',
    }
  }

  return payload
}

async function createProviderFailureMessage(
  label: string,
  status: number,
  statusText: string,
  response?: Response,
): Promise<string> {
  const detail = response ? await readProviderFailureDetail(response) : ''
  if (containsImageInputUnsupportedError(detail)) {
    return `${label} 当前模型仅支持文本输入，不支持图片。请切换支持图片的供应商后再发送。`
  }

  const normalizedStatusText = statusText.trim()
  if (!detail) {
    return normalizedStatusText
      ? `${label} 请求失败：${status} ${normalizedStatusText}`
      : `${label} 请求失败：${status}`
  }

  return `${label} 请求失败：${status} ${detail}`
}

function createProviderEmptyMessage(label: string): string {
  return `${label} 未返回可用内容。`
}

function createMessageContent(content: string, attachments: ChatMessage['attachments']): ChatCompletionMessageContent {
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

  for (const item of attachments) {
    if (item.type !== 'image') {
      continue
    }

    parts.push({
      type: 'image_url',
      image_url: {
        url: item.dataUrl,
      },
    })
  }

  if (!parts.length) {
    return content
  }

  return parts
}

async function readProviderFailureDetail(response: Response): Promise<string> {
  try {
    const payload = await response.clone().json() as {
      error?: { message?: string | null }
      message?: string | null
    }
    const message = payload.error?.message ?? payload.message ?? ''
    return typeof message === 'string' ? message.trim() : ''
  } catch {
    return ''
  }
}

function containsImageInputUnsupportedError(detail: string): boolean {
  const normalized = detail.toLowerCase()
  return normalized.includes('unknown variant `image_url`')
    && normalized.includes('expected `text`')
}
