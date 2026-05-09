export interface TavilySearchRequest {
  query: string
  topic?: 'finance' | 'general' | 'news'
  timeRange?: 'day' | 'month' | 'week' | 'year'
}

export interface TavilySearchResult {
  title: string
  url: string
  content: string
  score: number
}

export interface TavilySearchResponse {
  query: string
  results: TavilySearchResult[]
}

interface TavilyRawResponse {
  query?: string
  results?: Array<{
    content?: string
    score?: number
    title?: string
    url?: string
  }>
}

const TAVILY_SEARCH_URL = 'https://api.tavily.com/search'
const TIME_RANGE_TO_DAYS: Record<NonNullable<TavilySearchRequest['timeRange']>, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
}

export async function searchWithTavily(
  request: TavilySearchRequest,
  apiKey: string,
  signal?: AbortSignal,
): Promise<TavilySearchResponse> {
  const query = request.query.trim()
  if (!query) {
    throw new Error('tavily_search 参数错误：query 不能为空。')
  }

  if (!apiKey.trim()) {
    throw new Error('Tavily API Key 缺失。')
  }

  const body: Record<string, unknown> = {
    query,
    search_depth: 'basic',
    max_results: 5,
    include_answer: false,
    include_raw_content: false,
    include_favicon: true,
    topic: request.topic ?? 'general',
  }

  const days = request.timeRange ? TIME_RANGE_TO_DAYS[request.timeRange] : undefined
  if (days) {
    body.days = days
  }

  const response = await fetch(TAVILY_SEARCH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    throw new Error(`Tavily 搜索失败：HTTP ${response.status}`)
  }

  const payload = await response.json() as TavilyRawResponse
  return compactTavilyResponse(query, payload)
}

function compactTavilyResponse(query: string, payload: TavilyRawResponse): TavilySearchResponse {
  return {
    query: payload.query?.trim() || query,
    results: (payload.results ?? []).map((result) => ({
      title: result.title?.trim() ?? '',
      url: result.url?.trim() ?? '',
      content: result.content?.trim() ?? '',
      score: typeof result.score === 'number' ? result.score : 0,
    })),
  }
}
