import { describe, expect, it } from 'vitest'
import { buildDefaultSettings, createAddedModelDraft } from '../constants/providers'
import { canActiveConversationSearchWeb, getSendSettingsError, normalizeSettings } from './chatAppSettings'

describe('getSendSettingsError', () => {
  it('allows tool calling without tavily api key', () => {
    const settings = buildDefaultSettings()
    settings.deepseek.apiKey = 'sk-test'
    settings.toolSettings.enabled = true
    settings.toolSettings.builtinTools.tavilySearch.apiKey = ''

    const error = getSendSettingsError(normalizeSettings(settings))
    expect(error).toBeNull()
  })

  it('allows openai when native web_search compatibility is enabled', () => {
    const settings = buildDefaultSettings()
    const openai = createAddedModelDraft('openai', [])
    openai.apiKey = 'sk-openai'
    settings.customModels = [openai]
    settings.activeConfigId = openai.id
    settings.toolSettings.enabled = true
    settings.toolSettings.builtinTools.tavilySearch.apiKey = 'tvly-key'

    const error = getSendSettingsError(normalizeSettings(settings))
    expect(error).toBeNull()
  })

  it('allows OpenAI-compatible chat completions gateways to use local tools when capabilities are overridden', () => {
    const settings = buildDefaultSettings()
    const openai = createAddedModelDraft('openai', [])
    openai.apiKey = 'sk-openai'
    openai.baseUrl = 'https://proxy.example.com/v1'
    openai.capabilities = {
      ...openai.capabilities,
      nativeWebSearch: false,
      protocol: 'chat_completions',
      toolCalling: true,
    }
    settings.customModels = [openai]
    settings.activeConfigId = openai.id
    settings.toolSettings.enabled = true
    settings.toolSettings.builtinTools.tavilySearch.apiKey = 'tvly-key'

    const error = getSendSettingsError(normalizeSettings(settings))
    expect(error).toBeNull()
  })

  it('rejects local tools when the provider is still configured for responses protocol', () => {
    const settings = buildDefaultSettings()
    const openai = createAddedModelDraft('openai', [])
    openai.apiKey = 'sk-openai'
    openai.baseUrl = 'https://proxy.example.com/v1'
    openai.capabilities = {
      ...openai.capabilities,
      nativeWebSearch: false,
      protocol: 'responses',
      toolCalling: true,
    }
    settings.customModels = [openai]
    settings.activeConfigId = openai.id
    settings.toolSettings.enabled = true
    settings.toolSettings.builtinTools.tavilySearch.apiKey = 'tvly-key'

    const error = getSendSettingsError(normalizeSettings(settings))
    expect(error).toBe('OpenAI 当前配置暂不支持工具调用。')
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

  it('clears legacy custom tools during normalization', () => {
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

    const normalized = normalizeSettings(settings)
    expect(normalized.toolSettings.customTools).toEqual([])
    const error = getSendSettingsError(normalized)
    expect(error).toBe('请至少启用一个内置工具。')
  })
})

describe('normalizeSettings', () => {
  it('restores the default idle timeout for settings saved before this option existed', () => {
    const settings = {
      ...buildDefaultSettings(),
      utoolsSessionIdleTimeoutMinutes: undefined,
    } as unknown as ReturnType<typeof buildDefaultSettings>

    expect(normalizeSettings(settings).utoolsSessionIdleTimeoutMinutes).toBe(1)
  })

  it('preserves system prompts and clears whitespace-only values', () => {
    const settings = buildDefaultSettings()
    settings.systemPrompt = '言简意赅\n避免大段回复'

    expect(normalizeSettings(settings).systemPrompt).toBe('言简意赅\n避免大段回复')

    settings.systemPrompt = '   '
    expect(normalizeSettings(settings).systemPrompt).toBe('')
  })

  it('attaches default provider capabilities to every provider config', () => {
    const settings = buildDefaultSettings()
    const openai = createAddedModelDraft('openai', [])
    settings.customModels = [openai]

    const normalized = normalizeSettings(settings)

    expect(normalized.deepseek.capabilities).toEqual({
      imageInput: false,
      nativeWebSearch: false,
      protocol: 'chat_completions',
      reasoning: true,
      toolCalling: true,
    })
    expect(normalized.customModels[0]?.capabilities).toEqual({
      imageInput: true,
      nativeWebSearch: true,
      protocol: 'responses',
      reasoning: false,
      toolCalling: false,
    })
  })

  it('preserves user capability overrides during normalization', () => {
    const settings = buildDefaultSettings()
    settings.deepseek.capabilities = {
      ...settings.deepseek.capabilities,
      imageInput: true,
      reasoning: false,
    }

    const normalized = normalizeSettings(settings)

    expect(normalized.deepseek.capabilities.imageInput).toBe(true)
    expect(normalized.deepseek.capabilities.reasoning).toBe(false)
  })

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

describe('canActiveConversationSearchWeb', () => {
  it('returns true for OpenAI native web search models', () => {
    const settings = buildDefaultSettings()
    const openai = createAddedModelDraft('openai', [])
    openai.model = 'gpt-5.5'
    settings.customModels = [openai]
    settings.activeConfigId = openai.id
    settings.toolSettings.enabled = false

    expect(canActiveConversationSearchWeb(settings)).toBe(true)
  })

  it('returns false for OpenAI models when native web search capability is disabled', () => {
    const settings = buildDefaultSettings()
    const openai = createAddedModelDraft('openai', [])
    openai.model = 'gpt-5.5'
    openai.capabilities = {
      ...openai.capabilities,
      nativeWebSearch: false,
    }
    settings.customModels = [openai]
    settings.activeConfigId = openai.id
    settings.toolSettings.enabled = false

    expect(canActiveConversationSearchWeb(settings)).toBe(false)
  })

  it('returns true when tavily search is enabled with api key on tool orchestrator providers', () => {
    const settings = buildDefaultSettings()
    settings.toolSettings.enabled = true
    settings.toolSettings.builtinTools.tavilySearch.enabled = true
    settings.toolSettings.builtinTools.tavilySearch.apiKey = 'tvly-key'

    expect(canActiveConversationSearchWeb(settings)).toBe(true)
  })

  it('returns false when tavily key is missing even if search tool is enabled', () => {
    const settings = buildDefaultSettings()
    settings.toolSettings.enabled = true
    settings.toolSettings.builtinTools.tavilySearch.enabled = true
    settings.toolSettings.builtinTools.tavilySearch.apiKey = ''

    expect(canActiveConversationSearchWeb(settings)).toBe(false)
  })
})
