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

  if (currentSettings.toolSettings.enabled && hasEnabledCustomTool(currentSettings.toolSettings)) {
    return '自定义工具暂未接入执行引擎，请先关闭已启用的自定义工具。'
  }

  if (currentSettings.toolSettings.enabled && !hasEnabledBuiltinTool(currentSettings.toolSettings)) {
    return '请至少启用一个内置工具。'
  }

  if (currentSettings.toolSettings.enabled && !providerSupportsToolCalling(
    activeSettings.provider,
    currentSettings.toolSettings,
  )) {
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
  const legacy = toolSettings as Partial<{
    tavilyApiKey: string
  }>
  const maxToolRounds = normalizeMaxToolRounds(toolSettings?.maxToolRounds)
  const builtinTools = normalizeBuiltinToolSettings(toolSettings, legacy.tavilyApiKey)
  const customTools = normalizeCustomToolSettings(toolSettings)
  return {
    enabled: toolSettings?.enabled ?? false,
    openaiUseNativeWebSearch: toolSettings?.openaiUseNativeWebSearch ?? true,
    maxToolRounds,
    builtinTools,
    customTools,
  }
}

function normalizeBuiltinToolSettings(
  toolSettings: SettingsForm['toolSettings'] | undefined,
  legacyTavilyApiKey: string | undefined,
): SettingsForm['toolSettings']['builtinTools'] {
  const builtinTavilyApiKey = toolSettings?.builtinTools?.tavilySearch?.apiKey?.trim() ?? ''
  const normalizedLegacyTavilyApiKey = legacyTavilyApiKey?.trim() ?? ''
  return {
    currentTime: {
      enabled: toolSettings?.builtinTools?.currentTime?.enabled ?? true,
    },
    tavilySearch: {
      enabled: toolSettings?.builtinTools?.tavilySearch?.enabled ?? true,
      apiKey: builtinTavilyApiKey || normalizedLegacyTavilyApiKey,
    },
  }
}

function normalizeCustomToolSettings(
  toolSettings: SettingsForm['toolSettings'] | undefined,
): SettingsForm['toolSettings']['customTools'] {
  if (!Array.isArray(toolSettings?.customTools)) {
    return []
  }

  const ids = new Set<string>()
  const normalized: SettingsForm['toolSettings']['customTools'] = []
  for (const item of toolSettings.customTools) {
    const id = item.id?.trim() || createCustomToolId()
    if (ids.has(id)) {
      continue
    }

    ids.add(id)
    normalized.push({
      id,
      name: item.name?.trim() || '未命名工具',
      description: item.description?.trim() ?? '',
      enabled: item.enabled ?? false,
      url: item.url?.trim() ?? '',
      method: item.method === 'GET' ? 'GET' : 'POST',
      headers: normalizeCustomToolHeaders(item.headers),
    })
  }

  return normalized
}

function normalizeCustomToolHeaders(
  headers: SettingsForm['toolSettings']['customTools'][number]['headers'] | undefined,
): SettingsForm['toolSettings']['customTools'][number]['headers'] {
  if (!Array.isArray(headers)) {
    return []
  }

  return headers
    .map((item) => ({
      key: item.key?.trim() ?? '',
      value: item.value?.trim() ?? '',
    }))
    .filter((item) => item.key || item.value)
}

function createCustomToolId(): string {
  return `tool-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeMaxToolRounds(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 3
  }

  const normalized = Math.floor(value as number)
  return Math.min(10, Math.max(1, normalized))
}

function providerSupportsToolCalling(
  provider: ProviderId,
  toolSettings: SettingsForm['toolSettings'],
): boolean {
  if (provider !== 'openai') {
    return true
  }

  return toolSettings.openaiUseNativeWebSearch
}

function hasEnabledBuiltinTool(toolSettings: SettingsForm['toolSettings']): boolean {
  const { currentTime, tavilySearch } = toolSettings.builtinTools
  return currentTime.enabled || tavilySearch.enabled
}

function hasEnabledCustomTool(toolSettings: SettingsForm['toolSettings']): boolean {
  return toolSettings.customTools.some((item) => item.enabled)
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
