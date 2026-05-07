import { afterEach, describe, expect, it, vi } from 'vitest'
import { consumeSseBuffer, requestChatCompletion, streamChatCompletion } from './chatCompletion'
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
          label: 'MiniMax',
          provider: 'minimax',
          baseUrl: 'https://api.minimaxi.com/v1',
          model: 'MiniMax-M2.7',
        },
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
          controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"好"}\n\ndata: {"type":"response.completed"}\n\n'))
          controller.close()
        },
      }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    await streamChatCompletion(
      [{ id: '1', role: 'user', content: 'test', createdAt: 0, status: 'done' }],
      createSettings({
        label: 'OpenAI',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5.5',
        temperature: 1.4,
      }),
      vi.fn(),
    )

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body.temperature).toBe(1.4)
  })

  it('enables OpenAI web search tool in auto mode for gpt-5.5', async () => {
    const encoder = new TextEncoder()
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"已联网"}\n\ndata: {"type":"response.completed"}\n\n'))
          controller.close()
        },
      }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    await streamChatCompletion(
      [{ id: '1', role: 'user', content: '查一下今天新闻', createdAt: 0, status: 'done' }],
      createSettings({
        label: 'OpenAI',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5.5',
        temperature: 1.4,
      }),
      vi.fn(),
    )

    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe('https://api.openai.com/v1/responses')
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body.tool_choice).toBe('auto')
    expect(body.tools).toEqual([{ type: 'web_search' }])
  })

  it('encodes assistant history as output_text for OpenAI responses input', async () => {
    const encoder = new TextEncoder()
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"继续"}\n\ndata: {"type":"response.completed"}\n\n'))
          controller.close()
        },
      }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    await streamChatCompletion(
      [
        { id: '1', role: 'user', content: '第一问', createdAt: 0, status: 'done' },
        { id: '2', role: 'assistant', content: '第一答', createdAt: 1, status: 'done' },
        { id: '3', role: 'user', content: '继续问', createdAt: 2, status: 'done' },
      ],
      createSettings({
        label: 'OpenAI',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5.5',
      }),
      vi.fn(),
    )

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body.input[1]).toEqual({
      role: 'assistant',
      content: [{ type: 'output_text', text: '第一答' }],
    })
  })

  it('emits OpenAI web_search progress states before answer deltas', async () => {
    const encoder = new TextEncoder()
    const deltas: Array<{ content?: string; streamingStatus?: string }> = []
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode([
            'data: {"type":"response.created"}',
            '',
            'data: {"type":"response.output_item.added","item":{"type":"web_search_call","status":"in_progress"}}',
            '',
            'data: {"type":"response.web_search_call.searching"}',
            '',
            'data: {"type":"response.output_item.done","item":{"type":"web_search_call","status":"completed","action":{"type":"search","query":"weather: Shanghai, China"}}}',
            '',
            'data: {"type":"response.output_item.added","item":{"type":"message","phase":"final_answer","role":"assistant"}}',
            '',
            'data: {"type":"response.output_text.delta","delta":"天气如下"}',
            '',
            'data: {"type":"response.completed"}',
            '',
          ].join('\n')))
          controller.close()
        },
      }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const content = await streamChatCompletion(
      [{ id: '1', role: 'user', content: '查下天气', createdAt: 0, status: 'done' }],
      createSettings({
        label: 'OpenAI',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5.5',
      }),
      (delta) => {
        deltas.push({
          content: delta.content,
          streamingStatus: delta.streamingStatus,
        })
      },
    )

    expect(content).toBe('天气如下')
    expect(deltas).toEqual([
      { streamingStatus: '正在处理请求...' },
      { streamingStatus: '正在发起联网搜索...' },
      { streamingStatus: '正在联网搜索...' },
      { streamingStatus: '已完成检索：weather: Shanghai, China' },
      { streamingStatus: '正在生成回答...' },
      { content: '天气如下', streamingStatus: '正在生成回答...' },
    ])
  })

  it('passes deepseek thinking payload and omits temperature while thinking is enabled', async () => {
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
      createSettings({ model: 'deepseek-v4-flash', temperature: 1.4 }),
      vi.fn(),
    )

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body.thinking).toEqual({ type: 'enabled' })
    expect(body.temperature).toBeUndefined()
  })

  it('keeps deepseek temperature only when thinking mode is disabled', async () => {
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
      createSettings({ model: 'deepseek-v4-flash', temperature: 1.4 }),
      vi.fn(),
      undefined,
      { thinkingEnabled: false },
    )

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body.thinking).toEqual({ type: 'disabled' })
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
      createSettings({
        label: 'MiniMax',
        provider: 'minimax',
        baseUrl: 'https://api.minimaxi.com/v1',
        model: 'MiniMax-M2.7',
      }),
      vi.fn(),
    )

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body.reasoning_split).toBe(true)
  })

  it('allows turning minimax thinking mode off via reasoning_split=false', async () => {
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
      createSettings({
        label: 'MiniMax',
        provider: 'minimax',
        baseUrl: 'https://api.minimaxi.com/v1',
        model: 'MiniMax-M2.7',
      }),
      vi.fn(),
      undefined,
      { thinkingEnabled: false },
    )

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body.reasoning_split).toBe(false)
  })

  it('passes kimi thinking switch payload', async () => {
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
      createSettings({
        label: 'Kimi',
        provider: 'kimi',
        baseUrl: 'https://api.moonshot.cn/v1',
        model: 'kimi-k2.5',
      }),
      vi.fn(),
      undefined,
      { thinkingEnabled: false },
    )

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body.thinking).toEqual({ type: 'disabled' })
  })

  it('shows a clear message when provider rejects image_url payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({
        error: {
          message: 'Failed to deserialize the JSON body into the target type: messages[0]: unknown variant `image_url`, expected `text` at line 1 column 17702',
          type: 'invalid_request_error',
        },
      }), {
        status: 400,
        statusText: 'Bad Request',
      })),
    )

    await expect(
      streamChatCompletion(
        [{
          id: '1',
          role: 'user',
          content: '图里是什么',
          attachments: [{
            id: 'img-1',
            type: 'image',
            name: 'demo.png',
            mimeType: 'image/png',
            size: 100,
            width: 10,
            height: 10,
            dataUrl: 'data:image/png;base64,abc',
          }],
          createdAt: 0,
          status: 'done',
        }],
        createSettings(),
        vi.fn(),
      ),
    ).rejects.toThrow('DeepSeek 当前模型仅支持文本输入，不支持图片。请切换支持图片的供应商后再发送。')
  })

  it('sends multimodal content when user message contains image attachments', async () => {
    const encoder = new TextEncoder()
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"已收到"}}]}\n\ndata: [DONE]\n\n'))
          controller.close()
        },
      }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    await streamChatCompletion(
      [{
        id: '1',
        role: 'user',
        content: '请分析图片',
        attachments: [{
          id: 'img-1',
          type: 'image',
          name: 'demo.png',
          mimeType: 'image/png',
          size: 100,
          width: 10,
          height: 10,
          dataUrl: 'data:image/png;base64,abc',
        }],
        createdAt: 0,
        status: 'done',
      }],
      createSettings(),
      vi.fn(),
    )

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body.messages[0]).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: '请分析图片' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } },
      ],
    })
  })

  it('uses responses input_image payload for OpenAI image attachments', async () => {
    const encoder = new TextEncoder()
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"ok"}\n\ndata: {"type":"response.completed"}\n\n'))
          controller.close()
        },
      }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    await streamChatCompletion(
      [{
        id: '1',
        role: 'user',
        content: '请分析图片',
        attachments: [{
          id: 'img-1',
          type: 'image',
          name: 'demo.png',
          mimeType: 'image/png',
          size: 100,
          width: 10,
          height: 10,
          dataUrl: 'data:image/png;base64,abc',
        }],
        createdAt: 0,
        status: 'done',
      }],
      createSettings({
        label: 'OpenAI',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5.5',
      }),
      vi.fn(),
    )

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body.input[0]).toEqual({
      role: 'user',
      content: [
        { type: 'input_text', text: '请分析图片' },
        { type: 'input_image', image_url: 'data:image/png;base64,abc' },
      ],
    })
  })
})

describe('requestChatCompletion', () => {
  it('reads output_text from OpenAI responses payload', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output_text: '标题输出',
    }), {
      status: 200,
      statusText: 'OK',
    }))
    vi.stubGlobal('fetch', fetchSpy)

    const content = await requestChatCompletion(
      [{ id: '1', role: 'user', content: '给我起标题', createdAt: 0, status: 'done' }],
      createSettings({
        label: 'OpenAI',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5.5',
      }),
    )

    expect(content).toBe('标题输出')
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe('https://api.openai.com/v1/responses')
  })
})

function createSettings(
  overrides: Partial<ActiveProviderSettings> = {},
): ActiveProviderSettings {
  const defaults: ActiveProviderSettings = {
    configId: 'deepseek',
    label: 'DeepSeek',
    provider: 'deepseek',
    apiKey: 'sk-test',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
    modelOptions: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    temperature: 1,
  }

  return {
    ...defaults,
    ...overrides,
    modelOptions: overrides.modelOptions ?? defaults.modelOptions,
  }
}
