import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchWithTavily } from './tavilyClient'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('searchWithTavily', () => {
  it('calls tavily with expected url headers and body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      query: 'test',
      results: [],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    await searchWithTavily(
      {
        query: 'test',
        topic: 'news',
        timeRange: 'week',
      },
      'tvly-key',
    )

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tvly-key',
          'Content-Type': 'application/json',
        }),
      }),
    )

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body).toMatchObject({
      query: 'test',
      topic: 'news',
      days: 7,
      search_depth: 'basic',
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
      include_favicon: true,
    })
  })

  it('throws explicit status code when tavily responds non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('denied', { status: 429 })))

    await expect(
      searchWithTavily({ query: 'test' }, 'tvly-key'),
    ).rejects.toThrow('Tavily 搜索失败：HTTP 429')
  })

  it('keeps only compact fields from tavily response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      query: 'weather',
      results: [{
        title: 't',
        url: 'u',
        content: 'c',
        score: 0.88,
        raw_content: 'large',
      }],
    }), { status: 200 })))

    const result = await searchWithTavily({ query: 'weather' }, 'tvly-key')
    expect(result).toEqual({
      query: 'weather',
      results: [{
        title: 't',
        url: 'u',
        content: 'c',
        score: 0.88,
      }],
    })
  })
})
