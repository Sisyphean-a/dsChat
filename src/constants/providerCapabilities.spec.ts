import { describe, expect, it } from 'vitest'
import {
  createImageInputUnsupportedMessage,
  createThinkingPayloadForChatCompletions,
  getDefaultProviderCapabilities,
  normalizeProviderCapabilities,
  providerShowsThinkingToggle,
  providerSupportsImageInput,
  providerSupportsNativeWebSearch,
  providerSupportsToolCalling,
  resolveProviderProtocol,
  resolveProviderRequestTemperature,
  resolveThinkingProviderKey,
  shouldIncludeProviderRequestTemperature,
  supportsOpenAiNativeWebSearchModel,
} from './providerCapabilities'

describe('providerCapabilities', () => {
  it('builds default capabilities from provider presets', () => {
    expect(getDefaultProviderCapabilities('openai')).toEqual({
      imageInput: true,
      nativeWebSearch: true,
      protocol: 'responses',
      reasoning: false,
      toolCalling: false,
    })
    expect(getDefaultProviderCapabilities('deepseek')).toEqual({
      imageInput: false,
      nativeWebSearch: false,
      protocol: 'chat_completions',
      reasoning: true,
      toolCalling: true,
    })
  })

  it('resolves effective capabilities from provider config', () => {
    const settings = createProviderSettings('openai', {
      nativeWebSearch: false,
      protocol: 'chat_completions',
      toolCalling: true,
    })

    expect(resolveProviderProtocol(settings)).toBe('chat_completions')
    expect(providerSupportsImageInput(settings)).toBe(true)
    expect(providerSupportsNativeWebSearch(settings)).toBe(false)
    expect(providerSupportsToolCalling(settings)).toBe(true)
  })

  it('does not treat local tool calling as available on responses protocol', () => {
    const settings = createProviderSettings('openai', {
      nativeWebSearch: false,
      protocol: 'responses',
      toolCalling: true,
    })

    expect(providerSupportsToolCalling(settings)).toBe(false)
  })

  it('normalizes partial capability overrides with provider defaults', () => {
    expect(normalizeProviderCapabilities('deepseek', { imageInput: true })).toEqual({
      imageInput: true,
      nativeWebSearch: false,
      protocol: 'chat_completions',
      reasoning: true,
      toolCalling: true,
    })
  })

  it('returns provider-specific image unsupported message when available', () => {
    expect(createImageInputUnsupportedMessage('deepseek', 'DeepSeek')).toContain('仅支持文本输入')
    expect(createImageInputUnsupportedMessage('custom', '自定义模型')).toContain('自定义模型 当前模型不支持图片输入')
  })

  it('blocks image input for Kimi text-only presets', () => {
    expect(providerSupportsImageInput(createProviderSettings('kimi', {}, 'kimi-k3'))).toBe(false)
    expect(providerSupportsImageInput(createProviderSettings('kimi', {}, 'kimi-k2.6'))).toBe(true)
  })

  it('resolves thinking toggle rules per provider and model', () => {
    expect(providerShowsThinkingToggle('deepseek', createProviderSettings('deepseek', {}, 'deepseek-v4-flash'))).toBe(true)
    expect(providerShowsThinkingToggle('deepseek', createProviderSettings('deepseek', {}, 'deepseek-reasoner'))).toBe(false)
    expect(providerShowsThinkingToggle('minimax', createProviderSettings('minimax', {}, 'MiniMax-M2.7'))).toBe(true)
    expect(providerShowsThinkingToggle('openai', createProviderSettings('openai', {}, 'gpt-5.5'))).toBe(false)
    expect(providerShowsThinkingToggle('deepseek', createProviderSettings('deepseek', { reasoning: false }, 'deepseek-v4-flash'))).toBe(false)
  })

  it('resolves thinking provider key for persistent settings', () => {
    expect(resolveThinkingProviderKey('deepseek')).toBe('deepseek')
    expect(resolveThinkingProviderKey('openai')).toBeNull()
  })

  it('builds thinking payload in one place for chat-completions protocol', () => {
    expect(createThinkingPayloadForChatCompletions('deepseek', createProviderSettings('deepseek', {}, 'deepseek-v4-flash'), false)).toEqual({
      thinking: { type: 'disabled' },
    })
    expect(createThinkingPayloadForChatCompletions('deepseek', createProviderSettings('deepseek', {}, 'deepseek-reasoner'), true)).toEqual({})
    expect(createThinkingPayloadForChatCompletions('minimax', createProviderSettings('minimax', {}, 'MiniMax-M2.7'), false)).toEqual({
      reasoning_split: false,
    })
  })

  it('normalizes request temperature behavior from centralized policy', () => {
    expect(shouldIncludeProviderRequestTemperature('deepseek', createProviderSettings('deepseek', {}, 'deepseek-v4-flash'), true)).toBe(false)
    expect(shouldIncludeProviderRequestTemperature('deepseek', createProviderSettings('deepseek', {}, 'deepseek-v4-flash'), false)).toBe(true)
    expect(resolveProviderRequestTemperature('kimi', 0.2, true)).toBe(1.0)
    expect(resolveProviderRequestTemperature('kimi', 1.8, false)).toBe(0.6)
  })

  it('checks OpenAI native web search model compatibility from one list', () => {
    expect(supportsOpenAiNativeWebSearchModel('gpt-5.5')).toBe(true)
    expect(supportsOpenAiNativeWebSearchModel('gpt-5.6-sol')).toBe(true)
    expect(supportsOpenAiNativeWebSearchModel('gpt-5.6-terra')).toBe(true)
    expect(supportsOpenAiNativeWebSearchModel('gpt-5.6-luna')).toBe(true)
    expect(supportsOpenAiNativeWebSearchModel('gpt-4.1')).toBe(false)
  })
})

function createProviderSettings(
  provider: Parameters<typeof getDefaultProviderCapabilities>[0],
  capabilities: Partial<ReturnType<typeof getDefaultProviderCapabilities>> = {},
  model = '',
) {
  return {
    apiKey: 'sk-test',
    baseUrl: 'https://example.com',
    capabilities: normalizeProviderCapabilities(provider, capabilities),
    configId: 'test',
    model,
    modelOptions: model ? [model] : [],
    label: 'Test',
    provider,
    temperature: 1,
  }
}
