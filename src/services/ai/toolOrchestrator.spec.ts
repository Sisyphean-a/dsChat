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
        toolSettings: createToolSettings(),
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
    const traceSnapshots: Array<NonNullable<Parameters<Parameters<typeof streamWithToolOrchestrator>[2]>[0]['toolTraces']>> = []
    const timelineSnapshots: Array<NonNullable<Parameters<Parameters<typeof streamWithToolOrchestrator>[2]>[0]['processTimeline']>> = []
    const content = await streamWithToolOrchestrator(
      [createUserMessage('查天气')],
      createSettings(),
      (delta) => {
        if (delta.streamingStatus) {
          statuses.push(delta.streamingStatus)
        }
        if (delta.toolTraces) {
          traceSnapshots.push(delta.toolTraces.map((item) => ({ ...item })))
        }
        if (delta.processTimeline) {
          timelineSnapshots.push(delta.processTimeline.map((item) => ({ ...item })))
        }
      },
      undefined,
      {
        thinkingEnabled: true,
        toolSettings: createToolSettings(),
      },
    )

    expect(content).toBe('天气如下')
    expect(statuses).toContain('正在调用联网搜索（关键词：weather）')
    expect(statuses).toContain('已获得工具结果，正在整理回答...')
    const latestTrace = traceSnapshots[traceSnapshots.length - 1]
    expect(latestTrace).toBeDefined()
    expect(latestTrace?.[0]).toMatchObject({
      id: 'call_1',
      status: 'succeeded',
      toolName: 'tavily_search',
    })
    const latestTimeline = timelineSnapshots[timelineSnapshots.length - 1]
    expect(latestTimeline).toBeDefined()
    expect(latestTimeline?.some((item) => item.type === 'tool' && item.status === 'done')).toBe(true)
  })

  it('falls back to summary answer when tool rounds exceed configured max', async () => {
    let providerRound = 0
    const providerBodies: Array<Record<string, unknown>> = []
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === 'https://api.tavily.com/search') {
        return new Response(JSON.stringify({
          query: 'news',
          results: [],
        }), { status: 200 })
      }

      providerRound += 1
      providerBodies.push(parseJsonBody(init?.body))
      if (providerRound === 3) {
        return {
          ok: true,
          body: createSseStream([
            'data: {"choices":[{"delta":{"content":"基于已有结果给出总结"}}]}',
            'data: [DONE]',
          ]),
        }
      }

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

    const statuses: string[] = []
    const content = await streamWithToolOrchestrator(
      [createUserMessage('查新闻')],
      createSettings(),
      (delta) => {
        if (delta.streamingStatus) {
          statuses.push(delta.streamingStatus)
        }
      },
      undefined,
      {
        toolSettings: createToolSettings({ maxToolRounds: 1 }),
      },
    )

    expect(content).toBe('基于已有结果给出总结')
    expect(statuses).toContain('已达到工具调用上限，正在基于已有结果生成回答...')
    expect(providerRound).toBe(3)
    const summaryRequestBody = providerBodies[2] as Record<string, unknown>
    expect(summaryRequestBody.tools).toBeUndefined()
    const summaryMessages = summaryRequestBody.messages as Array<{ role?: string; content?: string }>
    const limitMessage = summaryMessages.find((item) => item.role === 'system')?.content ?? ''
    expect(limitMessage).toContain('工具调用轮数超过上限：1')
  })

  it('throws duplicate call error when model repeats the same tool call consecutively', async () => {
    let providerRound = 0
    const fetchMock = vi.fn(async (url: string) => {
      if (url === 'https://api.tavily.com/search') {
        return new Response(JSON.stringify({
          query: 'news',
          results: [],
        }), { status: 200 })
      }

      providerRound += 1
      const callId = providerRound === 1 ? 'call_1' : 'call_2'
      return {
        ok: true,
        body: createSseStream([
          `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"${callId}","type":"function","function":{"name":"tavily_search","arguments":"{\\"query\\":\\"news\\"}"}}]}}]}`,
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
          toolSettings: createToolSettings({ maxToolRounds: 3 }),
        },
      ),
    ).rejects.toThrow('检测到重复工具调用：tavily_search')
  })

  it('continues execution when provider returns multiple tool calls in one round', async () => {
    let providerRound = 0
    const statuses: string[] = []
    const fetchMock = vi.fn(async (url: string) => {
      if (url === 'https://api.tavily.com/search') {
        return new Response(JSON.stringify({
          query: 'AI news this week',
          results: [],
        }), { status: 200 })
      }

      providerRound += 1
      if (providerRound === 1) {
        return {
          ok: true,
          body: createSseStream([
            'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"get_current_time","arguments":"{}"}},{"index":1,"id":"call_2","type":"function","function":{"name":"tavily_search","arguments":"{\\"query\\":\\"AI news this week\\"}"}}]}}]}',
            'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
            'data: [DONE]',
          ]),
        }
      }

      return {
        ok: true,
        body: createSseStream([
          'data: {"choices":[{"delta":{"content":"已整理完成"}}]}',
          'data: [DONE]',
        ]),
      }
    })

    vi.stubGlobal('fetch', fetchMock)

    const content = await streamWithToolOrchestrator(
      [createUserMessage('整理最近一周AI新闻')],
      createSettings(),
      (delta) => {
        if (delta.streamingStatus) {
          statuses.push(delta.streamingStatus)
        }
      },
      undefined,
      {
        toolSettings: createToolSettings(),
      },
    )

    expect(content).toBe('已整理完成')
    expect(statuses).toContain('正在调用时间工具')
    expect(statuses).toContain('正在调用联网搜索（关键词：AI news this week）')
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
        toolSettings: createToolSettings(),
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

  it('does not throw when final round has no content but previous tool round already streamed content', async () => {
    let providerRound = 0
    const fetchMock = vi.fn(async (url: string) => {
      if (url === 'https://api.tavily.com/search') {
        return new Response(JSON.stringify({
          query: 'today news',
          results: [],
        }), { status: 200 })
      }

      providerRound += 1
      if (providerRound === 1) {
        return {
          ok: true,
          body: createSseStream([
            'data: {"choices":[{"delta":{"content":"先确认当前时间，然后继续。"}}]}',
            'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"tavily_search","arguments":"{\\"query\\":\\"today news\\"}"}}]}}]}',
            'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
            'data: [DONE]',
          ]),
        }
      }

      return {
        ok: true,
        body: createSseStream([
          'data: [DONE]',
        ]),
      }
    })

    vi.stubGlobal('fetch', fetchMock)
    const content = await streamWithToolOrchestrator(
      [createUserMessage('查今天新闻')],
      createSettings({ provider: 'kimi', label: 'Kimi', model: 'kimi-k2-thinking' }),
      vi.fn(),
      undefined,
      {
        thinkingEnabled: true,
        toolSettings: createToolSettings(),
      },
    )

    expect(content).toBe('先确认当前时间，然后继续。')
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

function createToolSettings(
  overrides: Partial<{ maxToolRounds: number }> = {},
) {
  return {
    enabled: true,
    openaiUseNativeWebSearch: true,
    maxToolRounds: overrides.maxToolRounds ?? 3,
    builtinTools: {
      currentTime: {
        enabled: true,
      },
      tavilySearch: {
        enabled: true,
        apiKey: 'tvly-key',
        baseUrl: 'https://api.tavily.com/search',
      },
    },
    customTools: [],
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
