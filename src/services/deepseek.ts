import { modelSupportsTemperature } from '../composables/chatAppSettings'
import type { ChatMessage, SettingsForm } from '../types/chat'

interface ChatChoice {
  delta?: {
    content?: string
    reasoning_content?: string
  }
  message?: {
    content?: string
    reasoning_content?: string
  }
}

interface ChatCompletionResponse {
  choices?: ChatChoice[]
}

export interface StreamDelta {
  content?: string
  reasoningContent?: string
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
  settings: SettingsForm,
): Promise<string> {
  const response = await fetch(createChatUrl(settings.baseUrl), {
    body: JSON.stringify(createPayload(messages, settings, false)),
    headers: createHeaders(settings.apiKey),
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`DeepSeek 请求失败：${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as ChatCompletionResponse
  const content = data.choices?.[0]?.message?.content?.trim()

  if (!content) {
    throw new Error('DeepSeek 未返回可用内容。')
  }

  return content
}

export async function streamChatCompletion(
  messages: ChatMessage[],
  settings: SettingsForm,
  onDelta: (delta: StreamDelta) => void,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(createChatUrl(settings.baseUrl), {
    body: JSON.stringify(createPayload(messages, settings, true)),
    headers: createHeaders(settings.apiKey),
    method: 'POST',
    signal,
  })

  if (!response.ok) {
    throw new Error(`DeepSeek 请求失败：${response.status} ${response.statusText}`)
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
      const next = appendDelta({ content, reasoningContent }, event, onDelta)
      if (next.done) {
        return finalizeStreamContent(next.content)
      }

      content = next.content
      reasoningContent = next.reasoningContent
    }
  }

  const trailingEvent = extractEventPayload(buffer)
  if (trailingEvent) {
    const trailing = appendDelta({ content, reasoningContent }, trailingEvent, onDelta)
    content = trailing.content
  }

  return finalizeStreamContent(content)
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
): { content: string; done: boolean; reasoningContent: string } {
  if (!event) {
    return { ...current, done: false }
  }

  if (event === DONE_EVENT) {
    return { ...current, done: true }
  }

  const data = JSON.parse(event) as ChatCompletionResponse
  const delta = data.choices?.[0]?.delta
  const reasoningDelta = delta?.reasoning_content ?? ''
  if (reasoningDelta) {
    onDelta({ reasoningContent: reasoningDelta })
    return {
      content: current.content,
      done: false,
      reasoningContent: `${current.reasoningContent}${reasoningDelta}`,
    }
  }

  const contentDelta = delta?.content ?? ''
  if (!contentDelta) {
    return { ...current, done: false }
  }

  onDelta({ content: contentDelta })
  return {
    content: `${current.content}${contentDelta}`,
    done: false,
    reasoningContent: current.reasoningContent,
  }
}

function finalizeStreamContent(content: string): string {
  if (!content.trim()) {
    throw new Error('DeepSeek 未返回可用内容。')
  }

  return content
}

function createChatUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/chat/completions`
}

function createHeaders(apiKey: string): HeadersInit {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

function createPayload(messages: ChatMessage[], settings: SettingsForm, stream: boolean) {
  const payload = {
    messages: messages.map(({ content, role }) => ({ content, role })),
    model: settings.model,
    stream,
  }

  if (!modelSupportsTemperature(settings.model)) {
    return payload
  }

  return {
    ...payload,
    temperature: settings.temperature,
  }
}
