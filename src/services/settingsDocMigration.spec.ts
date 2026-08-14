import { describe, expect, it } from 'vitest'
import { buildDefaultProviderSettings, buildDefaultSettings } from '../constants/providers'
import { migrateSettingsDoc } from './settingsDocMigration'

describe('migrateSettingsDoc', () => {
  it('migrates legacy flat settings docs into the deepseek-first structure', () => {
    const settings = migrateSettingsDoc({
      _id: 'settings/config',
      apiKey: 'sk-legacy',
      baseUrl: 'https://api.deepseek.com/',
      model: 'deepseek-chat',
      temperature: 1.5,
      theme: 'dark',
      type: 'settings',
    }, 'all-data')

    expect(settings.activeConfigId).toBe('deepseek')
    expect(settings.fontSize).toBe('medium')
    expect(settings.deepseek.reasoningLevel).toBe('high')
    expect(settings.theme).toBe('dark')
    expect(settings.utoolsSessionIdleTimeoutMinutes).toBe(1)
    expect(settings.utoolsUploadMode).toBe('all-data')
    expect(settings.deepseek).toEqual({
      apiKey: 'sk-legacy',
      baseUrl: 'https://api.deepseek.com/',
      capabilities: {
        imageInput: false,
        nativeWebSearch: false,
        protocol: 'chat_completions',
        reasoning: true,
        toolCalling: true,
      },
      model: 'deepseek-chat',
      modelOptions: ['deepseek-v4-pro', 'deepseek-v4-flash'],
      reasoningLevel: 'high',
      temperature: 1.5,
    })
    expect(settings.customModels).toEqual([])
  })

  it('migrates legacy provider thinking switches into each provider configuration', () => {
    const { deepseek, systemPrompt: _, ...previousSettings } = buildDefaultSettings()
    const { reasoningLevel: __, ...legacyDeepseek } = deepseek
    const settings = migrateSettingsDoc({
      _id: 'settings/config',
      deepseek: legacyDeepseek,
      providerThinking: { deepseek: false },
      type: 'settings',
      ...previousSettings,
    } as Parameters<typeof migrateSettingsDoc>[0], 'local-only')

    expect(settings.deepseek.reasoningLevel).toBe('off')
  })

  it('adds an empty system prompt to settings saved before the feature existed', () => {
    const { systemPrompt: _, ...previousSettings } = buildDefaultSettings()
    const settings = migrateSettingsDoc({
      _id: 'settings/config',
      type: 'settings',
      ...previousSettings,
    } as Parameters<typeof migrateSettingsDoc>[0], 'all-data')

    expect(settings.systemPrompt).toBe('')
  })

  it('fills the Qwen image tool defaults for saved settings without the new fields', () => {
    const defaults = buildDefaultSettings()
    const settings = migrateSettingsDoc({
      _id: 'settings/config',
      ...defaults,
      toolSettings: {
        ...defaults.toolSettings,
        builtinTools: {
          currentTime: defaults.toolSettings.builtinTools.currentTime,
          tavilySearch: defaults.toolSettings.builtinTools.tavilySearch,
        },
      },
      type: 'settings',
    } as unknown as Parameters<typeof migrateSettingsDoc>[0], 'local-only')

    expect(settings.toolSettings.builtinTools.qwenImage).toEqual({
      enabled: false,
      apiKey: '',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen3-vl-flash',
    })
  })

  it('restores the OpenAI reasoning default from settings saved before reasoning levels', () => {
    const defaults = buildDefaultSettings()
    const { reasoningLevel: _, ...legacyOpenAi } = buildDefaultProviderSettings('openai')
    const settings = migrateSettingsDoc({
      _id: 'settings/config',
      ...defaults,
      activeConfigId: 'openai-legacy',
      customModels: [{
        ...legacyOpenAi,
        capabilities: {
          ...legacyOpenAi.capabilities,
          reasoning: false,
        },
        id: 'openai-legacy',
        name: 'OpenAI',
        provider: 'openai',
      }],
      type: 'settings',
    } as Parameters<typeof migrateSettingsDoc>[0], 'local-only')

    expect(settings.customModels[0]).toMatchObject({
      capabilities: expect.objectContaining({ reasoning: true }),
      reasoningLevel: 'medium',
    })

    const remigrated = migrateSettingsDoc({
      _id: 'settings/config',
      ...settings,
      type: 'settings',
    }, 'local-only')
    expect(remigrated.customModels[0]).toEqual(settings.customModels[0])
  })

  it('keeps an explicit OpenAI reasoning disable from current settings', () => {
    const defaults = buildDefaultSettings()
    const openAi = buildDefaultProviderSettings('openai')
    const settings = migrateSettingsDoc({
      _id: 'settings/config',
      ...defaults,
      activeConfigId: 'openai-current',
      customModels: [{
        ...openAi,
        capabilities: {
          ...openAi.capabilities,
          reasoning: false,
        },
        id: 'openai-current',
        name: 'OpenAI',
        provider: 'openai',
        reasoningLevel: 'off',
      }],
      type: 'settings',
    } as Parameters<typeof migrateSettingsDoc>[0], 'local-only')

    expect(settings.customModels[0]).toMatchObject({
      capabilities: expect.objectContaining({ reasoning: false }),
      reasoningLevel: 'off',
    })
  })

  it('migrates previous multi-provider documents into deepseek plus custom models', () => {
    const settings = migrateSettingsDoc({
      _id: 'settings/config',
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
      providerThinking: {
        kimi: false,
        minimax: true,
        openai: false,
      },
      theme: 'dark',
      type: 'settings',
    }, 'all-data')

    expect(settings.deepseek.apiKey).toBe('sk-deepseek')
    expect(settings.theme).toBe('dark')
    expect(settings.utoolsUploadMode).toBe('all-data')
    expect(settings.customModels.map((item) => item.provider)).toEqual(['openai', 'minimax', 'kimi'])
    expect(settings.customModels.map((item) => item.reasoningLevel)).toEqual(['off', 'high', 'off'])
    expect(settings.customModels[0]?.capabilities.reasoning).toBe(true)
    expect(settings.customModels[0]?.model).toBe('gpt-4.1')
    expect(settings.customModels[2]?.model).toBe('kimi-k2.6')
    expect(settings.activeConfigId).toBe(settings.customModels[0]?.id)
  })
})
