import { FONT_SIZE_OPTIONS, THEME_OPTIONS } from '../constants/app'
import {
  buildDefaultProviderSettings,
  DEFAULT_CONFIG_ID,
  findProviderModel,
  getProviderDefinition,
  getProviderTemperatureRange,
  isAddableProviderId,
} from '../constants/providers'
import {
  DEFAULT_UTOOLS_UPLOAD_MODE,
  UTOOLS_UPLOAD_MODES,
} from '../constants/storage'
import type {
  ActiveProviderSettings,
  AddedModelConfig,
  AddableProviderId,
  FontSizeMode,
  ModelConfigOption,
  ProviderId,
  ProviderSettings,
  ProviderThinkingSettings,
  SettingsForm,
} from '../types/chat'

const OPENAI_MODEL_REPLACEMENTS: Record<string, string> = {
  'gpt-5-search-api': 'gpt-5.5',
}

export function normalizeSettings(currentSettings: SettingsForm): SettingsForm {
  const customModels = normalizeCustomModels(currentSettings.customModels)

  return {
    activeConfigId: normalizeActiveConfigId(currentSettings.activeConfigId, customModels),
    customModels,
    deepseek: normalizeProviderSettings('deepseek', currentSettings.deepseek),
    fontSize: normalizeFontSize(currentSettings.fontSize),
    providerThinking: normalizeProviderThinking(currentSettings.providerThinking),
    toolSettings: normalizeToolSettings(currentSettings.toolSettings),
    theme: normalizeTheme(currentSettings.theme),
    utoolsUploadMode: normalizeUtoolsUploadMode(currentSettings.utoolsUploadMode),
  }
}

export function getSendSettingsError(currentSettings: SettingsForm): string | null {
  const activeSettings = getActiveProviderSettings(currentSettings)

  if (!activeSettings.apiKey.trim()) {
    return `请先在设置面板中填写 ${activeSettings.label} API Key。`
  }

  if (!activeSettings.baseUrl.trim()) {
    return `请先在设置面板中填写 ${activeSettings.label} Base URL。`
  }

  if (!activeSettings.model.trim()) {
    return `请先在设置面板中选择 ${activeSettings.label} 模型。`
  }

  if (currentSettings.toolSettings.enabled && !currentSettings.toolSettings.tavilyApiKey.trim()) {
    return '请先在设置面板中填写 Tavily API Key。'
  }

  if (currentSettings.toolSettings.enabled && !providerSupportsToolCalling(activeSettings.provider)) {
    return `${activeSettings.label} 当前配置暂不支持工具调用。`
  }

  return null
}

export function getActiveProviderSettings(settings: SettingsForm): ActiveProviderSettings {
  if (settings.activeConfigId === DEFAULT_CONFIG_ID) {
    return {
      configId: DEFAULT_CONFIG_ID,
      label: getProviderDefinition('deepseek').label,
      provider: 'deepseek',
      ...normalizeProviderSettings('deepseek', settings.deepseek),
    }
  }

  const current = settings.customModels.find((item) => item.id === settings.activeConfigId)
  if (!current) {
    return {
      configId: DEFAULT_CONFIG_ID,
      label: getProviderDefinition('deepseek').label,
      provider: 'deepseek',
      ...normalizeProviderSettings('deepseek', settings.deepseek),
    }
  }

  return {
    configId: current.id,
    label: current.name.trim() || getProviderDefinition(current.provider).label,
    provider: current.provider,
    ...normalizeProviderSettings(current.provider, current),
  }
}

export function getModelConfigOptions(settings: SettingsForm): ModelConfigOption[] {
  const normalizedSettings = normalizeSettings(settings)

  return [
    {
      badge: 'DeepSeek',
      detail: '',
      label: 'DeepSeek',
      shortLabel: 'DeepSeek',
      value: DEFAULT_CONFIG_ID,
    },
    ...normalizedSettings.customModels.map((item) => ({
      badge: getProviderDefinition(item.provider).shortLabel,
      detail: '',
      label: item.name,
      shortLabel: item.name,
      value: item.id,
    })),
  ]
}

export function getActiveModelSelectionOptions(settings: SettingsForm): string[] {
  const activeSettings = getActiveProviderSettings(settings)
  if (!activeSettings.modelOptions.length) {
    return activeSettings.model ? [activeSettings.model.trim()] : []
  }

  return activeSettings.modelOptions.map((item) => item.trim()).filter(Boolean)
}

export function normalizeModelOptions(
  incomingOptions: ProviderSettings['modelOptions'] | undefined,
  fallbackOptions: string[],
): string[] {
  const source = Array.isArray(incomingOptions) ? incomingOptions : fallbackOptions
  const normalized: string[] = []
  const visited = new Set<string>()

  for (const item of source) {
    const value = item.trim()
    if (!value || visited.has(value)) {
      continue
    }

    visited.add(value)
    normalized.push(value)
  }

  return normalized
}

export function modelSupportsTemperature(provider: ProviderId, model: string): boolean {
  const matched = findProviderModel(provider, model)
  return matched?.supportsTemperature ?? true
}

function normalizeCustomModels(incomingModels: SettingsForm['customModels'] | undefined): AddedModelConfig[] {
  if (!Array.isArray(incomingModels)) {
    return []
  }

  const ids = new Set<string>()
  const normalized: AddedModelConfig[] = []

  for (const item of incomingModels) {
    const next = normalizeCustomModel(item)
    if (ids.has(next.id)) {
      continue
    }

    ids.add(next.id)
    normalized.push(next)
  }

  return normalized
}

