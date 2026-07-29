import { describe, expect, it } from 'vitest'
import { getDefaultProviderCapabilities } from '../../../constants/providerCapabilities'
import { chatCompletionsAdapter } from './chatCompletionsAdapter'

describe('chatCompletionsAdapter', () => {
  it('accumulates complete tool calls and returns one batch', () => {
    const state = chatCompletionsAdapter.createStreamState(createSettings())
    chatCompletionsAdapter.parseSseEvent(
      '{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"tavily_search","arguments":"{\\"query\\":"}}]}}]}',
      state,
    )
    chatCompletionsAdapter.parseSseEvent(
      '{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"weather\\"}"}}]}}]}',
      state,
    )

    expect(chatCompletionsAdapter.parseSseEvent(
      '{"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
      state,
    )).toEqual([{
      type: 'tool-calls',
      calls: [{ id: 'call_1', name: 'tavily_search', argumentsJson: '{"query":"weather"}' }],
    }])
  })

  it('keeps repeated non-MiniMax content chunks as separate deltas', () => {
    const state = chatCompletionsAdapter.createStreamState(createSettings())

    const first = chatCompletionsAdapter.parseSseEvent(
      '{"choices":[{"delta":{"content":"好"}}]}', state,
    )
    const second = chatCompletionsAdapter.parseSseEvent(
      '{"choices":[{"delta":{"content":"好"}}]}', state,
    )

    expect(first).toEqual([{ type: 'content', content: '好' }])
    expect(second).toEqual([{ type: 'content', content: '好' }])
  })

  it('puts reasoning and tool history into a Provider request', () => {
    const request = chatCompletionsAdapter.createRequest({
      messages: [{
        content: '',
        reasoningContent: '先推理',
        role: 'assistant',
        toolCalls: [{ id: 'call_1', name: 'tavily_search', argumentsJson: '{"query":"weather"}' }],
      }, { content: '{"ok":true}', role: 'tool', toolCallId: 'call_1' }],
      settings: createSettings(),
      stream: true,
      thinkingLevel: 'high',
      tools: [],
    })

    const messages = request.body.messages as Array<Record<string, unknown>>
    expect(messages[0]).toMatchObject({
      content: null,
      reasoning_content: '先推理',
      role: 'assistant',
      tool_calls: [{ id: 'call_1' }],
    })
  })

  it('serializes tool definitions with serial execution', () => {
    const request = chatCompletionsAdapter.createRequest({
      messages: [{ content: '查新闻', role: 'user' }],
      settings: createSettings(),
      stream: true,
      thinkingLevel: 'high',
      tools: [{ type: 'function', function: { description: '联网搜索', name: 'tavily_search', parameters: {} } }],
    })

    expect(request.body.parallel_tool_calls).toBe(false)
    expect(request.body.tool_choice).toBe('auto')
  })
})

function createSettings() {
  return {
    apiKey: 'sk-test',
    baseUrl: 'https://api.deepseek.com',
    capabilities: getDefaultProviderCapabilities('deepseek'),
    configId: 'deepseek',
    label: 'DeepSeek',
    model: 'deepseek-v4-flash',
    modelOptions: ['deepseek-v4-flash'],
    provider: 'deepseek' as const,
    reasoningLevel: 'high' as const,
    temperature: 1,
  }
}
