import { describe, expect, it } from 'vitest'
import { getDefaultProviderCapabilities } from '../../constants/providerCapabilities'
import { createToolOrchestrator } from './toolOrchestrator'
import { getToolExecutionTimeoutMs, QWEN_IMAGE_TOOL_TIMEOUT_MS, TOOL_EXECUTION_TIMEOUT_MS } from './toolExecution'
import { messageMapping } from './messageMapping'
import type { ProviderStream } from './providerStream'
import type { AiTool, ToolExecutionContext } from './toolTypes'

describe('ToolOrchestrator', () => {
  it('uses tool metadata for execution timeouts', () => {
    expect(getToolExecutionTimeoutMs({})).toBe(TOOL_EXECUTION_TIMEOUT_MS)
    expect(getToolExecutionTimeoutMs({ executionTimeoutMs: QWEN_IMAGE_TOOL_TIMEOUT_MS })).toBe(QWEN_IMAGE_TOOL_TIMEOUT_MS)
  })

  it('executes a tool batch serially and forwards the final text', async () => {
    const calls: string[] = []
    const providerStream = scriptedProviderStream([
      [{ type: 'tool-calls', calls: [
        { id: 'call-1', name: 'first', argumentsJson: '{}' },
        { id: 'call-2', name: 'second', argumentsJson: '{}' },
      ] }],
      [{ type: 'content', content: '最终回答' }],
    ])
    const orchestrator = createToolOrchestrator({ messageMapping, providerStream })

    const events = await collect(orchestrator.stream(request([
      tool('first', async () => { calls.push('first'); return { content: 'one' } }),
      tool('second', async () => { calls.push('second'); return { content: 'two' } }),
    ])))

    expect(calls).toEqual(['first', 'second'])
    expect(events).toContainEqual({ type: 'content', content: '最终回答' })
    expect(events.filter((event) => event.type === 'tool-trace').map((event) => event.trace.status)).toEqual([
      'planned', 'running', 'succeeded', 'planned', 'running', 'succeeded',
    ])
  })

  it('updates one reasoning timeline item instead of adding one item per streamed delta', async () => {
    const providerStream = scriptedProviderStream([[
      { type: 'reasoning', content: 'CSS ' },
      { type: 'reasoning', content: '布局' },
      { type: 'content', content: '最终回答' },
    ]])
    const orchestrator = createToolOrchestrator({ messageMapping, providerStream })

    const events = await collect(orchestrator.stream(request([tool('first', async () => ({ content: 'one' }))])))
    const reasoningTimeline = events.filter((event) => {
      return event.type === 'timeline' && event.item.type === 'reasoning'
    })

    expect(reasoningTimeline).toEqual([
      expect.objectContaining({
        item: expect.objectContaining({ id: 'reasoning-1', text: 'CSS' }),
      }),
      expect.objectContaining({
        item: expect.objectContaining({ id: 'reasoning-1', text: 'CSS 布局' }),
      }),
    ])
  })

  it('keeps the initial reasoning level through every tool round', async () => {
    const levels: string[] = []
    let round = 0
    const providerStream: ProviderStream = {
      async *stream(request) {
        levels.push(request.thinkingLevel)
        if (round++ === 0) {
          yield {
            type: 'tool-calls',
            calls: [{ id: 'call-1', name: 'first', argumentsJson: '{}' }],
          }
          return
        }
        yield { type: 'content', content: '最终回答' }
      },
    }
    const orchestrator = createToolOrchestrator({ messageMapping, providerStream })

    await collect(orchestrator.stream(request([tool('first', async () => ({ content: 'one' }))])))

    expect(levels).toEqual(['high', 'high'])
  })

  it('returns a failed tool result to the model and keeps the reply alive', async () => {
    const contextMessages: Array<{ content: string; role: string; toolCallId?: string }> = []
    let round = 0
    const providerStream: ProviderStream = {
      async *stream(request) {
        round += 1
        if (round === 1) {
          yield { type: 'tool-calls', calls: [{ id: 'call-1', name: 'broken', argumentsJson: '{}' }] }
          return
        }
        contextMessages.push(...request.messages as typeof contextMessages)
        yield { type: 'content', content: '搜索服务不可用，未能取得最新信息。' }
      },
    }
    const orchestrator = createToolOrchestrator({ messageMapping, providerStream })

    const events = await collect(orchestrator.stream(request([
      tool('broken', async () => { throw new Error('Tavily 搜索失败：HTTP 554') }),
    ])))

    const toolResult = contextMessages.find((message) => message.role === 'tool')
    expect(toolResult).toMatchObject({ role: 'tool', toolCallId: 'call-1' })
    expect(toolResult?.content).toContain('Tavily 搜索失败：HTTP 554')
    expect(toolResult?.content).toContain('不要编造')
    expect(events).toContainEqual(expect.objectContaining({
      type: 'tool-trace', trace: expect.objectContaining({ status: 'failed' }),
    }))
    expect(events).toContainEqual({ type: 'content', content: '搜索服务不可用，未能取得最新信息。' })
  })

  it('keeps the rest of the batch running after one call fails', async () => {
    const executed: string[] = []
    const contextMessages: Array<{ content: string; role: string; toolCallId?: string }> = []
    let round = 0
    const providerStream: ProviderStream = {
      async *stream(request) {
        round += 1
        if (round === 1) {
          yield {
            type: 'tool-calls',
            calls: [
              { id: 'call-1', name: 'broken', argumentsJson: '{}' },
              { id: 'call-2', name: 'working', argumentsJson: '{}' },
            ],
          }
          return
        }
        contextMessages.push(...request.messages as typeof contextMessages)
        yield { type: 'content', content: '最终回答' }
      },
    }
    const orchestrator = createToolOrchestrator({ messageMapping, providerStream })

    await collect(orchestrator.stream(request([
      tool('broken', async () => { executed.push('broken'); throw new Error('boom') }),
      tool('working', async () => { executed.push('working'); return { content: 'ok' } }),
    ])))

    expect(executed).toEqual(['broken', 'working'])
    expect(contextMessages.filter((message) => message.role === 'tool')).toMatchObject([
      { toolCallId: 'call-1', content: expect.stringContaining('boom') },
      { toolCallId: 'call-2', content: 'ok' },
    ])
  })

  it('still terminates the reply when a tool execution times out', async () => {
    const providerStream = scriptedProviderStream([[
      { type: 'tool-calls', calls: [{ id: 'call-1', name: 'slow', argumentsJson: '{}' }] },
      { type: 'content', content: '不应到达的回答' },
    ]])
    const orchestrator = createToolOrchestrator({ messageMapping, providerStream })
    const slow = { ...tool('slow', async () => new Promise<{ content: string }>(() => undefined)), executionTimeoutMs: 5 }

    await expect(collect(orchestrator.stream(request([slow]))))
      .rejects.toMatchObject({ code: 'tool_execute_timeout' })
  })

  it('marks a running tool as stopped when its signal aborts', async () => {
    const controller = new AbortController()
    const providerStream = scriptedProviderStream([[{
      type: 'tool-calls', calls: [{ id: 'call-1', name: 'slow', argumentsJson: '{}' }],
    }]])
    const orchestrator = createToolOrchestrator({ messageMapping, providerStream })
    const iterator = orchestrator
      .stream({ ...request([tool('slow', async () => new Promise(() => undefined))]), signal: controller.signal })[Symbol.asyncIterator]()
    const events: unknown[] = []
    const consume = (async () => {
      while (true) {
        const next = await iterator.next()
        if (next.done) return
        events.push(next.value)
      }
    })()

    await new Promise((resolve) => setTimeout(resolve, 0))
    controller.abort()
    await expect(consume).rejects.toThrow('流式回复已停止。')
    expect(events).toContainEqual(expect.objectContaining({
      type: 'tool-trace', trace: expect.objectContaining({ status: 'stopped' }),
    }))
  })

  it('requires final text after tools finish', async () => {
    const providerStream = scriptedProviderStream([
      [{ type: 'tool-calls', calls: [{ id: 'call-1', name: 'first', argumentsJson: '{}' }] }],
      [{ type: 'status', status: 'done' }],
    ])
    const orchestrator = createToolOrchestrator({ messageMapping, providerStream })

    await expect(collect(orchestrator.stream(request([tool('first', async () => ({ content: 'one' }))]))))
      .rejects.toMatchObject({ code: 'empty-result' })
  })
})

