import {
  providerModelSupportsImageInput,
  providerModelSupportsTemperature,
} from './providers'
import { getThinkingOptions } from './thinking'
import type { ActiveProviderSettings, ProviderCapabilities, ProviderId, ProviderSettings, ThinkingLevel } from '../types/chat'

interface ProviderCapabilityProfile {
  protocol: ProviderCapabilities['protocol']
  supportsImageInput: boolean
  supportsToolOrchestrator: boolean
  supportsNativeWebSearch: boolean
  supportsReasoningControl: boolean
}
const OPENAI_NATIVE_WEB_SEARCH_MODELS = [
  'gpt-5.6',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
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

const PROVIDER_PROTOCOLS: Record<ProviderId, ProviderCapabilities['protocol'][]> = {
  custom: ['chat_completions', 'responses'],
  deepseek: ['chat_completions'],
  kimi: ['chat_completions'],
  minimax: ['chat_completions'],
  openai: ['chat_completions', 'responses'],
}

const PROVIDER_CAPABILITIES: Record<ProviderId, ProviderCapabilityProfile> = {
  custom: {
    protocol: 'chat_completions',
    supportsImageInput: true,
    supportsToolOrchestrator: true,
    supportsNativeWebSearch: false,
    supportsReasoningControl: false,
  },
  deepseek: {
    protocol: 'chat_completions',
    supportsImageInput: false,
    supportsToolOrchestrator: true,
    supportsNativeWebSearch: false,
    supportsReasoningControl: true,
  },
  kimi: {
    protocol: 'chat_completions',
    supportsImageInput: true,
    supportsToolOrchestrator: true,
    supportsNativeWebSearch: false,
    supportsReasoningControl: true,
  },
  minimax: {
    protocol: 'chat_completions',
    supportsImageInput: false,
    supportsToolOrchestrator: true,
    supportsNativeWebSearch: false,
    supportsReasoningControl: true,
  },
  openai: {
    protocol: 'responses',
    supportsImageInput: true,
    supportsToolOrchestrator: false,
    supportsNativeWebSearch: true,
    supportsReasoningControl: true,
  },
}

export function getSupportedProviderProtocols(provider: ProviderId): ProviderCapabilities['protocol'][] {
  return [...PROVIDER_PROTOCOLS[provider]]
}

export function getDefaultProviderCapabilities(provider: ProviderId): ProviderCapabilities {
  const profile = PROVIDER_CAPABILITIES[provider]
  return {
    imageInput: profile.supportsImageInput,
    nativeWebSearch: profile.supportsNativeWebSearch,
    protocol: profile.protocol,
    reasoning: profile.supportsReasoningControl,
    toolCalling: profile.supportsToolOrchestrator,
  }
}

export function normalizeProviderCapabilities(
  provider: ProviderId,
  capabilities: Partial<ProviderCapabilities> | undefined,
  model = '',
): ProviderCapabilities {
  const normalized = {
    ...getDefaultProviderCapabilities(provider),
    ...(capabilities ?? {}),
  }
  if (!PROVIDER_PROTOCOLS[provider].includes(normalized.protocol)) {
    normalized.protocol = PROVIDER_CAPABILITIES[provider].protocol
  }
  if (provider === 'deepseek' || provider === 'minimax') {
    normalized.imageInput = false
  }
  if (provider === 'kimi' && !providerModelSupportsImageInput(provider, model)) {
    normalized.imageInput = false
  }
  return normalized
}

export function resolveProviderProtocol(settings: ProviderSettings): ProviderCapabilities['protocol'] {
  return settings.capabilities.protocol
}

export function providerSupportsImageInput(settings: ActiveProviderSettings): boolean {
  if (!settings.capabilities.imageInput) {
    return false
  }

  return settings.provider !== 'kimi'
    || providerModelSupportsImageInput(settings.provider, settings.model)
}

export function createImageInputUnsupportedMessage(provider: ProviderId, label: string): string {
  const preset = PROVIDER_IMAGE_INPUT_ERRORS[provider]
  if (preset) {
    return preset
  }

  return `${label} 当前模型不支持图片输入。请切换支持图片的供应商后再发送。`
}

export function shouldIncludeProviderRequestTemperature(
  provider: ProviderId,
  settings: ProviderSettings,
  thinkingLevel: ThinkingLevel,
): boolean {
  if (!providerModelSupportsTemperature(provider, settings.model)) {
    return false
  }

  if (provider !== 'deepseek') {
    return true
  }

  return !getThinkingOptions(provider, settings).some((option) => option.value === thinkingLevel)
    || thinkingLevel === 'off'
}

export function resolveProviderRequestTemperature(
  provider: ProviderId,
  configuredTemperature: number,
  thinkingLevel: ThinkingLevel,
): number {
  if (provider !== 'kimi') {
    return configuredTemperature
  }

  return thinkingLevel === 'off' ? 0.6 : 1.0
}

export function providerSupportsToolOrchestrator(provider: ProviderId): boolean {
  return PROVIDER_CAPABILITIES[provider].supportsToolOrchestrator
}

export function providerSupportsToolCalling(settings: ProviderSettings): boolean {
  return settings.capabilities.protocol === 'chat_completions'
    && settings.capabilities.toolCalling
}

export function providerSupportsNativeWebSearch(settings: ActiveProviderSettings): boolean {
  return settings.provider === 'openai'
    && settings.capabilities.protocol === 'responses'
    && settings.capabilities.nativeWebSearch
    && supportsOpenAiNativeWebSearchModel(settings.model)
}

export function supportsOpenAiNativeWebSearchModel(model: string): boolean {
  return OPENAI_NATIVE_WEB_SEARCH_MODELS.includes(
    model.trim() as (typeof OPENAI_NATIVE_WEB_SEARCH_MODELS)[number],
  )
}
