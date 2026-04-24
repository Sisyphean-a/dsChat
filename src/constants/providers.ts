import type {
  AddableProviderId,
  AddedModelConfig,
  ProviderId,
  ProviderSettings,
  SettingsForm,
  ThemeMode,
} from '../types/chat'
import { DEFAULT_UTOOLS_UPLOAD_MODE } from './storage'

export interface ProviderModelOption {
  value: string
  label: string
  shortLabel: string
  supportsTemperature: boolean
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
const STANDARD_TEMPERATURE: TemperatureRange = { min: 0, max: 2, defaultValue: 1 }
const MINIMAX_TEMPERATURE: TemperatureRange = { min: 0.1, max: 1, defaultValue: 1 }
const DEEPSEEK_THINKING_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat'] as const

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
      createModelOption('deepseek-v4-flash', 'DeepSeek V4 Flash', 'V4 Flash', true),
      createModelOption('deepseek-v4-pro', 'DeepSeek V4 Pro', 'V4 Pro', true),
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
      createModelOption('kimi-k2.6', 'Kimi K2.6', 'K2.6', true),
      createModelOption('kimi-k2.5', 'Kimi K2.5', 'K2.5', true),
      createModelOption('kimi-k2-thinking', 'Kimi K2 Thinking', 'Thinking', true),
      createModelOption('kimi-k2-thinking-turbo', 'Kimi K2 Thinking Turbo', 'Thinking Turbo', true),
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
      createModelOption('MiniMax-M2.7', 'MiniMax M2.7', 'M2.7', true),
      createModelOption('MiniMax-M2.7-highspeed', 'MiniMax M2.7 Highspeed', 'M2.7 HS', true),
      createModelOption('MiniMax-M2.5', 'MiniMax M2.5', 'M2.5', true),
      createModelOption('MiniMax-M2.5-highspeed', 'MiniMax M2.5 Highspeed', 'M2.5 HS', true),
    ],
    temperature: MINIMAX_TEMPERATURE,
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    shortLabel: 'OpenAI',
    docsUrl: 'https://platform.openai.com/docs/models',
    apiKeyPlaceholder: 'sk-...',
    baseUrlDefault: 'https://api.openai.com/v1',
    baseUrlPlaceholder: 'https://api.openai.com/v1',
    defaultModels: [
      createModelOption('gpt-5.2', 'GPT-5.2', '5.2', true),
      createModelOption('gpt-5-mini', 'GPT-5 mini', '5 mini', true),
      createModelOption('gpt-5-nano', 'GPT-5 nano', '5 nano', true),
      createModelOption('gpt-4.1', 'GPT-4.1', '4.1', true),
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

export function getProviderTemperatureRange(provider: ProviderId): TemperatureRange {
  return PROVIDER_REGISTRY[provider].temperature
}

export function supportsDeepseekThinking(model: string): boolean {
  return DEEPSEEK_THINKING_MODELS.includes(model.trim() as (typeof DEEPSEEK_THINKING_MODELS)[number])
}

export function buildDefaultProviderSettings(provider: ProviderId): ProviderSettings {
  const definition = PROVIDER_REGISTRY[provider]
  return {
    apiKey: '',
    baseUrl: definition.baseUrlDefault,
    model: definition.defaultModels[0]?.value ?? '',
    modelOptions: getProviderDefaultModelValues(provider),
    temperature: definition.temperature.defaultValue,
  }
}

export function buildDefaultSettings(): SettingsForm {
  return {
    activeConfigId: DEFAULT_CONFIG_ID,
    customModels: [],
    deepseek: buildDefaultProviderSettings('deepseek'),
    theme: THEME_DEFAULT,
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

function createModelOption(
  value: string,
  label: string,
  shortLabel: string,
  supportsTemperature: boolean,
): ProviderModelOption {
  return {
    value,
    label,
    shortLabel,
    supportsTemperature,
  }
}
