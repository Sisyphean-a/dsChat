import type { AiTool } from '../ai/toolTypes'
import { searchWithTavily, type TavilySearchRequest } from './tavilyClient'

const TOPICS = ['general', 'news', 'finance'] as const
const TIME_RANGES = ['day', 'week', 'month', 'year'] as const

export const tavilySearchTool: AiTool = {
  definition: {
    type: 'function',
    function: {
      name: 'tavily_search',
      description: '检索最新网页信息并返回高相关摘要。',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '要搜索的问题或关键词。',
          },
          topic: {
            type: 'string',
            enum: [...TOPICS],
            description: '搜索主题，可选 general/news/finance。',
          },
          timeRange: {
            type: 'string',
            enum: [...TIME_RANGES],
            description: '时间范围，可选 day/week/month/year。',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  async execute(args, context) {
    const parsed = parseTavilySearchArgs(args)
    const result = await searchWithTavily(parsed, context.settings.tavilyApiKey, context.signal)

    return {
      content: JSON.stringify({
        query: result.query,
        results: result.results.map((item) => ({
          title: item.title,
          url: item.url,
          content: item.content,
          score: item.score,
        })),
      }),
      metadata: {
        query: parsed.query,
      },
    }
  },
}

function parseTavilySearchArgs(args: unknown): TavilySearchRequest {
  if (typeof args !== 'object' || args === null) {
    throw new Error('tavily_search 参数错误：需要对象参数。')
  }

  const payload = args as {
    query?: unknown
    topic?: unknown
    timeRange?: unknown
  }

  if (typeof payload.query !== 'string' || !payload.query.trim()) {
    throw new Error('tavily_search 参数错误：query 必须是非空字符串。')
  }

  if (payload.topic !== undefined && !TOPICS.includes(payload.topic as (typeof TOPICS)[number])) {
    throw new Error('tavily_search 参数错误：topic 仅支持 general/news/finance。')
  }

  if (
    payload.timeRange !== undefined
    && !TIME_RANGES.includes(payload.timeRange as (typeof TIME_RANGES)[number])
  ) {
    throw new Error('tavily_search 参数错误：timeRange 仅支持 day/week/month/year。')
  }

  return {
    query: payload.query.trim(),
    topic: payload.topic as TavilySearchRequest['topic'] | undefined,
    timeRange: payload.timeRange as TavilySearchRequest['timeRange'] | undefined,
  }
}
