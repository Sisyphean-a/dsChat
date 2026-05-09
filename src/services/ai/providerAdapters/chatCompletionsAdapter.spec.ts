import { describe, expect, it } from 'vitest'
import { createProviderStreamState } from '../providerAdapter'
import { chatCompletionsAdapter } from './chatCompletionsAdapter'

describe('chatCompletionsAdapter', () => {
  it('accumulates delta.tool_calls and emits tool_calls_done when finish_reason is tool_calls', () => {
    const state = createProviderStreamState()

    chatCompletionsAdapter.parseSseEvent(
      '{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"tavily_search","arguments":"{\\"query\\":"}}]}}]}',
      state,
    )
    chatCompletionsAdapter.parseSseEvent(
      '{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"weather\\"}"}}]}}]}',
      state,
    )

    const deltas = chatCompletionsAdapter.parseSseEvent(
      '{"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
      state,
    )

    expect(deltas).toEqual([{
      type: 'tool_calls_done',
      calls: [{
        id: 'call_1',
        name: 'tavily_search',
        argumentsJson: '{"query":"weather"}',
      }],
    }])
  })

  it('serializes assistant reasoning_content for deepseek payload', () => {
    const payload = chatCompletionsAdapter.createPayload({
      messages: [{
        role: 'assistant',
        content: '',
        reasoningContent: '先推理',
        toolCalls: [{
          id: 'call_1',
          name: 'tavily_search',
          argumentsJson: '{"query":"weather"}',
        }],
      }, {
        role: 'tool',
        content: '{"ok":true}',
        toolCallId: 'call_1',
      }],
      settings: createDeepseekSettings(),
      stream: true,
      requestOptions: {
        thinkingEnabled: true,
      },
      tools: [],
    })

    const messages = payload.messages as Array<Record<string, unknown>>
    expect(messages[0]).toMatchObject({
      role: 'assistant',
      reasoning_content: '先推理',
      tool_calls: [{
        id: 'call_1',
      }],
    })
  })

  it('serializes assistant reasoning_content for kimi payload', () => {
    const payload = chatCompletionsAdapter.createPayload({
      messages: [{
        role: 'assistant',
        content: '',
        reasoningContent: '先推理',
        toolCalls: [{
          id: 'call_1',
          name: 'tavily_search',
          argumentsJson: '{"query":"weather"}',
        }],
      }, {
        role: 'tool',
        content: '{"ok":true}',
        toolCallId: 'call_1',
      }],
      settings: createKimiSettings(),
      stream: true,
      requestOptions: {
        thinkingEnabled: true,
      },
      tools: [],
    })

    const messages = payload.messages as Array<Record<string, unknown>>
    expect(messages[0]).toMatchObject({
      role: 'assistant',
      reasoning_content: '先推理',
      tool_calls: [{
        id: 'call_1',
      }],
    })
  })
})

function createDeepseekSettings() {
  return {
    configId: 'deepseek',
    label: 'DeepSeek',
    provider: 'deepseek' as const,
    apiKey: 'sk-test',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
    modelOptions: ['deepseek-v4-flash'],
    temperature: 1,
  }
}

function createKimiSettings() {
  return {
    configId: 'kimi',
    label: 'Kimi',
    provider: 'kimi' as const,
    apiKey: 'sk-test',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'kimi-k2-thinking',
    modelOptions: ['kimi-k2-thinking'],
    temperature: 1,
  }
}
