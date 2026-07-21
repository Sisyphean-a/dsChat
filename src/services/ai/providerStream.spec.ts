import { describe, expect, it, vi } from 'vitest'
import { getDefaultProviderCapabilities } from '../../constants/providerCapabilities'
import type { HttpAdapter } from './httpAdapter'
import { createProviderStream, ProviderStreamStoppedError } from './providerStream'
import { defaultProviderAdapterRegistry } from './providerAdapter'

describe('ProviderStream', () => {
  it('preserves status, reasoning, and text order across split SSE chunks', async () => {
    const stream = createProviderStream({
      httpAdapter: memoryHttp([
        'data: {"choices":[{"delta":{"reasoning_content":"先思考"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"再回答"}}]}\n\ndata: [DONE]\n\n',
      ]),
      providerAdapters: defaultProviderAdapterRegistry,
    })

    await expect(collect(stream.stream(request()))).resolves.toEqual([
      { type: 'reasoning', content: '先思考' },
      { type: 'content', content: '再回答' },
    ])
  })

  it('uses the Responses adapter under the same stream contract', async () => {
    const stream = createProviderStream({
      httpAdapter: memoryHttp(['data: {"type":"response.output_text.delta","delta":"OpenAI 回答"}\n\ndata: {"type":"response.completed"}\n\n']),
      providerAdapters: defaultProviderAdapterRegistry,
    })

    await expect(collect(stream.stream(request({
      settings: {
        ...request().settings,
        baseUrl: 'https://api.openai.com/v1',
        capabilities: getDefaultProviderCapabilities('openai'),
        label: 'OpenAI',
        model: 'gpt-5.5',
        provider: 'openai',
      },
    })))).resolves.toEqual([{ type: 'content', content: 'OpenAI 回答' }])
  })

  it('fails an empty stream with a stable code', async () => {
    const stream = createProviderStream({
      httpAdapter: memoryHttp(['data: [DONE]\n\n']),
      providerAdapters: defaultProviderAdapterRegistry,
    })

    await expect(collect(stream.stream(request()))).rejects.toMatchObject({
      code: 'empty-result',
    })
  })

  it('does not send a request when already stopped', async () => {
    const adapter = memoryHttp(['data: [DONE]\n\n'])
    const stream = createProviderStream({ httpAdapter: adapter, providerAdapters: defaultProviderAdapterRegistry })
    const controller = new AbortController()
    controller.abort()

    await expect(collect(stream.stream(request({ signal: controller.signal })))).rejects.toBeInstanceOf(ProviderStreamStoppedError)
    expect(adapter.send).not.toHaveBeenCalled()
  })

  it('stops while waiting for an unread SSE chunk', async () => {
    let closeStream: (() => void) | undefined
    const stream = createProviderStream({
      httpAdapter: {
        send: async () => ({
          body: new ReadableStream<Uint8Array>({
            start(controller) { closeStream = () => controller.close() },
          }),
          status: 200,
          statusText: 'OK',
        }),
      },
      providerAdapters: defaultProviderAdapterRegistry,
    })
    const controller = new AbortController()
    const pending = collect(stream.stream(request({ signal: controller.signal })))

    controller.abort()
    await expect(pending).rejects.toBeInstanceOf(ProviderStreamStoppedError)
    closeStream?.()
  })

  it('rejects malformed protocol events', async () => {
    const stream = createProviderStream({
      httpAdapter: memoryHttp(['data: {broken}\n\n']),
      providerAdapters: defaultProviderAdapterRegistry,
    })

    await expect(collect(stream.stream(request()))).rejects.toMatchObject({
      code: 'protocol',
    })
  })

  it('returns an http failure code', async () => {
    const stream = createProviderStream({
      httpAdapter: {
        send: async () => ({ body: bytes(['{"error":{"message":"bad key"}}']), status: 401, statusText: 'Unauthorized' }),
      },
      providerAdapters: defaultProviderAdapterRegistry,
    })

    await expect(collect(stream.stream(request()))).rejects.toMatchObject({
      code: 'http',
    })
  })
})

function request(overrides: Partial<Parameters<ReturnType<typeof createProviderStream>['stream']>[0]> = {}) {
  return {
    messages: [{ content: '你好', role: 'user' as const }],
    settings: {
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com',
      capabilities: getDefaultProviderCapabilities('deepseek'),
      configId: 'deepseek',
      label: 'DeepSeek',
      model: 'deepseek-v4-flash',
      modelOptions: ['deepseek-v4-flash'],
      provider: 'deepseek' as const,
      temperature: 1,
    },
    thinkingEnabled: true,
    tools: [],
    ...overrides,
  }
}

function memoryHttp(parts: string[]): HttpAdapter & { send: ReturnType<typeof vi.fn> } {
  return {
    send: vi.fn(async () => ({ body: bytes(parts), status: 200, statusText: 'OK' })),
  }
}

function bytes(parts: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part))
      controller.close()
    },
  })
}

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = []
  for await (const item of stream) result.push(item)
  return result
}
