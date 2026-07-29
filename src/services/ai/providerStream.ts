import type { ActiveProviderSettings, ThinkingLevel } from '../../types/chat'
import type { AiToolDefinition, NormalizedToolCall } from './toolTypes'
import type { HttpAdapter, HttpResponse } from './httpAdapter'
import type {
  ProviderAdapter,
  ProviderAdapterRegistry,
  ProviderConversationMessage,
  ProviderStreamState,
} from './providerAdapter'
import { selectProviderAdapter } from './providerAdapter'
import { consumeSseBuffer, extractEventPayload } from './sse'

export type ProviderFailureCode = 'empty-result' | 'http' | 'protocol' | 'unsupported-tools'

export class ProviderRequestError extends Error {
  readonly code: ProviderFailureCode

  constructor(code: ProviderFailureCode, message: string, cause?: unknown) {
    super(message)
    this.name = 'ProviderRequestError'
    this.code = code
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause
  }
}

export class ProviderStreamStoppedError extends Error {
  constructor(cause?: unknown) {
    super('流式回复已停止。')
    this.name = 'ProviderStreamStoppedError'
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause
  }
}

export type ProviderStreamEvent =
  | { type: 'content'; content: string }
  | { type: 'reasoning'; content: string }
  | { type: 'status'; status: string }
  | { type: 'tool-calls'; calls: NormalizedToolCall[] }

export interface ProviderStreamRequest {
  messages: ProviderConversationMessage[]
  settings: ActiveProviderSettings
  signal?: AbortSignal
  thinkingLevel: ThinkingLevel
  tools: AiToolDefinition[]
}

export interface ProviderStream {
  stream: (request: ProviderStreamRequest) => AsyncIterable<ProviderStreamEvent>
}

interface ProviderStreamOptions {
  httpAdapter: HttpAdapter
  providerAdapters: ProviderAdapterRegistry
}

interface StreamOutcome {
  hasContent: boolean
  hasToolCalls: boolean
}

export function createProviderStream(options: ProviderStreamOptions): ProviderStream {
  return { stream: (request) => streamProviderReply(options, request) }
}

async function* streamProviderReply(
  options: ProviderStreamOptions,
  request: ProviderStreamRequest,
): AsyncGenerator<ProviderStreamEvent> {
  try {
    const { adapter, body } = await openProviderResponse(options, request)
    const outcome = yield* consumeProviderResponse({ adapter, body, request })
    assertNonEmptyResult(outcome, request.settings.label)
  } catch (error) {
    throw normalizeProviderError(request, error)
  }
}

async function openProviderResponse(
  options: ProviderStreamOptions,
  request: ProviderStreamRequest,
): Promise<{ adapter: ProviderAdapter; body: ReadableStream<Uint8Array> }> {
  assertNotStopped(request.signal)
  const adapter = selectProviderAdapter(options.providerAdapters, request.settings)
  if (!adapter) {
    throw new ProviderRequestError('protocol', `${request.settings.label} 找不到可用的 Provider adapter。`)
  }
  if (request.tools.length && !adapter.supportsTools) {
    throw new ProviderRequestError('unsupported-tools', `${request.settings.label} 当前配置暂不支持工具调用。`)
  }

  const providerRequest = adapter.createRequest({ ...request, stream: true })
  const response = await options.httpAdapter.send({
    body: JSON.stringify(providerRequest.body),
    headers: providerRequest.headers,
    signal: request.signal,
    url: providerRequest.url,
  })
  assertNotStopped(request.signal)
  await assertSuccessfulResponse(response, request.settings.label)
  if (!response.body) {
    throw new ProviderRequestError('protocol', '当前环境不支持流式响应读取。')
  }
  return { adapter, body: response.body }
}

async function* consumeProviderResponse(options: {
  adapter: ProviderAdapter
  body: ReadableStream<Uint8Array>
  request: ProviderStreamRequest
}): AsyncGenerator<ProviderStreamEvent, StreamOutcome> {
  const state = options.adapter.createStreamState(options.request.settings)
  const outcome: StreamOutcome = { hasContent: false, hasToolCalls: false }

  for await (const rawEvent of decodeSseEvents(options.body, options.request.signal)) {
    assertNotStopped(options.request.signal)
    const result = collectEvents(options.adapter.parseSseEvent, rawEvent, state, options.request.tools.length > 0)
    for (const event of result.events) {
      updateOutcome(outcome, event)
      yield event
    }
    if (result.terminal) return outcome
  }
  return outcome
}

async function* decodeSseEvents(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal | undefined,
): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let completed = false
  try {
    while (true) {
      const chunk = await readWithAbort(reader, signal)
      if (chunk.done) {
        completed = true
        break
      }
      buffer += decoder.decode(chunk.value, { stream: true })
      const consumed = consumeSseBuffer(buffer)
      buffer = consumed.rest
      yield* consumed.events
    }
    const trailing = extractEventPayload(buffer)
    if (trailing) yield trailing
  } finally {
    try {
      if (!completed) await reader.cancel()
    } finally {
      reader.releaseLock()
    }
  }
}

