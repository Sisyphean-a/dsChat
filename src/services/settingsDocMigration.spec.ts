import { describe, expect, it } from 'vitest'
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
    expect(settings.providerThinking).toEqual({
      deepseek: true,
      kimi: true,
      minimax: true,
    })
    expect(settings.theme).toBe('dark')
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
      temperature: 1.5,
    })
    expect(settings.customModels).toEqual([])
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
      theme: 'dark',
      type: 'settings',
    }, 'all-data')

    expect(settings.deepseek.apiKey).toBe('sk-deepseek')
    expect(settings.theme).toBe('dark')
    expect(settings.utoolsUploadMode).toBe('all-data')
    expect(settings.customModels.map((item) => item.provider)).toEqual(['openai', 'minimax', 'kimi'])
    expect(settings.customModels[0]?.model).toBe('gpt-4.1')
    expect(settings.customModels[2]?.model).toBe('kimi-k2.6')
    expect(settings.activeConfigId).toBe(settings.customModels[0]?.id)
  })
})
