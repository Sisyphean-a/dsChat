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
})