function readWithAbort(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal | undefined,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (!signal) return reader.read()
  if (signal.aborted) return Promise.reject(new ProviderStreamStoppedError())
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new ProviderStreamStoppedError())
    signal.addEventListener('abort', onAbort, { once: true })
    reader.read().then(
      (result) => {
        signal.removeEventListener('abort', onAbort)
        resolve(result)
      },
      (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

function collectEvents(
  parse: ProviderAdapter['parseSseEvent'],
  rawEvent: string,
  state: ProviderStreamState,
  acceptsTools: boolean,
): { events: ProviderStreamEvent[]; terminal: boolean } {
  const events: ProviderStreamEvent[] = []
  for (const delta of parse(rawEvent, state)) {
    if (delta.type === 'done') return { events, terminal: true }
    if (delta.type === 'tool-calls') {
      validateToolCalls(delta.calls, acceptsTools)
      return { events: [...events, delta], terminal: true }
    }
    events.push(delta)
  }
  return { events, terminal: false }
}

function updateOutcome(outcome: StreamOutcome, event: ProviderStreamEvent): void {
  if (event.type === 'content') outcome.hasContent = true
  if (event.type === 'tool-calls') outcome.hasToolCalls = true
}

function validateToolCalls(calls: NormalizedToolCall[], acceptsTools: boolean): void {
  if (!acceptsTools) {
    throw new ProviderRequestError('protocol', '当前请求未提供工具定义，却收到了工具调用。')
  }
  if (!calls.length) {
    throw new ProviderRequestError('protocol', 'Provider 返回了空工具调用批次。')
  }

  const ids = new Set<string>()
  for (const call of calls) {
    assertValidToolCall(call, ids)
    ids.add(call.id)
  }
}

function assertValidToolCall(call: NormalizedToolCall, ids: Set<string>): void {
  if (!call.id.trim() || !call.name.trim()) {
    throw new ProviderRequestError('protocol', 'Provider 返回的工具调用缺少标识或名称。')
  }
  if (ids.has(call.id)) {
    throw new ProviderRequestError('protocol', 'Provider 返回了重复的工具调用标识。')
  }
  try {
    JSON.parse(call.argumentsJson)
  } catch (error) {
    throw new ProviderRequestError('protocol', `Provider 返回的工具参数无法解析：${call.name}`, error)
  }
}

function assertNonEmptyResult(outcome: StreamOutcome, label: string): void {
  if (!outcome.hasContent && !outcome.hasToolCalls) {
    throw new ProviderRequestError('empty-result', `${label} 未返回可用内容。`)
  }
}

async function assertSuccessfulResponse(response: HttpResponse, label: string): Promise<void> {
  if (response.status >= 200 && response.status < 300) return
  throw new ProviderRequestError('http', await createHttpFailureMessage(label, response))
}

async function createHttpFailureMessage(label: string, response: HttpResponse): Promise<string> {
  const detail = await readResponseDetail(response.body)
  if (containsImageInputUnsupportedError(detail)) {
    return `${label} 当前模型仅支持文本输入，不支持图片。请切换支持图片的供应商后再发送。`
  }
  const statusText = response.statusText.trim()
  if (!detail) return statusText ? `${label} 请求失败：${response.status} ${statusText}` : `${label} 请求失败：${response.status}`
  return `${label} 请求失败：${response.status} ${detail}`
}

async function readResponseDetail(body: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!body) return ''
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      text += decoder.decode(chunk.value, { stream: true })
    }
  } finally {
    reader.releaseLock()
  }
  return formatResponseDetail(text)
}

function formatResponseDetail(text: string): string {
  const normalized = text.trim()
  if (!normalized) return ''
  try {
    const payload = JSON.parse(normalized) as Record<string, unknown>
    const error = typeof payload.error === 'object' && payload.error !== null
      ? payload.error as Record<string, unknown>
      : {}
    const values = [error.message, error.code, payload.message, payload.code]
      .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    return [...new Set(values.map((value) => value.trim()))].join(' ')
  } catch {
    return normalized.slice(0, 500)
  }
}

function containsImageInputUnsupportedError(detail: string): boolean {
  const normalized = detail.toLowerCase()
  return normalized.includes('unknown variant `image_url`') || normalized.includes('does not support image')
}

function assertNotStopped(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new ProviderStreamStoppedError()
}

function normalizeProviderError(request: ProviderStreamRequest, error: unknown): Error {
  if (request.signal?.aborted) return new ProviderStreamStoppedError(error)
  if (error instanceof ProviderRequestError || error instanceof ProviderStreamStoppedError) return error
  const detail = error instanceof Error && error.message.trim() ? error.message.trim() : '响应协议异常。'
  return new ProviderRequestError('protocol', `${request.settings.label} 请求失败：${detail}`, error)
}
