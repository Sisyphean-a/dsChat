import type { ProviderId, ProviderProtocol, ThinkingLevel } from '../types/chat'

/** Rule: 思考参数按模型所属供应商 API 形态生成，request 决定请求 payload 形状。 */
export type ThinkingRequestStyle =
  | 'deepseek-effort'
  | 'reasoning-effort'
  | 'thinking-toggle'
  | 'minimax-adaptive'
  | 'openai-effort'

export interface ModelThinkingProfile {
  defaultLevel: ThinkingLevel
  levels: ThinkingLevel[]
  request: ThinkingRequestStyle
  /** OpenAI 极高等级的供应商写法，默认 max。 */
  maxEffort?: 'max' | 'xhigh'
}

export interface ProviderModelProfile {
  /** 按前缀匹配同族模型 ID；精确匹配优先。 */
  prefixMatch?: boolean
  /** 默认预设列表展示的模型；未标记的模型仍参与能力与思考解析。 */
  preset?: boolean
  supportsImageInput: boolean
  supportsNativeWebSearch?: boolean
  supportsTemperature: boolean
  thinking?: ModelThinkingProfile
  value: string
}

export interface ProviderTemperatureRange {
  defaultValue: number
  max: number
  min: number
}

export interface ProviderCapabilityDefaults {
  imageInput: boolean
  nativeWebSearch: boolean
  protocol: ProviderProtocol
  reasoning: boolean
  toolCalling: boolean
}

/**
 * Rule: imageInput 与模型档案的关系。
 * follow-model=始终跟随模型；veto-model=模型不支持时强制关闭，用户仍可关闭；user-configurable=完全由用户开关决定。
 */
export type ImageInputPolicy = 'follow-model' | 'veto-model' | 'user-configurable'

export interface ProviderProfile {
  aliases: Record<string, string>
  capabilities: ProviderCapabilityDefaults
  defaultThinkingLevel: ThinkingLevel
  imageInputPolicy: ImageInputPolicy
  models: ProviderModelProfile[]
  protocols: ProviderProtocol[]
  temperatureRange: ProviderTemperatureRange
  /** 思考参数要求使用的协议；未声明表示该供应商没有可控思考等级。 */
  thinkingProtocol?: ProviderProtocol
}

const STANDARD_TEMPERATURE: ProviderTemperatureRange = { defaultValue: 1, max: 2, min: 0 }
const MINIMAX_TEMPERATURE: ProviderTemperatureRange = { defaultValue: 1, max: 1, min: 0.1 }

const OPENAI_REASONING_LEVELS: ThinkingLevel[] = ['off', 'low', 'medium', 'high', 'max']

