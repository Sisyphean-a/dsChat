import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildDefaultSettings, createAddedModelDraft } from '../constants/providers'
import { loadSettings, saveSettings } from './utools'

describe('utools settings migration', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete window.utools
  })

  it('migrates legacy flat settings docs into the deepseek-first structure', async () => {
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

    expect(settings.activeConfigId).toBe('deepseek')
    expect(settings.theme).toBe('dark')
    expect(settings.deepseek).toEqual({
      apiKey: 'sk-legacy',
      baseUrl: 'https://api.deepseek.com/',
      model: 'deepseek-chat',
      temperature: 1.5,
    })
    expect(settings.customModels).toEqual([])
  })

  it('migrates the previous multi-provider document into deepseek plus custom models', async () => {
    Object.defineProperty(window, 'utools', {
      configurable: true,
      value: {
        db: {
          promises: {
            allDocs: vi.fn(),
            get: vi.fn().mockResolvedValue({
              _id: 'settings/config',
              type: 'settings',
              activeProvider: 'openai',
              providers: {
                claude: {
                  apiKey: 'sk-ant-test',
                  baseUrl: 'https://api.anthropic.com/v1',
                  model: 'claude-sonnet-4-6',
                  temperature: 1,
                },
                deepseek: {
                  apiKey: 'sk-deepseek',
                  baseUrl: 'https://api.deepseek.com',
                  model: 'deepseek-chat',
                  temperature: 1,
                },
                kimi: {
                  apiKey: '',
                  baseUrl: 'https://api.moonshot.cn/v1',
                  model: 'kimi-k2.6',
                  temperature: 1,
                },
                minimax: {
                  apiKey: 'sk-minimax',
                  baseUrl: 'https://api.minimaxi.com/v1',
                  model: 'MiniMax-M2.7',
                  temperature: 1,
                },
                openai: {
                  apiKey: 'sk-openai',
                  baseUrl: 'https://api.openai.com/v1',
                  model: 'gpt-4.1',
                  temperature: 1,
                },
              },
              theme: 'dark',
            }),
            put: vi.fn(),
            remove: vi.fn(),
          },
        },
      },
    })

    const settings = await loadSettings()

    expect(settings.deepseek.apiKey).toBe('sk-deepseek')
    expect(settings.theme).toBe('dark')
    expect(settings.customModels.map((item) => item.provider)).toEqual(['openai', 'minimax'])
    expect(settings.customModels[0]?.model).toBe('gpt-4.1')
    expect(settings.activeConfigId).toBe(settings.customModels[0]?.id)
  })

  it('round-trips the new settings format in memory mode', async () => {
    const settings = buildDefaultSettings()
    const openaiModel = createAddedModelDraft('openai', [])
    openaiModel.name = 'OpenAI 工作模型'
    openaiModel.apiKey = 'sk-openai'
    openaiModel.model = 'gpt-4.1'

    settings.activeConfigId = openaiModel.id
    settings.theme = 'dark'
    settings.customModels = [openaiModel]

    await saveSettings(settings)
    const loaded = await loadSettings()

    expect(loaded.activeConfigId).toBe(openaiModel.id)
    expect(loaded.theme).toBe('dark')
    expect(loaded.customModels[0]).toEqual({
      ...openaiModel,
      baseUrl: 'https://api.openai.com/v1',
      temperature: 1,
    })
  })
})
