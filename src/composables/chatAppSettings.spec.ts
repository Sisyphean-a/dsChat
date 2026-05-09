import { describe, expect, it } from 'vitest'
import { buildDefaultSettings, createAddedModelDraft } from '../constants/providers'
import { getSendSettingsError, normalizeSettings } from './chatAppSettings'

describe('getSendSettingsError', () => {
  it('requires tavily api key when tool calling is enabled', () => {
    const settings = buildDefaultSettings()
    settings.deepseek.apiKey = 'sk-test'
    settings.toolSettings.enabled = true
    settings.toolSettings.tavilyApiKey = ''

    const error = getSendSettingsError(normalizeSettings(settings))
    expect(error).toBe('请先在设置面板中填写 Tavily API Key。')
  })

  it('shows explicit unsupported error for providers without tools support', () => {
    const settings = buildDefaultSettings()
    const openai = createAddedModelDraft('openai', [])
    openai.apiKey = 'sk-openai'
    settings.customModels = [openai]
    settings.activeConfigId = openai.id
    settings.toolSettings.enabled = true
    settings.toolSettings.tavilyApiKey = 'tvly-key'

    const error = getSendSettingsError(normalizeSettings(settings))
    expect(error).toBe('OpenAI 当前配置暂不支持工具调用。')
  })
})
