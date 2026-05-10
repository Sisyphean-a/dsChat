import { supportsDeepseekThinking } from '../constants/providers'
import { modelSupportsTemperature } from '../composables/chatAppSettings'
import type { ActiveProviderSettings, ChatMessage, ProviderId, ToolSettings } from '../types/chat'
import { streamWithToolOrchestrator } from './ai/toolOrchestrator'

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

interface ResponsesTextContent {
  text?: string | null
  type?: string
}

interface ResponsesOutputItem {
  action?: {
    query?: string
  }
  content?: ResponsesTextContent[]
  phase?: string
  status?: string
  type?: string
}

interface ResponsesCreateResponse {
  output?: ResponsesOutputItem[]
  output_text?: string | null
}

interface ResponsesStreamEvent {
  delta?: string
  error?: {
    message?: string
  }
  item?: ResponsesOutputItem
  text?: string
  type?: string
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
type ResponsesInputContent = Array<
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string }
  | { type: 'output_text'; text: string }
>

export interface StreamDelta {
  content?: string
  reasoningContent?: string
  streamingStatus?: string
}

export interface ChatRequestOptions {
  thinkingEnabled?: boolean
  toolSettings?: ToolSettings
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
  const response = await fetch(createRequestUrl(settings.baseUrl, settings.provider), {
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

  const data = await response.json()
  const content = settings.provider === 'openai'
    ? extractOpenAiResponseText(data as ResponsesCreateResponse).trim()
    : ((data as ChatCompletionResponse).choices?.[0]?.message?.content?.trim() ?? '')
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
  if (shouldUseToolOrchestrator(settings, requestOptions?.toolSettings)) {
    return streamWithToolOrchestrator(messages, settings, onDelta, signal, requestOptions)
  }

  const response = await fetch(createRequestUrl(settings.baseUrl, settings.provider), {
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

function shouldUseToolOrchestrator(
  settings: ActiveProviderSettings,
  toolSettings: ToolSettings | undefined,
): boolean {
  if (!toolSettings?.enabled) {
    return false
  }

  if (settings.provider === 'openai' && toolSettings.openaiUseNativeWebSearch) {
    return false
  }

  return true
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
  if (provider === 'openai') {
    return appendOpenAiResponseDelta(current, event, onDelta)
  }

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

function appendOpenAiResponseDelta(
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

  const data = JSON.parse(event) as ResponsesStreamEvent
  if (data.type === 'response.error') {
    const detail = data.error?.message?.trim()
    throw new Error(detail || 'OpenAI 请求失败：web_search 调用异常。')
  }

  if (data.type === 'response.completed') {
    return { ...current, done: true }
  }

  const streamingStatus = resolveOpenAiStreamingStatus(data)
  if (streamingStatus) {
    onDelta({ streamingStatus })
  }

  let contentDelta = ''
  if (data.type === 'response.output_text.delta') {
    contentDelta = data.delta ?? ''
  } else if (data.type === 'response.output_text.done') {
    contentDelta = resolveCumulativeDelta(data.text ?? '', current.content)
  }

  if (!contentDelta) {
    return { ...current, done: false }
  }

  onDelta({
    content: contentDelta,
    streamingStatus: STREAM_STATUS_ANSWERING,
  })
  return {
    content: `${current.content}${contentDelta}`,
    done: false,
    reasoningContent: current.reasoningContent,
  }
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

function createRequestUrl(baseUrl: string, provider: ProviderId): string {
  if (provider === 'openai') {
    return `${baseUrl.replace(/\/$/, '')}/responses`
  }

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
  if (settings.provider === 'openai') {
    return createOpenAiPayload(messages, settings, stream, requestOptions)
  }

  const payload: Record<string, unknown> = {
    messages: messages.map(({ content, role, attachments }) => ({
      content: createMessageContent(content, attachments?.map((item) => ({ ...item })) ?? []),
      role,
    })),
    model: settings.model,
    stream,
  }

  if (shouldIncludeTemperature(settings, requestOptions)) {
    payload.temperature = resolveRequestTemperature(
      settings.provider,
      settings.temperature,
      requestOptions,
    )
  }

  if (settings.provider === 'deepseek' && supportsDeepseekThinking(settings.model)) {
    payload.thinking = {
      type: (requestOptions?.thinkingEnabled ?? true) ? 'enabled' : 'disabled',
    }
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

function shouldIncludeTemperature(
  settings: ActiveProviderSettings,
  requestOptions?: ChatRequestOptions,
): boolean {
  if (!modelSupportsTemperature(settings.provider, settings.model)) {
    return false
  }

  if (settings.provider !== 'deepseek') {
    return true
  }

  if (!supportsDeepseekThinking(settings.model)) {
    return true
  }

  return (requestOptions?.thinkingEnabled ?? true) === false
}

function resolveRequestTemperature(
  provider: ProviderId,
  configuredTemperature: number,
  requestOptions?: ChatRequestOptions,
): number {
  if (provider !== 'kimi') {
    return configuredTemperature
  }

  return (requestOptions?.thinkingEnabled ?? true) ? 1.0 : 0.6
}

function createOpenAiPayload(
  messages: ChatMessage[],
  settings: ActiveProviderSettings,
  stream: boolean,
  requestOptions?: ChatRequestOptions,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    input: messages.map(({ attachments, content, role }) => ({
      content: createResponsesInputContent(role, content, attachments?.map((item) => ({ ...item })) ?? []),
      role,
    })),
    model: settings.model,
    stream,
  }

  if (shouldIncludeTemperature(settings, requestOptions)) {
    payload.temperature = settings.temperature
  }

  if (supportsOpenAiAutoWebSearch(settings.model)) {
    payload.tool_choice = 'auto'
    payload.tools = [{ type: 'web_search' }]
  }

  return payload
}

function supportsOpenAiAutoWebSearch(model: string): boolean {
  return OPENAI_AUTO_WEB_SEARCH_MODELS.includes(
    model.trim() as (typeof OPENAI_AUTO_WEB_SEARCH_MODELS)[number],
  )
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

function extractOpenAiResponseText(payload: ResponsesCreateResponse): string {
  const outputText = typeof payload.output_text === 'string' ? payload.output_text : ''
  if (outputText.trim()) {
    return outputText
  }

  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === 'output_text')
    .map((content) => content.text ?? '')
    .join('')
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

function createResponsesInputContent(
  role: ChatMessage['role'],
  content: string,
  attachments: ChatMessage['attachments'],
): ResponsesInputContent {
  const textType = role === 'assistant' ? 'output_text' : 'input_text'
  const parts: ResponsesInputContent = []
  if (content.trim()) {
    parts.push({
      type: textType,
      text: content,
    })
  }

  if (role === 'assistant') {
    if (!parts.length) {
      return [{
        type: 'output_text',
        text: content,
      }]
    }

    return parts
  }

  for (const item of attachments ?? []) {
    if (item.type !== 'image') {
      continue
    }

    parts.push({
      type: 'input_image',
      image_url: item.dataUrl,
    })
  }

  if (!parts.length) {
    return [{
      type: 'input_text',
      text: content,
    }]
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
