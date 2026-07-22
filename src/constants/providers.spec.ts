import { describe, expect, it } from 'vitest'
import { buildDefaultProviderSettings, getProviderDefaultModelValues } from './providers'

describe('provider model presets', () => {
  it('exposes the current stable model presets and selects the first as default', () => {
    const expectedModels = {
      deepseek: ['deepseek-v4-pro', 'deepseek-v4-flash'],
      kimi: ['kimi-k3', 'kimi-k2.7-code', 'kimi-k2.7-code-highspeed', 'kimi-k2.6'],
      minimax: ['MiniMax-M3', 'MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-M2.5', 'MiniMax-M2.5-highspeed'],
      openai: ['gpt-5.6-sol', 'gpt-5.6', 'gpt-5.6-terra', 'gpt-5.6-luna'],
    } as const

    for (const [provider, models] of Object.entries(expectedModels)) {
      expect(getProviderDefaultModelValues(provider as keyof typeof expectedModels)).toEqual(models)
      expect(buildDefaultProviderSettings(provider as keyof typeof expectedModels).model).toBe(models[0])
    }

    expect(buildDefaultProviderSettings('kimi').capabilities.imageInput).toBe(false)
  })
})
