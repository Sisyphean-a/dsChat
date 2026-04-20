import type { ChatMessage, SettingsForm } from '../types/chat'

interface ChatChoice {
  delta?: {
    content?: string
  }
  message?: {
    content?: string
  }
}

interface ChatCompletionResponse {
  choices?: ChatChoice[]
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
    body: JSON.stringify(createPayload(messages, settings.model, false)),
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
  onDelta: (chunk: string) => void,
): Promise<string> {
  const response = await fetch(createChatUrl(settings.baseUrl), {
    body: JSON.stringify(createPayload(messages, settings.model, true)),
    headers: createHeaders(settings.apiKey),
    method: 'POST',
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

  while (true) {
    const chunk = await reader.read()
    if (chunk.done) {
      break
    }

    buffer += decoder.decode(chunk.value, { stream: true })
    const consumed = consumeSseBuffer(buffer)
    buffer = consumed.rest

    for (const event of consumed.events) {
      const next = appendDelta(content, event, onDelta)
      if (next.done) {
        return next.content
      }

      content = next.content
    }
  }

  const trailingEvent = extractEventPayload(buffer)
  if (trailingEvent) {
    content = appendDelta(content, trailingEvent, onDelta).content
  }

  return content
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
  content: string,
  event: string,
  onDelta: (chunk: string) => void,
): { content: string; done: boolean } {
  if (!event) {
    return { content, done: false }
  }

  if (event === DONE_EVENT) {
    return { content, done: true }
  }

  const data = JSON.parse(event) as ChatCompletionResponse
  const delta = data.choices?.[0]?.delta?.content ?? ''
  if (!delta) {
    return { content, done: false }
  }

  onDelta(delta)
  return {
    content: `${content}${delta}`,
    done: false,
  }
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

function createPayload(messages: ChatMessage[], model: string, stream: boolean) {
  return {
    messages: messages.map(({ content, role }) => ({ content, role })),
    model,
    stream,
  }
}
