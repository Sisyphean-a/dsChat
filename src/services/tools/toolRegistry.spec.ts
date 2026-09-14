import { describe, expect, it } from 'vitest'
import type { MessageAttachment, ToolSettings } from '../../types/chat'
import { getEnabledTools, getRegisteredTools, getTurnTools } from './toolRegistry'

describe('toolRegistry', () => {
  it('registers current time, tavily, and Qwen image tools', () => {
    const names = getRegisteredTools().map((item) => item.definition.function.name)
    expect(names).toEqual([
      'get_current_time',
      'tavily_search',
      'qwen_extract_text_from_screenshot',
      'qwen_diagnose_error_screenshot',
      'qwen_analyze_image',
    ])
  })

  it('enables current time tool when tool calling is enabled', () => {
    const names = getEnabledTools(createToolSettings({
      builtinTools: {
        currentTime: { enabled: true },
        tavilySearch: { enabled: false, apiKey: '', baseUrl: 'https://api.tavily.com/search' },
      },
    })).map((item) => item.definition.function.name)

    expect(names).toEqual(['get_current_time'])
  })

  it('throws when tavily_search is enabled but api key is missing', () => {
    expect(() => getEnabledTools(createToolSettings({
      builtinTools: {
        currentTime: { enabled: true },
        tavilySearch: { enabled: true, apiKey: '', baseUrl: 'https://api.tavily.com/search' },
      },
    }))).toThrow('请先填写 Tavily API Key。')
  })

  it('enables tavily search when tavily key is provided', () => {
    const names = getEnabledTools(createToolSettings({
      builtinTools: {
        currentTime: { enabled: true },
        tavilySearch: { enabled: true, apiKey: 'tvly-key', baseUrl: 'https://api.tavily.com/search' },
      },
    })).map((item) => item.definition.function.name)

    expect(names).toEqual(['get_current_time', 'tavily_search'])
  })

  it('throws when custom tool is enabled before runtime support is implemented', () => {
    expect(() => getEnabledTools(createToolSettings({
      customTools: [{
        id: 'custom-1',
        name: '天气工具',
        description: '',
        enabled: true,
        method: 'POST',
        url: 'https://example.com/tool',
        headers: [],
      }],
    }))).toThrow('自定义工具暂未接入执行引擎：天气工具')
  })

  it('filters image-dependent tools when the turn has no attachments', () => {
    const settings = createToolSettings({
      builtinTools: {
        currentTime: { enabled: false },
        tavilySearch: { enabled: false, apiKey: '', baseUrl: 'https://api.tavily.com/search' },
      },
      qwenImage: { enabled: true, apiKey: 'qwen-key' },
    })

    expect(getTurnTools(settings, []).map((item) => item.definition.function.name)).toEqual([])
    expect(getTurnTools(settings, [createAttachment()]).map((item) => item.definition.function.name)).toEqual([
      'qwen_extract_text_from_screenshot',
      'qwen_diagnose_error_screenshot',
      'qwen_analyze_image',
    ])
  })

  it('resolves no tools when tool calling is disabled', () => {
    const settings = createToolSettings({
      builtinTools: {
        currentTime: { enabled: true },
        tavilySearch: { enabled: false, apiKey: '', baseUrl: 'https://api.tavily.com/search' },
      },
    })

    expect(getTurnTools({ ...settings, enabled: false }, [createAttachment()])).toEqual([])
  })
})

function createToolSettings(
  overrides: Partial<{
    builtinTools: {
      currentTime: { enabled: boolean }
      tavilySearch: { enabled: boolean; apiKey: string; baseUrl: string }
    }
    customTools: Array<{
      id: string
      name: string
      description: string
      enabled: boolean
      method: 'GET' | 'POST'
      url: string
      headers: Array<{ key: string; value: string }>
    }>
    qwenImage: { enabled: boolean; apiKey: string }
  }> = {},
) {
  return {
    enabled: true,
    builtinTools: {
      ...(overrides.builtinTools ?? {
        currentTime: {
          enabled: true,
        },
        tavilySearch: {
          enabled: true,
          apiKey: 'tvly-key',
          baseUrl: 'https://api.tavily.com/search',
        },
      }),
      qwenImage: {
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        enabled: false,
        model: 'qwen3-vl-flash',
        ...overrides.qwenImage,
      },
    },
    customTools: overrides.customTools ?? [],
  } as ToolSettings
}

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
