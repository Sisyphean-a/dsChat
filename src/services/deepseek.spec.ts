import { afterEach, describe, expect, it, vi } from 'vitest'
import { consumeSseBuffer, streamChatCompletion } from './deepseek'

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

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: stream,
      }),
    )

    const content = await streamChatCompletion(
      [{ id: '1', role: 'user', content: 'test', createdAt: 0, status: 'done' }],
      { apiKey: 'sk-test', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', temperature: 1, theme: 'light' },
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

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: stream,
      }),
    )

    await expect(
      streamChatCompletion(
        [{ id: '1', role: 'user', content: 'test', createdAt: 0, status: 'done' }],
        { apiKey: 'sk-test', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', temperature: 1, theme: 'light' },
        vi.fn(),
      ),
    ).rejects.toThrow('DeepSeek 未返回可用内容。')
  })

  it('parses reasoning deltas separately from final content', async () => {
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

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: stream,
      }),
    )

    const content = await streamChatCompletion(
      [{ id: '1', role: 'user', content: 'test', createdAt: 0, status: 'done' }],
      { apiKey: 'sk-test', baseUrl: 'https://api.deepseek.com', model: 'deepseek-reasoner', temperature: 1, theme: 'light' },
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

  it('sends temperature for non-reasoner models', async () => {
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
      { apiKey: 'sk-test', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', temperature: 1.4, theme: 'light' },
      vi.fn(),
    )

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body.temperature).toBe(1.4)
  })
})