// Rule: 模型 ID 解析忽略大小写；旧 ID 先按 aliases 归一到当前模型。
const PROVIDER_PROFILES: Record<ProviderId, ProviderProfile> = {
  custom: {
    aliases: {},
    capabilities: {
      imageInput: true,
      nativeWebSearch: false,
      protocol: 'chat_completions',
      reasoning: false,
      toolCalling: true,
    },
    defaultThinkingLevel: 'off',
    imageInputPolicy: 'user-configurable',
    models: [],
    protocols: ['chat_completions', 'responses'],
    temperatureRange: STANDARD_TEMPERATURE,
  },
  deepseek: {
    aliases: {
      'deepseek-v4-flash': 'deepseek-flash',
      'deepseek-v4-flash-vision-exp': 'deepseek-flash',
    },
    capabilities: {
      imageInput: false,
      nativeWebSearch: false,
      protocol: 'chat_completions',
      reasoning: true,
      toolCalling: true,
    },
    defaultThinkingLevel: 'high',
    imageInputPolicy: 'follow-model',
    models: [
      {
        supportsImageInput: false,
        supportsTemperature: true,
        thinking: {
          defaultLevel: 'high',
          levels: ['off', 'high', 'max'],
          request: 'deepseek-effort',
        },
        value: 'deepseek-v4-pro',
      },
      {
        supportsImageInput: true,
        supportsTemperature: true,
        thinking: {
          defaultLevel: 'high',
          levels: ['off', 'high', 'max'],
          request: 'deepseek-effort',
        },
        value: 'deepseek-flash',
      },
    ],
    protocols: ['chat_completions'],
    temperatureRange: STANDARD_TEMPERATURE,
    thinkingProtocol: 'chat_completions',
  },
  kimi: {
    aliases: {},
    capabilities: {
      imageInput: true,
      nativeWebSearch: false,
      protocol: 'chat_completions',
      reasoning: true,
      toolCalling: true,
    },
    defaultThinkingLevel: 'high',
    imageInputPolicy: 'veto-model',
    models: [
      {
        prefixMatch: true,
        supportsImageInput: true,
        supportsTemperature: true,
        thinking: {
          defaultLevel: 'max',
          levels: ['low', 'high', 'max'],
          request: 'reasoning-effort',
        },
        value: 'kimi-k3',
      },
      { supportsImageInput: false, supportsTemperature: true, value: 'kimi-k2.7-code' },
      { supportsImageInput: false, supportsTemperature: true, value: 'kimi-k2.7-code-highspeed' },
      {
        prefixMatch: true,
        supportsImageInput: true,
        supportsTemperature: true,
        thinking: {
          defaultLevel: 'high',
          levels: ['off', 'high'],
          request: 'thinking-toggle',
        },
        value: 'kimi-k2.6',
      },
    ],
    protocols: ['chat_completions'],
    temperatureRange: STANDARD_TEMPERATURE,
    thinkingProtocol: 'chat_completions',
  },
  minimax: {
    aliases: {},
    capabilities: {
      imageInput: false,
      nativeWebSearch: false,
      protocol: 'chat_completions',
      reasoning: true,
      toolCalling: true,
    },
    defaultThinkingLevel: 'high',
    imageInputPolicy: 'follow-model',
    models: [
      {
        supportsImageInput: true,
        supportsTemperature: true,
        thinking: {
          defaultLevel: 'high',
          levels: ['off', 'high'],
          request: 'minimax-adaptive',
        },
        value: 'MiniMax-M3',
      },
      { supportsImageInput: false, supportsTemperature: true, value: 'MiniMax-M2.7' },
      { supportsImageInput: false, supportsTemperature: true, value: 'MiniMax-M2.7-highspeed' },
      { supportsImageInput: false, supportsTemperature: true, value: 'MiniMax-M2.5' },
      { supportsImageInput: false, supportsTemperature: true, value: 'MiniMax-M2.5-highspeed' },
    ],
    protocols: ['chat_completions'],
    temperatureRange: MINIMAX_TEMPERATURE,
    thinkingProtocol: 'chat_completions',
  },
  openai: {
    aliases: {},
    capabilities: {
      imageInput: true,
      nativeWebSearch: true,
      protocol: 'responses',
      reasoning: true,
      toolCalling: false,
    },
    defaultThinkingLevel: 'medium',
    imageInputPolicy: 'user-configurable',
    models: [
      {
        supportsImageInput: true,
        supportsNativeWebSearch: true,
        supportsTemperature: true,
        thinking: { defaultLevel: 'medium', levels: OPENAI_REASONING_LEVELS, request: 'openai-effort' },
        value: 'gpt-6-astra',
      },
      {
        supportsImageInput: true,
        supportsNativeWebSearch: true,
        supportsTemperature: true,
        thinking: { defaultLevel: 'medium', levels: OPENAI_REASONING_LEVELS, request: 'openai-effort' },
        value: 'gpt-5.6-sol',
      },
      {
        supportsImageInput: true,
        supportsNativeWebSearch: true,
        supportsTemperature: true,
        thinking: { defaultLevel: 'medium', levels: OPENAI_REASONING_LEVELS, request: 'openai-effort' },
        value: 'gpt-5.6',
      },
      {
        supportsImageInput: true,
        supportsNativeWebSearch: true,
        supportsTemperature: true,
        thinking: { defaultLevel: 'medium', levels: OPENAI_REASONING_LEVELS, request: 'openai-effort' },
        value: 'gpt-5.6-terra',
      },
      {
        supportsImageInput: true,
        supportsNativeWebSearch: true,
        supportsTemperature: true,
        thinking: { defaultLevel: 'medium', levels: OPENAI_REASONING_LEVELS, request: 'openai-effort' },
        value: 'gpt-5.6-luna',
      },
      { preset: false, supportsImageInput: true, supportsNativeWebSearch: true, supportsTemperature: true, value: 'gpt-5.5' },
      {
        preset: false,
        supportsImageInput: true,
        supportsNativeWebSearch: true,
        supportsTemperature: true,
        thinking: {
          defaultLevel: 'medium',
          levels: OPENAI_REASONING_LEVELS,
          maxEffort: 'xhigh',
          request: 'openai-effort',
        },
        value: 'gpt-5.4',
      },
      { preset: false, supportsImageInput: true, supportsNativeWebSearch: true, supportsTemperature: true, value: 'gpt-5.4-mini' },
      { preset: false, supportsImageInput: true, supportsNativeWebSearch: true, supportsTemperature: true, value: 'gpt-5.4-nano' },
      { preset: false, supportsImageInput: true, supportsNativeWebSearch: true, supportsTemperature: true, value: 'gpt-5' },
      { preset: false, supportsImageInput: true, supportsNativeWebSearch: true, supportsTemperature: true, value: 'gpt-5-mini' },
      { preset: false, supportsImageInput: true, supportsNativeWebSearch: true, supportsTemperature: true, value: 'gpt-5-nano' },
    ],
    protocols: ['chat_completions', 'responses'],
    temperatureRange: STANDARD_TEMPERATURE,
    thinkingProtocol: 'responses',
  },
}

export function getProviderProfile(provider: ProviderId): ProviderProfile {
  return PROVIDER_PROFILES[provider]
}

export function getPresetModels(provider: ProviderId): ProviderModelProfile[] {
  return PROVIDER_PROFILES[provider].models.filter((model) => model.preset !== false)
}

/** Flow: 去空格与大小写 → 别名归一 → 精确匹配 → 前缀族匹配。 */
export function findModelProfile(
  provider: ProviderId,
  model: string,
): ProviderModelProfile | undefined {
  const key = normalizeModelKey(model)
  if (!key) {
    return undefined
  }

  const profile = PROVIDER_PROFILES[provider]
  const canonical = profile.aliases[key] ?? key
  const exact = profile.models.find((item) => normalizeModelKey(item.value) === canonical)
  if (exact) {
    return exact
  }

  return profile.models.find((item) => item.prefixMatch && canonical.startsWith(normalizeModelKey(item.value)))
}

function normalizeModelKey(model: string): string {
  return model.trim().toLowerCase()
}
