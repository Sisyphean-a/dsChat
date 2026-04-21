import type {
  ProviderId,
  ProviderSettings,
  ProviderSettingsMap,
  SettingsForm,
  ThemeMode,
} from '../types/chat'

export interface ProviderModelOption {
  value: string
  label: string
  shortLabel: string
  description: string
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
  description: string
  apiKeyPlaceholder: string
  baseUrlPlaceholder: string
  models: ProviderModelOption[]
  notes: string[]
  temperature: TemperatureRange
}

const THEME_DEFAULT: ThemeMode = 'light'
const STANDARD_TEMPERATURE: TemperatureRange = { min: 0, max: 2, defaultValue: 1 }
const CLAUDE_TEMPERATURE: TemperatureRange = { min: 0, max: 1, defaultValue: 1 }
const MINIMAX_TEMPERATURE: TemperatureRange = { min: 0.1, max: 1, defaultValue: 1 }

export const DEFAULT_PROVIDER_ID: ProviderId = 'deepseek'
export const PROVIDER_IDS: ProviderId[] = ['deepseek', 'openai', 'claude', 'minimax']

export const PROVIDER_REGISTRY: Record<ProviderId, ProviderDefinition> = {
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    shortLabel: 'DeepSeek',
    description: '默认提供商，保留现有深度思考与流式体验。',
    apiKeyPlaceholder: 'sk-...',
    baseUrlPlaceholder: 'https://api.deepseek.com',
    models: [
      {
        value: 'deepseek-chat',
        label: 'DeepSeek Chat',
        shortLabel: 'Chat',
        description: '通用对话与代码生成',
        supportsTemperature: true,
      },
      {
        value: 'deepseek-reasoner',
        label: 'DeepSeek Reasoner',
        shortLabel: 'Reasoner',
        description: '展示思考过程的推理模型',
        supportsTemperature: false,
      },
    ],
    notes: ['保留现有 `reasoning_content` 展示。'],
    temperature: STANDARD_TEMPERATURE,
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    shortLabel: 'OpenAI',
    description: '使用 OpenAI Chat Completions 兼容接口接入 ChatGPT 模型。',
    apiKeyPlaceholder: 'sk-...',
    baseUrlPlaceholder: 'https://api.openai.com/v1',
    models: [
      {
        value: 'gpt-4.1-mini',
        label: 'GPT-4.1 mini',
        shortLabel: '4.1 mini',
        description: '轻量默认，适合日常问答',
        supportsTemperature: true,
      },
      {
        value: 'gpt-4.1',
        label: 'GPT-4.1',
        shortLabel: '4.1',
        description: '更强的通用与代码能力',
        supportsTemperature: true,
      },
    ],
    notes: ['默认按官方 `chat/completions` 兼容方式发起请求。'],
    temperature: STANDARD_TEMPERATURE,
  },
  claude: {
    id: 'claude',
    label: 'Claude',
    shortLabel: 'Claude',
    description: '通过 Claude OpenAI compatibility 入口接入 Anthropic 模型。',
    apiKeyPlaceholder: 'sk-ant-...',
    baseUrlPlaceholder: 'https://api.anthropic.com/v1',
    models: [
      {
        value: 'claude-sonnet-4-20250514',
        label: 'Claude Sonnet 4',
        shortLabel: 'Sonnet 4',
        description: '默认推荐，速度与质量平衡',
        supportsTemperature: true,
      },
      {
        value: 'claude-opus-4-20250514',
        label: 'Claude Opus 4',
        shortLabel: 'Opus 4',
        description: '更强的复杂任务能力',
        supportsTemperature: true,
      },
    ],
    notes: ['Claude 兼容层不会返回可展示的详细思考流。'],
    temperature: CLAUDE_TEMPERATURE,
  },
  minimax: {
    id: 'minimax',
    label: 'MiniMax',
    shortLabel: 'MiniMax',
    description: '通过 MiniMax OpenAI compatibility 入口接入文本模型。',
    apiKeyPlaceholder: 'sk-...',
    baseUrlPlaceholder: 'https://api.minimaxi.com/v1',
    models: [
      {
        value: 'MiniMax-M2.7',
        label: 'MiniMax M2.7',
        shortLabel: 'M2.7',
        description: '默认推荐，支持 reasoning_split',
        supportsTemperature: true,
      },
      {
        value: 'MiniMax-M2.7-highspeed',
        label: 'MiniMax M2.7 Highspeed',
        shortLabel: 'M2.7 HS',
        description: '更快的高吞吐版本',
        supportsTemperature: true,
      },
    ],
    notes: ['发送请求时启用 `reasoning_split`，可拆分展示思考内容。'],
    temperature: MINIMAX_TEMPERATURE,
  },
}

export function isProviderId(value: string): value is ProviderId {
  return PROVIDER_IDS.includes(value as ProviderId)
}

export function getProviderDefinition(provider: ProviderId): ProviderDefinition {
  return PROVIDER_REGISTRY[provider]
}

export function getProviderDefinitions(): ProviderDefinition[] {
  return PROVIDER_IDS.map((provider) => PROVIDER_REGISTRY[provider])
}

export function getProviderModelOptions(provider: ProviderId): ProviderModelOption[] {
  return PROVIDER_REGISTRY[provider].models
}

export function findProviderModel(provider: ProviderId, model: string): ProviderModelOption | undefined {
  return PROVIDER_REGISTRY[provider].models.find((option) => option.value === model.trim())
}

export function getProviderTemperatureRange(provider: ProviderId): TemperatureRange {
  return PROVIDER_REGISTRY[provider].temperature
}

export function buildDefaultProviderSettings(provider: ProviderId): ProviderSettings {
  const definition = PROVIDER_REGISTRY[provider]
  return {
    apiKey: '',
    baseUrl: definition.baseUrlPlaceholder,
    model: definition.models[0]?.value ?? '',
    temperature: definition.temperature.defaultValue,
  }
}

export function buildDefaultProviderSettingsMap(): ProviderSettingsMap {
  return PROVIDER_IDS.reduce<ProviderSettingsMap>((accumulator, provider) => {
    accumulator[provider] = buildDefaultProviderSettings(provider)
    return accumulator
  }, {} as ProviderSettingsMap)
}

export function buildDefaultSettings(): SettingsForm {
  return {
    activeProvider: DEFAULT_PROVIDER_ID,
    providers: buildDefaultProviderSettingsMap(),
    theme: THEME_DEFAULT,
  }
}
