import { describe, expect, it } from 'vitest'
import {
  createImageInputUnsupportedMessage,
  createThinkingPayloadForChatCompletions,
  providerShowsThinkingToggle,
  providerSupportsImageInput,
  providerSupportsNativeWebSearch,
  providerSupportsToolOrchestrator,
  resolveProviderProtocol,
  resolveProviderRequestTemperature,
  resolveThinkingProviderKey,
  shouldIncludeProviderRequestTemperature,
  supportsOpenAiNativeWebSearchModel,
} from './providerCapabilities'

describe('providerCapabilities', () => {
  it('resolves protocol by provider', () => {
    expect(resolveProviderProtocol('openai')).toBe('responses')
    expect(resolveProviderProtocol('deepseek')).toBe('chat_completions')
    expect(resolveProviderProtocol('custom')).toBe('chat_completions')
  })

  it('exposes image input support as centralized capability', () => {
    expect(providerSupportsImageInput('deepseek')).toBe(false)
    expect(providerSupportsImageInput('minimax')).toBe(false)
    expect(providerSupportsImageInput('openai')).toBe(true)
    expect(providerSupportsImageInput('kimi')).toBe(true)
  })

  it('returns provider-specific image unsupported message when available', () => {
    expect(createImageInputUnsupportedMessage('deepseek', 'DeepSeek')).toContain('仅支持文本输入')
    expect(createImageInputUnsupportedMessage('custom', '自定义模型')).toContain('自定义模型 当前模型不支持图片输入')
  })

  it('resolves thinking toggle rules per provider and model', () => {
    expect(providerShowsThinkingToggle('deepseek', 'deepseek-v4-flash')).toBe(true)
    expect(providerShowsThinkingToggle('deepseek', 'deepseek-reasoner')).toBe(false)
    expect(providerShowsThinkingToggle('minimax', 'MiniMax-M2.7')).toBe(true)
    expect(providerShowsThinkingToggle('openai', 'gpt-5.5')).toBe(false)
  })

  it('resolves thinking provider key for persistent settings', () => {
    expect(resolveThinkingProviderKey('deepseek')).toBe('deepseek')
    expect(resolveThinkingProviderKey('openai')).toBeNull()
  })

  it('builds thinking payload in one place for chat-completions protocol', () => {
    expect(createThinkingPayloadForChatCompletions('deepseek', 'deepseek-v4-flash', false)).toEqual({
      thinking: { type: 'disabled' },
    })
    expect(createThinkingPayloadForChatCompletions('deepseek', 'deepseek-reasoner', true)).toEqual({})
    expect(createThinkingPayloadForChatCompletions('minimax', 'MiniMax-M2.7', false)).toEqual({
      reasoning_split: false,
    })
  })

  it('normalizes request temperature behavior from centralized policy', () => {
    expect(shouldIncludeProviderRequestTemperature('deepseek', 'deepseek-v4-flash', true)).toBe(false)
    expect(shouldIncludeProviderRequestTemperature('deepseek', 'deepseek-v4-flash', false)).toBe(true)
    expect(resolveProviderRequestTemperature('kimi', 0.2, true)).toBe(1.0)
    expect(resolveProviderRequestTemperature('kimi', 1.8, false)).toBe(0.6)
  })

  it('exposes tool path capabilities', () => {
    expect(providerSupportsToolOrchestrator('openai')).toBe(false)
    expect(providerSupportsToolOrchestrator('deepseek')).toBe(true)
    expect(providerSupportsNativeWebSearch('openai')).toBe(true)
    expect(providerSupportsNativeWebSearch('deepseek')).toBe(false)
  })

  it('checks OpenAI native web search model compatibility from one list', () => {
    expect(supportsOpenAiNativeWebSearchModel('gpt-5.5')).toBe(true)
    expect(supportsOpenAiNativeWebSearchModel('gpt-4.1')).toBe(false)
  })
})
