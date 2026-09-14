import { describe, expect, it } from 'vitest'
import { findModelProfile, getPresetModels, getProviderProfile } from './providerProfiles'

describe('providerProfiles', () => {
  it('resolves provider-scoped model facts from one table', () => {
    expect(findModelProfile('deepseek', 'deepseek-flash')?.supportsImageInput).toBe(true)
    expect(findModelProfile('deepseek', 'deepseek-v4-pro')?.supportsImageInput).toBe(false)
    expect(findModelProfile('deepseek', 'deepseek-v4-flash-vision-exp')?.value).toBe('deepseek-flash')
    expect(findModelProfile('minimax', 'MiniMax-M3')?.thinking?.defaultLevel).toBe('high')
    expect(findModelProfile('openai', 'gpt-5.4')?.thinking?.maxEffort).toBe('xhigh')
  })

  it('keeps non-preset models recognizable without showing them as presets', () => {
    const presets = getPresetModels('openai').map((model) => model.value)

    expect(presets).toEqual(['gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6', 'gpt-5.6-terra', 'gpt-5.6-luna'])
    expect(presets).not.toContain('gpt-5.4')
    expect(findModelProfile('openai', 'gpt-5.4')?.supportsNativeWebSearch).toBe(true)
  })

  it('matches model IDs case-insensitively and expands prefix families', () => {
    expect(findModelProfile('minimax', 'minimax-m3')?.supportsImageInput).toBe(true)
    expect(findModelProfile('kimi', 'KIMI-K3')?.thinking?.request).toBe('reasoning-effort')
    expect(findModelProfile('kimi', 'kimi-k3-lite')?.thinking?.request).toBe('reasoning-effort')
    expect(findModelProfile('kimi', 'kimi-k2.7-code-highspeed')?.supportsImageInput).toBe(false)
  })

  it('keeps provider-level defaults for protocols, temperature and image policy', () => {
    expect(getProviderProfile('openai').protocols).toEqual(['chat_completions', 'responses'])
    expect(getProviderProfile('minimax').temperatureRange).toEqual({ defaultValue: 1, max: 1, min: 0.1 })
    expect(getProviderProfile('deepseek').imageInputPolicy).toBe('follow-model')
    expect(getProviderProfile('kimi').imageInputPolicy).toBe('veto-model')
    expect(getProviderProfile('custom').imageInputPolicy).toBe('user-configurable')
  })
})
