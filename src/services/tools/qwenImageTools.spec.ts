import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildDefaultSettings } from '../../constants/providers'
import type { MessageAttachment } from '../../types/chat'
import { qwenAnalyzeImageTool, qwenDiagnoseErrorScreenshotTool, qwenExtractTextFromScreenshotTool } from './qwenImageTools'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('qwenImageTools', () => {
  it('resolves attachment_id at runtime and calls the OCR tool', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '文本结果' } }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const attachment = createAttachment()

    const result = await qwenExtractTextFromScreenshotTool.execute({
      attachment_id: attachment.id,
      programming_language: 'typescript',
      prompt: '提取代码',
    }, {
      attachments: [attachment],
      settings: createToolSettings(),
    })

    expect(result.content).toBe('文本结果')
    expect(result.metadata).toEqual({ attachmentId: attachment.id })
    expect(JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string).messages[1].content[0].image_url.url)
      .toBe(attachment.dataUrl)
  })

  it('rejects malformed image data instead of sending arbitrary content', async () => {
    const attachment = { ...createAttachment(), dataUrl: 'https://example.com/image.png' }

    await expect(qwenAnalyzeImageTool.execute({
      attachment_id: attachment.id,
      prompt: '分析图片',
    }, {
      attachments: [attachment],
      settings: createToolSettings(),
    })).rejects.toThrow('图片附件格式无效：image-1')
  })

  it('rejects unknown attachments instead of accepting arbitrary image sources', async () => {
    await expect(qwenAnalyzeImageTool.execute({
      attachment_id: 'not-found',
      prompt: '分析图片',
    }, {
      attachments: [],
      settings: createToolSettings(),
    })).rejects.toThrow('找不到图片附件：not-found')
  })

  it('includes diagnosis context in the delegated prompt', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '诊断结果' } }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const attachment = createAttachment()

    await qwenDiagnoseErrorScreenshotTool.execute({
      attachment_id: attachment.id,
      context: 'npm install 期间',
      prompt: '分析错误',
    }, {
      attachments: [attachment],
      settings: createToolSettings(),
    })

    const request = JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string)
    expect(request.messages[1].content[1].text).toContain('npm install 期间')
  })
})

function createAttachment(): MessageAttachment {
  return {
    dataUrl: 'data:image/png;base64,aW1hZ2U=',
    height: 10,
    id: 'image-1',
    mimeType: 'image/png',
    name: 'screen.png',
    size: 10,
    type: 'image',
    width: 10,
  }
}

function createToolSettings() {
  const settings = buildDefaultSettings()
  settings.toolSettings.enabled = true
  settings.toolSettings.builtinTools.qwenImage = {
    enabled: true,
    apiKey: 'qwen-key',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3-vl-flash',
  }
  return settings.toolSettings
}