function request(tools: AiTool[] = []) {
  return {
    messages: [{ content: '查资料', role: 'user' as const }],
    settings: {
      apiKey: 'sk-test', baseUrl: 'https://api.deepseek.com',
      capabilities: getDefaultProviderCapabilities('deepseek'), configId: 'deepseek', label: 'DeepSeek',
      model: 'deepseek-flash', modelOptions: ['deepseek-flash'], provider: 'deepseek' as const, reasoningLevel: 'high' as const, temperature: 1,
    },
    thinkingLevel: 'high' as const,
    toolContext: toolContext(),
    tools,
  }
}

function toolContext(): ToolExecutionContext {
  return {
    attachments: undefined,
    settings: {
      enabled: true,
      builtinTools: { currentTime: { enabled: true }, tavilySearch: { apiKey: 'key', baseUrl: 'https://example.com', enabled: false } },
      customTools: [],
    },
  }
}

function tool(name: string, execute: () => Promise<{ content: string }>) {
  return {
    definition: { type: 'function' as const, function: { description: name, name, parameters: {} } },
    execute,
  }
}

function scriptedProviderStream(rounds: Array<Array<{ type: string; [key: string]: unknown }>>): ProviderStream {
  let round = 0
  return {
    async *stream() {
      const events = rounds[round++] ?? []
      for (const event of events) yield event as never
    },
  }
}

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = []
  for await (const event of stream) values.push(event)
  return values
}
