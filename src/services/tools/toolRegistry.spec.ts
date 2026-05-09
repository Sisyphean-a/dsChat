import { describe, expect, it } from 'vitest'
import { getEnabledTools, getRegisteredTools } from './toolRegistry'

describe('toolRegistry', () => {
  it('registers current time and tavily tools', () => {
    const names = getRegisteredTools().map((item) => item.definition.function.name)
    expect(names).toEqual(['get_current_time', 'tavily_search'])
  })

  it('enables current time tool when tool calling is enabled', () => {
    const names = getEnabledTools(createToolSettings({
      builtinTools: {
        currentTime: { enabled: true },
        tavilySearch: { enabled: false, apiKey: '' },
      },
    })).map((item) => item.definition.function.name)

    expect(names).toEqual(['get_current_time'])
  })

  it('throws when tavily_search is enabled but api key is missing', () => {
    expect(() => getEnabledTools(createToolSettings({
      builtinTools: {
        currentTime: { enabled: true },
        tavilySearch: { enabled: true, apiKey: '' },
      },
    }))).toThrow('请先填写 Tavily API Key。')
  })

  it('enables tavily search when tavily key is provided', () => {
    const names = getEnabledTools(createToolSettings({
      builtinTools: {
        currentTime: { enabled: true },
        tavilySearch: { enabled: true, apiKey: 'tvly-key' },
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
})

function createToolSettings(
  overrides: Partial<{
    builtinTools: {
      currentTime: { enabled: boolean }
      tavilySearch: { enabled: boolean; apiKey: string }
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
  }> = {},
) {
  return {
    enabled: true,
    maxToolRounds: 3,
    builtinTools: overrides.builtinTools ?? {
      currentTime: {
        enabled: true,
      },
      tavilySearch: {
        enabled: true,
        apiKey: 'tvly-key',
      },
    },
    customTools: overrides.customTools ?? [],
  }
}
