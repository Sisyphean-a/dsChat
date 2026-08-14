import type {
  AddableProviderId,
  AddedModelConfig,
  FontSizeMode,
  ProviderId,
  ProviderCapabilities,
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

export interface ProviderModelOption {
  supportsImageInput: boolean
  supportsTemperature: boolean
  value: string
}

interface TemperatureRange {
  defaultValue: number
  max: number
  min: number
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
  temperature: TemperatureRange
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
const STANDARD_TEMPERATURE: TemperatureRange = { min: 0, max: 2, defaultValue: 1 }
const MINIMAX_TEMPERATURE: TemperatureRange = { min: 0.1, max: 1, defaultValue: 1 }

export const DEFAULT_CONFIG_ID = 'deepseek'
export const PROVIDER_IDS: ProviderId[] = ['deepseek', 'openai', 'minimax', 'kimi', 'custom']
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
    temperature: STANDARD_TEMPERATURE,
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    shortLabel: 'DeepSeek',
    docsUrl: 'https://api-docs.deepseek.com/',
    apiKeyPlaceholder: 'sk-...',
    baseUrlDefault: 'https://api.deepseek.com',
    baseUrlPlaceholder: 'https://api.deepseek.com',
    defaultModels: [
      createModelOption('deepseek-v4-pro', true, false),
      createModelOption('deepseek-v4-flash', true, false),
    ],
    temperature: STANDARD_TEMPERATURE,
  },
  kimi: {
    id: 'kimi',
    label: 'Kimi',
    shortLabel: 'Kimi',
    docsUrl: 'https://platform.kimi.com/docs/models',
    apiKeyPlaceholder: 'sk-...',
    baseUrlDefault: 'https://api.moonshot.cn/v1',
    baseUrlPlaceholder: 'https://api.moonshot.cn/v1',
    defaultModels: [
      createModelOption('kimi-k3', true, false),
      createModelOption('kimi-k2.7-code', true, false),
      createModelOption('kimi-k2.7-code-highspeed', true, false),
      createModelOption('kimi-k2.6', true, true),
    ],
    temperature: STANDARD_TEMPERATURE,
  },
  minimax: {
    id: 'minimax',
    label: 'MiniMax',
    shortLabel: 'MiniMax',
    docsUrl: 'https://platform.minimaxi.com/docs/guides/text-generation',
    apiKeyPlaceholder: 'sk-...',
    baseUrlDefault: 'https://api.minimaxi.com/v1',
    baseUrlPlaceholder: 'https://api.minimaxi.com/v1',
    defaultModels: [
      createModelOption('MiniMax-M3', true, false),
      createModelOption('MiniMax-M2.7', true, false),
      createModelOption('MiniMax-M2.7-highspeed', true, false),
      createModelOption('MiniMax-M2.5', true, false),
      createModelOption('MiniMax-M2.5-highspeed', true, false),
    ],
    temperature: MINIMAX_TEMPERATURE,
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    shortLabel: 'OpenAI',
    docsUrl: 'https://developers.openai.com/api/docs/models',
    apiKeyPlaceholder: 'sk-...',
    baseUrlDefault: 'https://api.openai.com/v1',
    baseUrlPlaceholder: 'https://api.openai.com/v1',
    defaultModels: [
      createModelOption('gpt-5.6-sol', true, true),
      createModelOption('gpt-5.6', true, true),
      createModelOption('gpt-5.6-terra', true, true),
      createModelOption('gpt-5.6-luna', true, true),
    ],
    temperature: STANDARD_TEMPERATURE,
  },
}

export function isProviderId(value: string): value is ProviderId {
  return PROVIDER_IDS.includes(value as ProviderId)
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

export function getProviderModelOptions(provider: ProviderId): ProviderModelOption[] {
  return PROVIDER_REGISTRY[provider].defaultModels
}

export function getProviderDefaultModelValues(provider: ProviderId): string[] {
  return PROVIDER_REGISTRY[provider].defaultModels.map((option) => option.value)
}

export function findProviderModel(
  provider: ProviderId,
  model: string,
): ProviderModelOption | undefined {
  return PROVIDER_REGISTRY[provider].defaultModels.find((option) => option.value === model.trim())
}

export function providerModelSupportsTemperature(provider: ProviderId, model: string): boolean {
  const matched = findProviderModel(provider, model)
  return matched?.supportsTemperature ?? true
}

export function providerModelSupportsImageInput(provider: ProviderId, model: string): boolean {
  const matched = findProviderModel(provider, model)
  return matched?.supportsImageInput ?? true
}

export function getProviderTemperatureRange(provider: ProviderId): TemperatureRange {
  return PROVIDER_REGISTRY[provider].temperature
}

export function buildDefaultProviderSettings(provider: ProviderId): ProviderSettings {
  const definition = PROVIDER_REGISTRY[provider]
  const model = definition.defaultModels[0]?.value ?? ''
  return {
    apiKey: '',
    baseUrl: definition.baseUrlDefault,
    capabilities: createDefaultProviderCapabilities(provider, model),
    model,
    modelOptions: getProviderDefaultModelValues(provider),
    reasoningLevel: getDefaultThinkingLevel(provider, model),
    temperature: definition.temperature.defaultValue,
  }
}

function createDefaultProviderCapabilities(provider: ProviderId, model: string): ProviderCapabilities {
  if (provider === 'openai') {
    return {
      imageInput: true,
      nativeWebSearch: true,
      protocol: 'responses',
      reasoning: true,
      toolCalling: false,
    }
  }

  if (provider === 'custom' || provider === 'kimi') {
    return {
      imageInput: providerModelSupportsImageInput(provider, model),
      nativeWebSearch: false,
      protocol: 'chat_completions',
      reasoning: provider === 'kimi',
      toolCalling: true,
    }
  }

  return {
    imageInput: false,
    nativeWebSearch: false,
    protocol: 'chat_completions',
    reasoning: true,
    toolCalling: true,
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

function createModelOption(value: string, supportsTemperature: boolean, supportsImageInput: boolean): ProviderModelOption {
  return {
    supportsImageInput,
    supportsTemperature,
    value,
  }
}
