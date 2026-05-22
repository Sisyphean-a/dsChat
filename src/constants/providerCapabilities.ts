import { providerModelSupportsTemperature, supportsDeepseekThinking } from './providers'
import type { ProviderCapabilities, ProviderId, ProviderSettings } from '../types/chat'

export type ThinkingProviderKey = 'deepseek' | 'kimi' | 'minimax'

interface ProviderCapabilityProfile {
  protocol: ProviderCapabilities['protocol']
  supportsImageInput: boolean
  supportsToolOrchestrator: boolean
  supportsNativeWebSearch: boolean
  thinking: {
    providerKey: ThinkingProviderKey | null
    showToggle: (model: string) => boolean
    supportsRequestControl: (model: string) => boolean
  }
}

const ALWAYS_TRUE = () => true
const ALWAYS_FALSE = () => false
const OPENAI_NATIVE_WEB_SEARCH_MODELS = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.4-nano',
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
] as const
const PROVIDER_IMAGE_INPUT_ERRORS: Partial<Record<ProviderId, string>> = {
  deepseek: 'DeepSeek 当前模型仅支持文本输入，不支持图片。请切换支持图片的供应商后再发送。',
  minimax: 'MiniMax 当前文本模型不支持图片输入。请切换支持图片的供应商后再发送。',
}

const PROVIDER_CAPABILITIES: Record<ProviderId, ProviderCapabilityProfile> = {
  custom: {
    protocol: 'chat_completions',
    supportsImageInput: true,
    supportsToolOrchestrator: true,
    supportsNativeWebSearch: false,
    thinking: {
      providerKey: null,
      showToggle: ALWAYS_FALSE,
      supportsRequestControl: ALWAYS_FALSE,
    },
  },
  deepseek: {
    protocol: 'chat_completions',
    supportsImageInput: false,
    supportsToolOrchestrator: true,
    supportsNativeWebSearch: false,
    thinking: {
      providerKey: 'deepseek',
      showToggle: supportsDeepseekThinking,
      supportsRequestControl: supportsDeepseekThinking,
    },
  },
  kimi: {
    protocol: 'chat_completions',
    supportsImageInput: true,
    supportsToolOrchestrator: true,
    supportsNativeWebSearch: false,
    thinking: {
      providerKey: 'kimi',
      showToggle: ALWAYS_TRUE,
      supportsRequestControl: ALWAYS_TRUE,
    },
  },
  minimax: {
    protocol: 'chat_completions',
    supportsImageInput: false,
    supportsToolOrchestrator: true,
    supportsNativeWebSearch: false,
    thinking: {
      providerKey: 'minimax',
      showToggle: ALWAYS_TRUE,
      supportsRequestControl: ALWAYS_TRUE,
    },
  },
  openai: {
    protocol: 'responses',
    supportsImageInput: true,
    supportsToolOrchestrator: false,
    supportsNativeWebSearch: true,
    thinking: {
      providerKey: null,
      showToggle: ALWAYS_FALSE,
      supportsRequestControl: ALWAYS_FALSE,
    },
  },
}

export function getDefaultProviderCapabilities(provider: ProviderId): ProviderCapabilities {
  const profile = PROVIDER_CAPABILITIES[provider]
  return {
    imageInput: profile.supportsImageInput,
    nativeWebSearch: profile.supportsNativeWebSearch,
    protocol: profile.protocol,
    reasoning: profile.thinking.providerKey !== null,
    toolCalling: profile.supportsToolOrchestrator,
  }
}

export function normalizeProviderCapabilities(
  provider: ProviderId,
  capabilities: Partial<ProviderCapabilities> | undefined,
): ProviderCapabilities {
  return {
    ...getDefaultProviderCapabilities(provider),
    ...(capabilities ?? {}),
  }
}

export function resolveProviderProtocol(settings: ProviderSettings): ProviderCapabilities['protocol'] {
  return settings.capabilities.protocol
}

export function providerSupportsImageInput(settings: ProviderSettings): boolean {
  return settings.capabilities.imageInput
}

export function createImageInputUnsupportedMessage(provider: ProviderId, label: string): string {
  const preset = PROVIDER_IMAGE_INPUT_ERRORS[provider]
  if (preset) {
    return preset
  }

  return `${label} 当前模型不支持图片输入。请切换支持图片的供应商后再发送。`
}

export function resolveThinkingProviderKey(provider: ProviderId): ThinkingProviderKey | null {
  return PROVIDER_CAPABILITIES[provider].thinking.providerKey
}

export function providerShowsThinkingToggle(
  provider: ProviderId,
  settings: ProviderSettings,
): boolean {
  return settings.capabilities.reasoning && PROVIDER_CAPABILITIES[provider].thinking.showToggle(settings.model)
}

export function createThinkingPayloadForChatCompletions(
  provider: ProviderId,
  settings: ProviderSettings,
  thinkingEnabled: boolean | undefined,
): Record<string, unknown> {
  if (!settings.capabilities.reasoning) {
    return {}
  }

  if (!PROVIDER_CAPABILITIES[provider].thinking.supportsRequestControl(settings.model)) {
    return {}
  }

  const enabled = thinkingEnabled ?? true
  if (provider === 'minimax') {
    return {
      reasoning_split: enabled,
    }
  }

  return {
    thinking: {
      type: enabled ? 'enabled' : 'disabled',
    },
  }
}

export function shouldIncludeProviderRequestTemperature(
  provider: ProviderId,
  settings: ProviderSettings,
  thinkingEnabled: boolean | undefined,
): boolean {
  if (!providerModelSupportsTemperature(provider, settings.model)) {
    return false
  }

  if (provider !== 'deepseek') {
    return true
  }

  if (!settings.capabilities.reasoning || !supportsDeepseekThinking(settings.model)) {
    return true
  }

  return (thinkingEnabled ?? true) === false
}

export function resolveProviderRequestTemperature(
  provider: ProviderId,
  configuredTemperature: number,
  thinkingEnabled: boolean | undefined,
): number {
  if (provider !== 'kimi') {
    return configuredTemperature
  }

  return (thinkingEnabled ?? true) ? 1.0 : 0.6
}

export function providerSupportsToolOrchestrator(provider: ProviderId): boolean {
  return PROVIDER_CAPABILITIES[provider].supportsToolOrchestrator
}

export function providerSupportsToolCalling(settings: ProviderSettings): boolean {
  return settings.capabilities.protocol === 'chat_completions'
    && settings.capabilities.toolCalling
}

export function providerSupportsNativeWebSearch(settings: ProviderSettings): boolean {
  return settings.capabilities.nativeWebSearch
}

export function supportsOpenAiNativeWebSearchModel(model: string): boolean {
  return OPENAI_NATIVE_WEB_SEARCH_MODELS.includes(
    model.trim() as (typeof OPENAI_NATIVE_WEB_SEARCH_MODELS)[number],
  )
}
