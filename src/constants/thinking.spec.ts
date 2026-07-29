import { describe, expect, it } from 'vitest'
import { getDefaultProviderCapabilities, normalizeProviderCapabilities } from './providerCapabilities'
import {
  createThinkingPayloadForChatCompletions,
  createThinkingPayloadForResponses,
  getThinkingOptions,
  normalizeThinkingLevel,
} from './thinking'
import type { ProviderId } from '../types/chat'

describe('thinking', () => {
  it('only exposes levels that the active provider protocol and model can accept', () => {
    expect(getThinkingOptions('deepseek', settings('deepseek', 'deepseek-v4-flash')).map(({ value }) => value))
      .toEqual(['off', 'high', 'max'])
    expect(getThinkingOptions('openai', settings('openai', 'gpt-5.4')).map(({ value }) => value))
      .toEqual(['off', 'low', 'medium', 'high', 'max'])
    expect(getThinkingOptions('openai', settings('openai', 'gpt-5.6')).map(({ value }) => value))
      .toEqual(['off', 'low', 'medium', 'high', 'max'])
    expect(getThinkingOptions('kimi', settings('kimi', 'kimi-k3')).map(({ value }) => value))
      .toEqual(['low', 'high', 'max'])
    expect(getThinkingOptions('kimi', settings('kimi', 'kimi-k2.6')).map(({ value }) => value))
      .toEqual(['off', 'high'])
    expect(getThinkingOptions('minimax', settings('minimax', 'MiniMax-M3')).map(({ value }) => value))
      .toEqual(['off', 'high'])
  })

  it('does not claim level control for fixed-thinking or unsupported models', () => {
    expect(getThinkingOptions('kimi', settings('kimi', 'kimi-k2.7-code'))).toEqual([])
    expect(getThinkingOptions('minimax', settings('minimax', 'MiniMax-M2.7'))).toEqual([])
    expect(getThinkingOptions('openai', settings('openai', 'gpt-4.1'))).toEqual([])
    expect(getThinkingOptions('openai', settings('openai', 'o4-mini'))).toEqual([])
  })

  it('normalizes saved levels when a selected model has fewer supported levels', () => {
    expect(normalizeThinkingLevel('kimi', 'kimi-k2.6', 'max')).toBe('high')
    expect(normalizeThinkingLevel('minimax', 'MiniMax-M3', 'medium')).toBe('high')
    expect(normalizeThinkingLevel('openai', 'gpt-5.6', 'unexpected')).toBe('medium')
  })

  it('maps supported Chat Completions levels to documented vendor payloads', () => {
    expect(createThinkingPayloadForChatCompletions('deepseek', settings('deepseek', 'deepseek-v4-flash'), 'max'))
      .toEqual({ reasoning_effort: 'max', thinking: { type: 'enabled' } })
    expect(createThinkingPayloadForChatCompletions('deepseek', settings('deepseek', 'deepseek-v4-flash'), 'off'))
      .toEqual({ thinking: { type: 'disabled' } })
    expect(createThinkingPayloadForChatCompletions('kimi', settings('kimi', 'kimi-k3'), 'low'))
      .toEqual({ reasoning_effort: 'low' })
    expect(createThinkingPayloadForChatCompletions('kimi', settings('kimi', 'kimi-k2.6'), 'off'))
      .toEqual({ thinking: { type: 'disabled' } })
    expect(createThinkingPayloadForChatCompletions('minimax', settings('minimax', 'MiniMax-M3'), 'high'))
      .toEqual({ reasoning_split: true, thinking: { type: 'adaptive' } })
  })

  it('sends an OpenAI Responses reasoning effort only when the model supports it', () => {
    expect(createThinkingPayloadForResponses('openai', settings('openai', 'gpt-5.6'), 'high'))
      .toEqual({ reasoning: { effort: 'high' } })
    expect(createThinkingPayloadForResponses('openai', settings('openai', 'gpt-5.6'), 'off'))
      .toEqual({ reasoning: { effort: 'none' } })
    expect(createThinkingPayloadForResponses('openai', settings('openai', 'gpt-5.4'), 'max'))
      .toEqual({ reasoning: { effort: 'xhigh' } })
    expect(createThinkingPayloadForResponses('openai', settings('openai', 'gpt-5.6'), 'max'))
      .toEqual({ reasoning: { effort: 'max' } })
    expect(createThinkingPayloadForResponses('openai', settings('openai', 'gpt-4.1'), 'high')).toEqual({})
    expect(createThinkingPayloadForResponses('openai', settings('openai', 'o4-mini'), 'max')).toEqual({})
  })
})

function settings(provider: ProviderId, model: string) {
  const capabilities = normalizeProviderCapabilities(provider, getDefaultProviderCapabilities(provider), model)
  return {
    capabilities,
    model,
  }
}
