import { getThinkingOptions } from './thinking'
import { findModelProfile, getProviderProfile, type ImageInputPolicy } from './providerProfiles'
import type {
  ActiveProviderSettings,
  ProviderCapabilities,
  ProviderId,
  ProviderSettings,
  ThinkingLevel,
} from '../types/chat'

const PROVIDER_IMAGE_INPUT_ERRORS: Partial<Record<ProviderId, string>> = {
  deepseek: 'DeepSeek 当前模型不支持图片输入，请切换到 deepseek-flash 或其他支持图片的模型后再发送。',
  minimax: 'MiniMax 当前模型不支持图片输入，请切换到 MiniMax-M3 或其他支持图片的模型后再发送。',
}

export function getSupportedProviderProtocols(provider: ProviderId): ProviderCapabilities['protocol'][] {
  return [...getProviderProfile(provider).protocols]
}

export function getDefaultProviderCapabilities(provider: ProviderId, model = ''): ProviderCapabilities {
  const profile = getProviderProfile(provider)
  return {
    imageInput: resolveModelImageInput(provider, model, profile.capabilities.imageInput),
    nativeWebSearch: profile.capabilities.nativeWebSearch,
    protocol: profile.capabilities.protocol,
    reasoning: profile.capabilities.reasoning,
    toolCalling: profile.capabilities.toolCalling,
  }
}

export function normalizeProviderCapabilities(
  provider: ProviderId,
  capabilities: Partial<ProviderCapabilities> | undefined,
  model = '',
): ProviderCapabilities {
  const profile = getProviderProfile(provider)
  const defaults = getDefaultProviderCapabilities(provider, model)
  const normalized = {
    ...defaults,
    ...(capabilities ?? {}),
  }
  if (!profile.protocols.includes(normalized.protocol)) {
    normalized.protocol = defaults.protocol
  }
  normalized.imageInput = resolveImageInput(
    profile.imageInputPolicy,
    normalized.imageInput,
    defaults.imageInput,
  )
  return normalized
}

export function resolveProviderProtocol(settings: ProviderSettings): ProviderCapabilities['protocol'] {
  return settings.capabilities.protocol
}

/**
 * Rule: 协议决定哪些能力可用——Responses 不支持本地工具调用，Chat Completions 不支持原生联网；
 * 切换协议时同步关闭不再生效的能力。
 */
export function applyCapabilityEdit(
  capabilities: ProviderCapabilities,
  field: keyof ProviderCapabilities,
  value: ProviderCapabilities[keyof ProviderCapabilities],
): ProviderCapabilities {
  const next = { ...capabilities, [field]: value } as ProviderCapabilities
  if (field !== 'protocol') {
    return next
  }

  if (next.protocol === 'responses') {
    next.toolCalling = false
  }
  if (next.protocol === 'chat_completions') {
    next.nativeWebSearch = false
  }
  return next
}

export function providerSupportsImageInput(settings: ActiveProviderSettings): boolean {
  if (!settings.capabilities.imageInput) {
    return false
  }

  return settings.provider !== 'kimi'
    || (findModelProfile(settings.provider, settings.model)?.supportsImageInput ?? true)
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
  if (!modelSupportsTemperature(provider, settings.model)) {
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
  return findModelProfile('openai', model)?.supportsNativeWebSearch === true
}

function resolveImageInput(
  policy: ImageInputPolicy,
  configured: boolean,
  modelDefault: boolean,
): boolean {
  if (policy === 'follow-model') {
    return modelDefault
  }

  if (policy === 'veto-model') {
    return configured && modelDefault
  }

  return configured
}

function resolveModelImageInput(provider: ProviderId, model: string, fallback: boolean): boolean {
  return findModelProfile(provider, model)?.supportsImageInput ?? fallback
}

function modelSupportsTemperature(provider: ProviderId, model: string): boolean {
  return findModelProfile(provider, model)?.supportsTemperature ?? true
}
