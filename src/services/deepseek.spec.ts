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
      { apiKey: 'sk-test', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
      (chunk) => {
        deltas.push(chunk)
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
        { apiKey: 'sk-test', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
        vi.fn(),
      ),
    ).rejects.toThrow('DeepSeek 未返回可用内容。')
  })
})
