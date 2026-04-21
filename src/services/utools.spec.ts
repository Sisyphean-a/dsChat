import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildDefaultSettings } from '../constants/providers'
import { loadSettings, saveSettings } from './utools'

describe('utools settings migration', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete window.utools
  })

  it('migrates legacy flat settings docs into the multi-provider structure', async () => {
    Object.defineProperty(window, 'utools', {
      configurable: true,
      value: {
        db: {
          promises: {
            allDocs: vi.fn(),
            get: vi.fn().mockResolvedValue({
              _id: 'settings/config',
              type: 'settings',
              apiKey: 'sk-legacy',
              baseUrl: 'https://api.deepseek.com/',
              model: 'deepseek-chat',
              temperature: 1.5,
              theme: 'dark',
            }),
            put: vi.fn(),
            remove: vi.fn(),
          },
        },
      },
    })

    const settings = await loadSettings()

    expect(settings.activeProvider).toBe('deepseek')
    expect(settings.theme).toBe('dark')
    expect(settings.providers.deepseek).toEqual({
      apiKey: 'sk-legacy',
      baseUrl: 'https://api.deepseek.com/',
      model: 'deepseek-chat',
      temperature: 1.5,
    })
    expect(settings.providers.openai.model).toBe('gpt-4.1-mini')
  })

  it('round-trips the new multi-provider settings format in memory mode', async () => {
    const settings = buildDefaultSettings()
    settings.activeProvider = 'openai'
    settings.theme = 'dark'
    settings.providers.openai.apiKey = 'sk-openai'
    settings.providers.openai.model = 'gpt-4.1'

    await saveSettings(settings)
    const loaded = await loadSettings()

    expect(loaded.activeProvider).toBe('openai')
    expect(loaded.theme).toBe('dark')
    expect(loaded.providers.openai).toEqual({
      apiKey: 'sk-openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1',
      temperature: 1,
    })
  })
})
