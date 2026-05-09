import { afterEach, describe, expect, it, vi } from 'vitest'
import { tavilySearchTool } from './tavilySearchTool'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('tavilySearchTool', () => {
  it('throws when query is missing', async () => {
    await expect(
      tavilySearchTool.execute({}, {
        settings: createToolSettings(),
      }),
    ).rejects.toThrow('tavily_search 参数错误：query 必须是非空字符串。')
  })

  it('throws when topic/timeRange is invalid', async () => {
    await expect(
      tavilySearchTool.execute(
        { query: 'weather', topic: 'sports', timeRange: 'hour' },
        {
          settings: createToolSettings(),
        },
      ),
    ).rejects.toThrow('tavily_search 参数错误：topic 仅支持 general/news/finance。')
  })

  it('returns compact json string for model context', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      query: 'weather',
      results: [{
        title: 'Title',
        url: 'https://example.com',
        content: 'summary',
        score: 0.9,
      }],
    }), { status: 200 })))

    const result = await tavilySearchTool.execute(
      { query: 'weather', topic: 'general' },
      {
        settings: createToolSettings(),
      },
    )

    expect(JSON.parse(result.content)).toEqual({
      query: 'weather',
      results: [{
        title: 'Title',
        url: 'https://example.com',
        content: 'summary',
        score: 0.9,
      }],
    })
  })
})

function createToolSettings() {
  return {
    enabled: true,
    maxToolRounds: 3,
    builtinTools: {
      currentTime: {
        enabled: true,
      },
      tavilySearch: {
        enabled: true,
        apiKey: 'tvly-key',
      },
    },
    customTools: [],
  }
}
