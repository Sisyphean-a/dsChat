import { describe, expect, it } from 'vitest'
import {
  createImageInputUnsupportedMessage,
  getDefaultProviderCapabilities,
  getSupportedProviderProtocols,
  normalizeProviderCapabilities,
  providerSupportsImageInput,
  providerSupportsNativeWebSearch,
  providerSupportsToolCalling,
  resolveProviderProtocol,
  resolveProviderRequestTemperature,
  shouldIncludeProviderRequestTemperature,
  supportsOpenAiNativeWebSearchModel,
} from './providerCapabilities'

describe('providerCapabilities', () => {
  it('builds default capabilities from provider presets', () => {
    expect(getDefaultProviderCapabilities('openai')).toEqual({
      imageInput: true,
      nativeWebSearch: true,
      protocol: 'responses',
      reasoning: true,
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

  it('only enables native web search for supported OpenAI Responses models', () => {
    const responses = createProviderSettings('openai', {}, 'gpt-5.6')
    const chatCompletions = createProviderSettings('openai', { protocol: 'chat_completions' }, 'gpt-5.6')
    const unsupportedModel = createProviderSettings('openai', {}, 'gpt-4.1')

    expect(providerSupportsNativeWebSearch(responses)).toBe(true)
    expect(providerSupportsNativeWebSearch(chatCompletions)).toBe(false)
    expect(providerSupportsNativeWebSearch(unsupportedModel)).toBe(false)
  })

  it('does not treat local tool calling as available on responses protocol', () => {
    const settings = createProviderSettings('openai', {
      nativeWebSearch: false,
      protocol: 'responses',
      toolCalling: true,
    })

    expect(providerSupportsToolCalling(settings)).toBe(false)
  })

  it('only offers protocols that each provider supports', () => {
    expect(getSupportedProviderProtocols('deepseek')).toEqual(['chat_completions'])
    expect(getSupportedProviderProtocols('openai')).toEqual(['chat_completions', 'responses'])
    expect(getSupportedProviderProtocols('custom')).toEqual(['chat_completions', 'responses'])
  })

  it('normalizes partial capability overrides with provider defaults', () => {
    expect(normalizeProviderCapabilities('deepseek', { imageInput: true })).toEqual({
      imageInput: false,
      nativeWebSearch: false,
      protocol: 'chat_completions',
      reasoning: true,
      toolCalling: true,
    })
    expect(normalizeProviderCapabilities('deepseek', { protocol: 'responses' })).toMatchObject({
      protocol: 'chat_completions',
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

  it('enables direct image input for the DeepSeek vision preset', () => {
    const vision = createProviderSettings('deepseek', {}, 'deepseek-v4-flash-vision-exp')
    const text = createProviderSettings('deepseek', { imageInput: true }, 'deepseek-v4-flash')

    expect(vision.capabilities.imageInput).toBe(true)
    expect(providerSupportsImageInput(vision)).toBe(true)
    expect(text.capabilities.imageInput).toBe(false)
    expect(providerSupportsImageInput(text)).toBe(false)
  })

  it('keeps temperature out of active DeepSeek thinking requests', () => {
    const settings = createProviderSettings('deepseek', {}, 'deepseek-v4-flash')

    expect(shouldIncludeProviderRequestTemperature('deepseek', settings, 'high')).toBe(false)
    expect(shouldIncludeProviderRequestTemperature('deepseek', settings, 'off')).toBe(true)
    expect(resolveProviderRequestTemperature('kimi', 0.2, 'high')).toBe(1.0)
    expect(resolveProviderRequestTemperature('kimi', 1.8, 'off')).toBe(0.6)
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
    capabilities: normalizeProviderCapabilities(provider, capabilities, model),
    configId: 'test',
    label: 'Test',
    model,
    modelOptions: model ? [model] : [],
    provider,
    reasoningLevel: 'high' as const,
    temperature: 1,
  }
}
