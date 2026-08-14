import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeImageWithQwen } from './qwenClient'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('qwenClient', () => {
  it('calls the DashScope vision endpoint with the local data URL', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '识别结果' } }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    await expect(analyzeImageWithQwen({
      apiKey: 'qwen-key',
      imageDataUrl: 'data:image/png;base64,image',
      model: 'qwen3-vl-flash',
      prompt: '请识别文字',
      systemPrompt: 'OCR',
    })).resolves.toBe('识别结果')

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer qwen-key' }),
      }),
    )
    const request = JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string)
    expect(request.model).toBe('qwen3-vl-flash')
    expect(request.enable_thinking).toBe(false)
    expect(request.thinking).toBeUndefined()
    expect(request.messages[0]).toEqual({ content: 'OCR', role: 'system' })
    expect(request.messages[1].content[0].image_url.url).toBe('data:image/png;base64,image')
  })

  it('rejects non-HTTPS service addresses before sending credentials', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await expect(analyzeImageWithQwen({
      apiKey: 'qwen-key',
      baseUrl: 'http://example.com/qwen',
      imageDataUrl: 'data:image/png;base64,image',
      model: 'qwen3-vl-flash',
      prompt: '请识别文字',
      systemPrompt: 'OCR',
    })).rejects.toThrow('必须使用 HTTPS')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('appends chat completions to a DashScope v1 base address', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '识别结果' } }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    await analyzeImageWithQwen({
      apiKey: 'qwen-key',
      baseUrl: 'https://llm-example.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
      imageDataUrl: 'data:image/png;base64,image',
      model: 'qwen3-vl-flash',
      prompt: '请识别文字',
      systemPrompt: 'OCR',
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://llm-example.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions',
      expect.anything(),
    )
  })

  it('surfaces API errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: 'invalid key' },
    }), { status: 401 })))

    await expect(analyzeImageWithQwen({
      apiKey: 'qwen-key',
      imageDataUrl: 'data:image/png;base64,image',
      model: 'qwen3-vl-flash',
      prompt: '请识别文字',
      systemPrompt: 'OCR',
    })).rejects.toThrow('阿里云 Qwen 图片分析失败：HTTP 401：invalid key')
  })
})