function normalizeCustomModel(incomingModel: Partial<AddedModelConfig>): AddedModelConfig {
  const provider = normalizeCustomProvider(incomingModel.provider)

  return {
    id: incomingModel.id?.trim() || `${provider}-${Math.random().toString(36).slice(2, 8)}`,
    name: incomingModel.name?.trim() || getProviderDefinition(provider).label,
    provider,
    ...normalizeProviderSettings(provider, incomingModel),
  }
}

function normalizeProviderSettings(
  provider: ProviderId,
  incomingSettings?: Partial<ProviderSettings>,
): ProviderSettings {
  const defaults = buildDefaultProviderSettings(provider)
  const rawModel = incomingSettings?.model === undefined
    ? defaults.model
    : incomingSettings.model.trim()
  const model = normalizeProviderModel(provider, rawModel, defaults.model)
  const normalizedModelOptions = normalizeProviderModelOptions(
    provider,
    normalizeModelOptions(incomingSettings?.modelOptions, defaults.modelOptions),
  )
  const modelOptions = provider === DEFAULT_CONFIG_ID
    ? defaults.modelOptions
    : ensureModelOption(normalizedModelOptions, model)

  return {
    apiKey: incomingSettings?.apiKey?.trim() ?? defaults.apiKey,
    baseUrl: incomingSettings?.baseUrl === undefined
      ? defaults.baseUrl
      : incomingSettings.baseUrl.trim(),
    model,
    modelOptions,
    temperature: normalizeTemperature(provider, model, incomingSettings?.temperature),
  }
}

function normalizeProviderModel(provider: ProviderId, model: string, fallback: string): string {
  if (provider !== 'openai') {
    return model
  }

  return OPENAI_MODEL_REPLACEMENTS[model] ?? fallbackIfEmpty(model, fallback)
}

function normalizeProviderModelOptions(provider: ProviderId, options: string[]): string[] {
  if (provider !== 'openai') {
    return options
  }

  const normalized: string[] = []
  const seen = new Set<string>()

  for (const item of options) {
    const replaced = OPENAI_MODEL_REPLACEMENTS[item] ?? item
    if (!replaced || seen.has(replaced)) {
      continue
    }

    seen.add(replaced)
    normalized.push(replaced)
  }

  return normalized
}

function fallbackIfEmpty(model: string, fallback: string): string {
  return model || fallback
}

function ensureModelOption(options: string[], model: string): string[] {
  const value = model.trim()
  if (!value || options.includes(value)) {
    return options
  }

  return [...options, value]
}

function normalizeTemperature(
  provider: ProviderId,
  model: string,
  temperature: number | undefined,
): number {
  const range = getProviderTemperatureRange(provider)

  if (typeof temperature !== 'number' || !Number.isFinite(temperature)) {
    return range.defaultValue
  }

  if (!modelSupportsTemperature(provider, model)) {
    return range.defaultValue
  }

  const roundedTemperature = Number(temperature.toFixed(1))
  return Math.min(range.max, Math.max(range.min, roundedTemperature))
}

function normalizeActiveConfigId(
  activeConfigId: string | undefined,
  customModels: AddedModelConfig[],
): string {
  if (activeConfigId === DEFAULT_CONFIG_ID) {
    return DEFAULT_CONFIG_ID
  }

  return customModels.some((item) => item.id === activeConfigId)
    ? String(activeConfigId)
    : DEFAULT_CONFIG_ID
}

function normalizeCustomProvider(provider: string | undefined): AddableProviderId {
  return provider && isAddableProviderId(provider) ? provider : 'custom'
}

function normalizeTheme(theme: SettingsForm['theme']): SettingsForm['theme'] {
  return THEME_OPTIONS.includes(theme) ? theme : THEME_OPTIONS[0]
}

function normalizeFontSize(fontSize: SettingsForm['fontSize']): SettingsForm['fontSize'] {
  return FONT_SIZE_OPTIONS.includes(fontSize) ? fontSize : FONT_SIZE_OPTIONS[0]
}

function normalizeProviderThinking(
  providerThinking: SettingsForm['providerThinking'] | undefined,
): ProviderThinkingSettings {
  return {
    deepseek: providerThinking?.deepseek ?? true,
    kimi: providerThinking?.kimi ?? true,
    minimax: providerThinking?.minimax ?? true,
  }
}

function normalizeToolSettings(
  toolSettings: SettingsForm['toolSettings'] | undefined,
): SettingsForm['toolSettings'] {
  const maxToolRounds = normalizeMaxToolRounds(toolSettings?.maxToolRounds)
  return {
    enabled: toolSettings?.enabled ?? false,
    tavilyApiKey: toolSettings?.tavilyApiKey?.trim() ?? '',
    maxToolRounds,
  }
}

function normalizeMaxToolRounds(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 3
  }

  const normalized = Math.floor(value as number)
  return Math.min(10, Math.max(1, normalized))
}

function providerSupportsToolCalling(provider: ProviderId): boolean {
  return provider !== 'openai'
}

export function normalizeUtoolsUploadMode(
  mode: SettingsForm['utoolsUploadMode'] | undefined,
  fallback = DEFAULT_UTOOLS_UPLOAD_MODE,
): SettingsForm['utoolsUploadMode'] {
  return mode && UTOOLS_UPLOAD_MODES.includes(mode) ? mode : fallback
}

export function isLegacyMultiProviderDocShape(value: unknown): value is {
  activeProvider?: string
  fontSize?: FontSizeMode
  providers?: Record<string, Partial<ProviderSettings>>
  providerThinking?: Partial<ProviderThinkingSettings>
  theme?: SettingsForm['theme']
} {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as { activeProvider?: string; providers?: unknown }
  return typeof candidate.activeProvider === 'string'
    && typeof candidate.providers === 'object'
    && candidate.providers !== null
}
