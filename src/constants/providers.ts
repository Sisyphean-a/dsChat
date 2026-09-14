import type {
  AddableProviderId,
  AddedModelConfig,
  FontSizeMode,
  ProviderId,
  ProviderSettings,
  SettingsForm,
  ToolSettings,
  ThemeMode,
} from '../types/chat'
import {
  DEFAULT_UTOOLS_SESSION_IDLE_TIMEOUT_MINUTES,
  DEFAULT_UTOOLS_UPLOAD_MODE,
} from './storage'
import {
  DEFAULT_TAVILY_SEARCH_BASE_URL,
  DEFAULT_QWEN_IMAGE_BASE_URL,
  DEFAULT_QWEN_IMAGE_MODEL,
} from './tools'
import { getDefaultThinkingLevel } from './thinking'
import { getDefaultProviderCapabilities } from './providerCapabilities'
import { getPresetModels, getProviderProfile } from './providerProfiles'

export interface ProviderModelOption {
  supportsImageInput: boolean
  supportsTemperature: boolean
  value: string
}

export interface ProviderDefinition {
  id: ProviderId
  label: string
  shortLabel: string
  docsUrl: string
  apiKeyPlaceholder: string
  baseUrlDefault: string
  baseUrlPlaceholder: string
  defaultModels: ProviderModelOption[]
}

const THEME_DEFAULT: ThemeMode = 'light'
const FONT_SIZE_DEFAULT: FontSizeMode = 'medium'
const DEFAULT_TOOL_SETTINGS: ToolSettings = {
  enabled: false,
  builtinTools: {
    currentTime: {
      enabled: true,
    },
    tavilySearch: {
      enabled: true,
      apiKey: '',
      baseUrl: DEFAULT_TAVILY_SEARCH_BASE_URL,
    },
    qwenImage: {
      enabled: false,
      apiKey: '',
      baseUrl: DEFAULT_QWEN_IMAGE_BASE_URL,
      model: DEFAULT_QWEN_IMAGE_MODEL,
    },
  },
  customTools: [],
}

export const DEFAULT_CONFIG_ID = 'deepseek'
export const ADDABLE_PROVIDER_IDS: AddableProviderId[] = ['openai', 'minimax', 'kimi', 'custom']

export const PROVIDER_REGISTRY: Record<ProviderId, ProviderDefinition> = {
  custom: {
    id: 'custom',
    label: '自定义',
    shortLabel: '自定义',
    docsUrl: '',
    apiKeyPlaceholder: 'sk-...',
    baseUrlDefault: '',
    baseUrlPlaceholder: 'https://your-api.example.com/v1',
    defaultModels: [],
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    shortLabel: 'DeepSeek',
    docsUrl: 'https://api-docs.deepseek.com/',
    apiKeyPlaceholder: 'sk-...',
    baseUrlDefault: 'https://api.deepseek.com',
    baseUrlPlaceholder: 'https://api.deepseek.com',
    defaultModels: createDefaultModels('deepseek'),
  },
  kimi: {
    id: 'kimi',
    label: 'Kimi',
    shortLabel: 'Kimi',
    docsUrl: 'https://platform.kimi.com/docs/models',
    apiKeyPlaceholder: 'sk-...',
    baseUrlDefault: 'https://api.moonshot.cn/v1',
    baseUrlPlaceholder: 'https://api.moonshot.cn/v1',
    defaultModels: createDefaultModels('kimi'),
  },
  minimax: {
    id: 'minimax',
    label: 'MiniMax',
    shortLabel: 'MiniMax',
    docsUrl: 'https://platform.minimaxi.com/docs/guides/text-generation',
    apiKeyPlaceholder: 'sk-...',
    baseUrlDefault: 'https://api.minimaxi.com/v1',
    baseUrlPlaceholder: 'https://api.minimaxi.com/v1',
    defaultModels: createDefaultModels('minimax'),
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    shortLabel: 'OpenAI',
    docsUrl: 'https://developers.openai.com/api/docs/models',
    apiKeyPlaceholder: 'sk-...',
    baseUrlDefault: 'https://api.openai.com/v1',
    baseUrlPlaceholder: 'https://api.openai.com/v1',
    defaultModels: createDefaultModels('openai'),
  },
}

export function isAddableProviderId(value: string): value is AddableProviderId {
  return ADDABLE_PROVIDER_IDS.includes(value as AddableProviderId)
}

export function getProviderDefinition(provider: ProviderId): ProviderDefinition {
  return PROVIDER_REGISTRY[provider]
}

export function getAddableProviderDefinitions(): ProviderDefinition[] {
  return ADDABLE_PROVIDER_IDS.map((provider) => PROVIDER_REGISTRY[provider])
}

export function getProviderDefaultModelValues(provider: ProviderId): string[] {
  return PROVIDER_REGISTRY[provider].defaultModels.map((option) => option.value)
}

export function buildDefaultProviderSettings(provider: ProviderId): ProviderSettings {
  const definition = PROVIDER_REGISTRY[provider]
  const model = definition.defaultModels[0]?.value ?? ''
  return {
    apiKey: '',
    baseUrl: definition.baseUrlDefault,
    capabilities: getDefaultProviderCapabilities(provider, model),
    model,
    modelOptions: getProviderDefaultModelValues(provider),
    reasoningLevel: getDefaultThinkingLevel(provider, model),
    temperature: getProviderProfile(provider).temperatureRange.defaultValue,
  }
}

export function buildDefaultSettings(): SettingsForm {
  return {
    activeConfigId: DEFAULT_CONFIG_ID,
    customModels: [],
    deepseek: buildDefaultProviderSettings('deepseek'),
    fontSize: FONT_SIZE_DEFAULT,
    systemPrompt: '',
    toolSettings: {
      ...DEFAULT_TOOL_SETTINGS,
    },
    theme: THEME_DEFAULT,
    utoolsSessionIdleTimeoutMinutes: DEFAULT_UTOOLS_SESSION_IDLE_TIMEOUT_MINUTES,
    utoolsUploadMode: DEFAULT_UTOOLS_UPLOAD_MODE,
  }
}

export function createAddedModelDraft(
  provider: AddableProviderId,
  currentModels: AddedModelConfig[],
): AddedModelConfig {
  return {
    id: createAddedModelId(provider),
    name: createAddedModelName(provider, currentModels),
    provider,
    ...buildDefaultProviderSettings(provider),
  }
}

function createDefaultModels(provider: ProviderId): ProviderModelOption[] {
  return getPresetModels(provider).map((model) => ({
    supportsImageInput: model.supportsImageInput,
    supportsTemperature: model.supportsTemperature,
    value: model.value,
  }))
}

function createAddedModelId(provider: AddableProviderId): string {
  const suffix = Math.random().toString(36).slice(2, 8)
  return `model-${provider}-${Date.now().toString(36)}-${suffix}`
}

function createAddedModelName(
  provider: AddableProviderId,
  currentModels: AddedModelConfig[],
): string {
  const baseName = getProviderDefinition(provider).label
  const currentNames = new Set(currentModels.map((item) => item.name.trim()).filter(Boolean))
  if (!currentNames.has(baseName)) {
    return baseName
  }

  let index = 2
  while (currentNames.has(`${baseName} ${index}`)) {
    index += 1
  }

  return `${baseName} ${index}`
}
