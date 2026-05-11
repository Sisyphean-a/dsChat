import { describe, expect, it } from 'vitest'
import { buildDefaultSettings, createAddedModelDraft } from '../constants/providers'
import { getSendSettingsError, normalizeSettings } from './chatAppSettings'

describe('getSendSettingsError', () => {
  it('allows tool calling without tavily api key', () => {
    const settings = buildDefaultSettings()
    settings.deepseek.apiKey = 'sk-test'
    settings.toolSettings.enabled = true
    settings.toolSettings.builtinTools.tavilySearch.apiKey = ''

    const error = getSendSettingsError(normalizeSettings(settings))
    expect(error).toBeNull()
  })

  it('shows explicit unsupported error for providers without tools support', () => {
    const settings = buildDefaultSettings()
    const openai = createAddedModelDraft('openai', [])
    openai.apiKey = 'sk-openai'
    settings.customModels = [openai]
    settings.activeConfigId = openai.id
    settings.toolSettings.enabled = true
    settings.toolSettings.openaiUseNativeWebSearch = false
    settings.toolSettings.builtinTools.tavilySearch.apiKey = 'tvly-key'

    const error = getSendSettingsError(normalizeSettings(settings))
    expect(error).toBe('OpenAI 当前配置暂不支持工具调用。')
  })

  it('allows openai when native web_search compatibility is enabled', () => {
    const settings = buildDefaultSettings()
    const openai = createAddedModelDraft('openai', [])
    openai.apiKey = 'sk-openai'
    settings.customModels = [openai]
    settings.activeConfigId = openai.id
    settings.toolSettings.enabled = true
    settings.toolSettings.openaiUseNativeWebSearch = true

    const error = getSendSettingsError(normalizeSettings(settings))
    expect(error).toBeNull()
  })

  it('requires at least one enabled builtin tool when tool calling is enabled', () => {
    const settings = buildDefaultSettings()
    settings.deepseek.apiKey = 'sk-test'
    settings.toolSettings.enabled = true
    settings.toolSettings.builtinTools.currentTime.enabled = false
    settings.toolSettings.builtinTools.tavilySearch.enabled = false

    const error = getSendSettingsError(normalizeSettings(settings))
    expect(error).toBe('请至少启用一个内置工具。')
  })

  it('shows explicit error when custom tool is enabled', () => {
    const settings = buildDefaultSettings()
    settings.deepseek.apiKey = 'sk-test'
    settings.toolSettings.enabled = true
    settings.toolSettings.customTools = [{
      id: 'custom-1',
      name: '我的工具',
      description: '',
      enabled: true,
      url: 'https://example.com',
      method: 'POST',
      headers: [],
    }]

    const error = getSendSettingsError(normalizeSettings(settings))
    expect(error).toBe('自定义工具暂未接入执行引擎，请先关闭已启用的自定义工具。')
  })
})

describe('normalizeSettings', () => {
  it('migrates legacy tavilyApiKey into builtin tavily config', () => {
    const settings = buildDefaultSettings() as ReturnType<typeof buildDefaultSettings> & {
      toolSettings: ReturnType<typeof buildDefaultSettings>['toolSettings'] & { tavilyApiKey?: string }
    }
    settings.toolSettings = {
      ...settings.toolSettings,
      tavilyApiKey: 'tvly-legacy-key',
      builtinTools: {
        currentTime: {
          enabled: true,
        },
        tavilySearch: {
          enabled: true,
          apiKey: '',
          baseUrl: 'https://api.tavily.com/search',
        },
      },
    }

    const normalized = normalizeSettings(settings)
    expect(normalized.toolSettings.builtinTools.tavilySearch.apiKey).toBe('tvly-legacy-key')
    expect(normalized.toolSettings.builtinTools.tavilySearch.baseUrl).toBe('https://api.tavily.com/search')
  })
})
