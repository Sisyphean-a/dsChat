import { describe, expect, it } from 'vitest'
import { buildSystemPrompt, DEFAULT_SYSTEM_PROMPT } from './systemPrompt'

const tools = [{
  type: 'function' as const,
  function: {
    name: 'qwen_analyze_image',
    description: '通用图片分析。',
    parameters: {},
  },
}]

describe('systemPrompt', () => {
  it('builds the default prompt with current capabilities and custom rules', () => {
    const result = buildSystemPrompt({
      attachments: [{
        dataUrl: 'data:image/png;base64,image',
        height: 10,
        id: 'image-1',
        mimeType: 'image/png',
        name: 'screen.png',
        size: 10,
        type: 'image',
        width: 10,
      }],
      customPrompt: '回答要简短',
      directImageInput: false,
      imageToolAvailable: true,
      nativeWebSearch: true,
      tools,
    })

    expect(result).toContain(DEFAULT_SYSTEM_PROMPT)
    expect(result).toContain('attachment_id：image-1')
    expect(result).toContain('原生联网搜索')
    expect(result).toContain('qwen_analyze_image：通用图片分析。')
    expect(result).toContain('回答要简短')
  })

  it('states when a Responses request has no local tool round', () => {
    const result = buildSystemPrompt({
      attachments: [],
      customPrompt: '',
      directImageInput: false,
      imageToolAvailable: false,
      nativeWebSearch: true,
      tools: [],
    })

    expect(result).toContain('不运行本地工具轮次')
  })

  it('does not expose image attachment instructions without image capability', () => {
    const result = buildSystemPrompt({
      attachments: [{
        dataUrl: 'data:image/png;base64,image',
        height: 10,
        id: 'image-1',
        mimeType: 'image/png',
        name: 'screen.png',
        size: 10,
        type: 'image',
        width: 10,
      }],
      customPrompt: '',
      directImageInput: false,
      imageToolAvailable: false,
      nativeWebSearch: false,
      tools: [],
    })

    expect(result).toContain('没有可用的图片理解能力')
    expect(result).not.toContain('必须调用图片工具')
  })
})
