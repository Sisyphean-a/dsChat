import { afterEach, describe, expect, it, vi } from 'vitest'
import { tavilySearchTool } from './tavilySearchTool'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('tavilySearchTool', () => {
  it('throws when query is missing', async () => {
    await expect(
      tavilySearchTool.execute({}, {
        settings: {
          enabled: true,
          tavilyApiKey: 'tvly-key',
          maxToolRounds: 3,
        },
      }),
    ).rejects.toThrow('tavily_search 参数错误：query 必须是非空字符串。')
  })

  it('throws when topic/timeRange is invalid', async () => {
    await expect(
      tavilySearchTool.execute(
        { query: 'weather', topic: 'sports', timeRange: 'hour' },
        {
          settings: {
            enabled: true,
            tavilyApiKey: 'tvly-key',
            maxToolRounds: 3,
          },
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
        settings: {
          enabled: true,
          tavilyApiKey: 'tvly-key',
          maxToolRounds: 3,
        },
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
