import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ActiveProviderSettings, ChatMessage } from '../../types/chat'
import { streamWithToolOrchestrator } from './toolOrchestrator'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('streamWithToolOrchestrator', () => {
  it('returns direct answer when model does not call tools', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: createSseStream([
        'data: {"choices":[{"delta":{"content":"直接回答"}}]}',
        'data: [DONE]',
      ]),
    }))

    const deltas: string[] = []
    const content = await streamWithToolOrchestrator(
      [createUserMessage('你好')],
      createSettings(),
      (delta) => {
        if (delta.content) {
          deltas.push(delta.content)
        }
      },
      undefined,
      {
        thinkingEnabled: true,
        toolSettings: {
          enabled: true,
          tavilyApiKey: 'tvly-key',
          maxToolRounds: 3,
        },
      },
    )

    expect(content).toBe('直接回答')
    expect(deltas).toEqual(['直接回答'])
  })

  it('executes tavily tool call and continues to final answer', async () => {
    let providerRound = 0
    const fetchMock = vi.fn(async (url: string) => {
      if (url === 'https://api.tavily.com/search') {
        return new Response(JSON.stringify({
          query: 'weather',
          results: [{
            title: 'title',
            url: 'https://example.com',
            content: 'summary',
            score: 0.8,
          }],
        }), { status: 200 })
      }

      providerRound += 1
      if (providerRound === 1) {
        return {
          ok: true,
          body: createSseStream([
            'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"tavily_search","arguments":"{\\"query\\":\\"weather\\"}"}}]}}]}',
            'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
            'data: [DONE]',
          ]),
        }
      }

      return {
        ok: true,
        body: createSseStream([
          'data: {"choices":[{"delta":{"content":"天气如下"}}]}',
          'data: [DONE]',
        ]),
      }
    })

    vi.stubGlobal('fetch', fetchMock)

    const statuses: string[] = []
    const content = await streamWithToolOrchestrator(
      [createUserMessage('查天气')],
      createSettings(),
      (delta) => {
        if (delta.streamingStatus) {
          statuses.push(delta.streamingStatus)
        }
      },
      undefined,
      {
        thinkingEnabled: true,
        toolSettings: {
          enabled: true,
          tavilyApiKey: 'tvly-key',
          maxToolRounds: 3,
        },
      },
    )

    expect(content).toBe('天气如下')
    expect(statuses).toContain('正在判断是否需要调用工具...')
    expect(statuses).toContain('正在调用 tavily_search：weather')
    expect(statuses).toContain('已获得 Tavily 搜索结果，正在继续思考...')
  })

  it('throws when tool rounds exceed configured max', async () => {
    let providerRound = 0
    const fetchMock = vi.fn(async (url: string) => {
      if (url === 'https://api.tavily.com/search') {
        return new Response(JSON.stringify({
          query: 'news',
          results: [],
        }), { status: 200 })
      }

      providerRound += 1
      return {
        ok: true,
        body: createSseStream([
          `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_${providerRound}","type":"function","function":{"name":"tavily_search","arguments":"{\\"query\\":\\"news\\"}"}}]}}]}`,
          'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
          'data: [DONE]',
        ]),
      }
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(
      streamWithToolOrchestrator(
        [createUserMessage('查新闻')],
        createSettings(),
        vi.fn(),
        undefined,
        {
          toolSettings: {
            enabled: true,
            tavilyApiKey: 'tvly-key',
            maxToolRounds: 1,
          },
        },
      ),
    ).rejects.toThrow('工具调用轮数超过上限：1')
  })

  it('passes reasoning_content back for deepseek thinking mode after tool calls', async () => {
    const providerBodies: Array<Record<string, unknown>> = []
    const fetchMock = createReasoningToolCallFlowFetch(providerBodies)

    vi.stubGlobal('fetch', fetchMock)

    await streamWithToolOrchestrator(
      [createUserMessage('查天气')],
      createSettings(),
      vi.fn(),
      undefined,
      {
        thinkingEnabled: true,
        toolSettings: {
          enabled: true,
          tavilyApiKey: 'tvly-key',
          maxToolRounds: 3,
        },
      },
    )

    expect(providerBodies).toHaveLength(2)
    const secondRoundMessages = providerBodies[1]?.messages as Array<Record<string, unknown>>
    const toolCallMessage = secondRoundMessages.find((message) => 'tool_calls' in message)
    expect(toolCallMessage).toMatchObject({
      role: 'assistant',
      reasoning_content: '先推理',
    })
  })
})

function createSseStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`${events.join('\n\n')}\n\n`))
      controller.close()
    },
  })
}

function createSettings(overrides: Partial<ActiveProviderSettings> = {}): ActiveProviderSettings {
  return {
    configId: 'deepseek',
    label: 'DeepSeek',
    provider: 'deepseek',
    apiKey: 'sk-test',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
    modelOptions: ['deepseek-v4-flash'],
    temperature: 1,
    ...overrides,
  }
}

function createUserMessage(content: string): ChatMessage {
  return {
    id: 'u-1',
    role: 'user',
    content,
    createdAt: 0,
    status: 'done',
  }
}

function parseJsonBody(body: BodyInit | null | undefined): Record<string, unknown> {
  if (typeof body !== 'string') {
    throw new Error('expected request body to be JSON string')
  }

  return JSON.parse(body) as Record<string, unknown>
}

function createReasoningToolCallFlowFetch(providerBodies: Array<Record<string, unknown>>) {
  let providerRound = 0
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === 'https://api.tavily.com/search') {
      return new Response(JSON.stringify({
        query: 'weather',
        results: [],
      }), { status: 200 })
    }

    providerRound += 1
    providerBodies.push(parseJsonBody(init?.body))
    return {
      ok: true,
      body: createSseStream(providerRound === 1
        ? [
          'data: {"choices":[{"delta":{"reasoning_content":"先推理"}}]}',
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"tavily_search","arguments":"{\\"query\\":\\"weather\\"}"}}]}}]}',
          'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
          'data: [DONE]',
        ]
        : [
          'data: {"choices":[{"delta":{"content":"done"}}]}',
          'data: [DONE]',
        ]),
    }
  })
}
