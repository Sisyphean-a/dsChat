import { afterEach, describe, expect, it, vi } from 'vitest'
import { consumeSseBuffer, streamChatCompletion } from './chatCompletion'
import type { ActiveProviderSettings } from '../types/chat'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('consumeSseBuffer', () => {
  it('returns full data events and preserves trailing partial frame', () => {
    const raw = [
      'data: {"choices":[{"delta":{"content":"你"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"好"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"半',
    ].join('\n')

    const result = consumeSseBuffer(raw)

    expect(result.events).toEqual([
      '{"choices":[{"delta":{"content":"你"}}]}',
      '{"choices":[{"delta":{"content":"好"}}]}',
    ])
    expect(result.rest).toBe('data: {"choices":[{"delta":{"content":"半')
  })

  it('supports CRLF SSE frames', () => {
    const raw = 'data: {"choices":[{"delta":{"content":"测"}}]}\r\n\r\ndata: [DONE]\r\n\r\n'

    const result = consumeSseBuffer(raw)

    expect(result.events).toEqual(['{"choices":[{"delta":{"content":"测"}}]}', '[DONE]'])
    expect(result.rest).toBe('')
  })
})

describe('streamChatCompletion', () => {
  it('flushes the final SSE frame even when the stream ends without a blank separator', async () => {
    const encoder = new TextEncoder()
    const deltas: string[] = []

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"尾"}}]}'))
        controller.close()
      },
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: stream }))

    const content = await streamChatCompletion(
      [{ id: '1', role: 'user', content: 'test', createdAt: 0, status: 'done' }],
      createSettings(),
      (delta) => {
        deltas.push(delta.content ?? '')
      },
    )

    expect(content).toBe('尾')
    expect(deltas).toEqual(['尾'])
  })

  it('throws when the stream finishes without any content delta', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: stream }))

    await expect(
      streamChatCompletion(
        [{ id: '1', role: 'user', content: 'test', createdAt: 0, status: 'done' }],
        createSettings(),
        vi.fn(),
      ),
    ).rejects.toThrow('DeepSeek 未返回可用内容。')
  })

  it('parses deepseek reasoning deltas separately from final content', async () => {
    const encoder = new TextEncoder()
    const deltas: Array<{ content?: string; reasoningContent?: string }> = []

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode([
          'data: {"choices":[{"delta":{"reasoning_content":"先分析"}}]}',
          '',
          'data: {"choices":[{"delta":{"content":"再回答"}}]}',
          '',
          'data: [DONE]',
          '',
        ].join('\n')))
        controller.close()
      },
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: stream }))

    const content = await streamChatCompletion(
      [{ id: '1', role: 'user', content: 'test', createdAt: 0, status: 'done' }],
      createSettings({ model: 'deepseek-reasoner' }),
      (delta) => {
        deltas.push(delta)
      },
    )

    expect(content).toBe('再回答')
    expect(deltas).toEqual([
      { reasoningContent: '先分析' },
      { content: '再回答' },
    ])
  })

  it('parses minimax cumulative content and reasoning deltas', async () => {
    const encoder = new TextEncoder()
    const deltas: Array<{ content?: string; reasoningContent?: string }> = []

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode([
          'data: {"choices":[{"delta":{"reasoning_details":[{"text":"先思考"}]}}]}',
          '',
          'data: {"choices":[{"delta":{"reasoning_details":[{"text":"先思考再补充"}]}}]}',
          '',
          'data: {"choices":[{"delta":{"content":"第一段"}}]}',
          '',
          'data: {"choices":[{"delta":{"content":"第一段第二段"}}]}',
          '',
          'data: [DONE]',
          '',
        ].join('\n')))
        controller.close()
      },
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: stream }))

    const content = await streamChatCompletion(
      [{ id: '1', role: 'user', content: 'test', createdAt: 0, status: 'done' }],
      createSettings(
        {
          baseUrl: 'https://api.minimaxi.com/v1',
          model: 'MiniMax-M2.7',
        },
        'minimax',
      ),
      (delta) => {
        deltas.push(delta)
      },
    )

    expect(content).toBe('第一段第二段')
    expect(deltas).toEqual([
      { reasoningContent: '先思考' },
      { reasoningContent: '再补充' },
      { content: '第一段' },
      { content: '第二段' },
    ])
  })

  it('sends temperature for models that support it', async () => {
    const encoder = new TextEncoder()
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"好"}}]}\n\ndata: [DONE]\n\n'))
          controller.close()
        },
      }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    await streamChatCompletion(
      [{ id: '1', role: 'user', content: 'test', createdAt: 0, status: 'done' }],
      createSettings({ temperature: 1.4 }),
      vi.fn(),
    )

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body.temperature).toBe(1.4)
  })

  it('adds reasoning_split for minimax requests', async () => {
    const encoder = new TextEncoder()
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"好"}}]}\n\ndata: [DONE]\n\n'))
          controller.close()
        },
      }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    await streamChatCompletion(
      [{ id: '1', role: 'user', content: 'test', createdAt: 0, status: 'done' }],
      createSettings(
        {
          baseUrl: 'https://api.minimaxi.com/v1',
          model: 'MiniMax-M2.7',
        },
        'minimax',
      ),
      vi.fn(),
    )

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body.reasoning_split).toBe(true)
  })
})

function createSettings(
  overrides: Partial<ActiveProviderSettings> = {},
  provider: ActiveProviderSettings['provider'] = 'deepseek',
): ActiveProviderSettings {
  const defaults: Record<ActiveProviderSettings['provider'], ActiveProviderSettings> = {
    claude: {
      provider: 'claude',
      apiKey: 'sk-ant-test',
      baseUrl: 'https://api.anthropic.com/v1',
      model: 'claude-sonnet-4-20250514',
      temperature: 1,
    },
    deepseek: {
      provider: 'deepseek',
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      temperature: 1,
    },
    minimax: {
      provider: 'minimax',
      apiKey: 'sk-test',
      baseUrl: 'https://api.minimaxi.com/v1',
      model: 'MiniMax-M2.7',
      temperature: 1,
    },
    openai: {
      provider: 'openai',
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
      temperature: 1,
    },
  }

  return {
    ...defaults[provider],
    ...overrides,
    provider,
  }
}
