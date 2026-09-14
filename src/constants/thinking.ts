import type { ProviderId, ProviderSettings, ThinkingLevel } from '../types/chat'
import { findModelProfile, getProviderProfile, type ThinkingRequestStyle } from './providerProfiles'

export interface ThinkingOption {
  label: string
  value: ThinkingLevel
}

type ThinkingSettings = Pick<ProviderSettings, 'capabilities' | 'model'>

const OFF: ThinkingOption = { label: '关闭', value: 'off' }
const LOW: ThinkingOption = { label: '低', value: 'low' }
const MEDIUM: ThinkingOption = { label: '标准', value: 'medium' }
const HIGH: ThinkingOption = { label: '高', value: 'high' }
const MAX: ThinkingOption = { label: '极高', value: 'max' }

const LEVEL_OPTIONS: Record<ThinkingLevel, ThinkingOption> = {
  high: HIGH,
  low: LOW,
  max: MAX,
  medium: MEDIUM,
  off: OFF,
}

/** Rule: 同一等级在不同供应商的界面说法不同，例如 Kimi 的启用与 MiniMax 的自适应。 */
const LEVEL_LABEL_OVERRIDES: Partial<Record<ThinkingRequestStyle, Partial<Record<ThinkingLevel, ThinkingOption>>>> = {
  'thinking-toggle': { high: { label: '启用', value: 'high' } },
  'minimax-adaptive': { high: { label: '自适应', value: 'high' } },
}

/**
 * Rule: 选项和请求参数必须从同一份供应商/模型档案生成，避免界面暴露无法实际发送的等级。
 */
export function getThinkingOptions(provider: ProviderId, settings: ThinkingSettings): ThinkingOption[] {
  if (!settings.capabilities.reasoning) {
    return []
  }

  const providerProfile = getProviderProfile(provider)
  if (providerProfile.thinkingProtocol && settings.capabilities.protocol !== providerProfile.thinkingProtocol) {
    return []
  }

  const thinking = findModelProfile(provider, settings.model)?.thinking
  if (!thinking) {
    return []
  }

  const overrides = LEVEL_LABEL_OVERRIDES[thinking.request]
  return thinking.levels.map((level) => overrides?.[level] ?? LEVEL_OPTIONS[level])
}

export function getDefaultThinkingLevel(provider: ProviderId, model: string): ThinkingLevel {
  return findModelProfile(provider, model)?.thinking?.defaultLevel
    ?? getProviderProfile(provider).defaultThinkingLevel
}

export function normalizeThinkingLevel(
  provider: ProviderId,
  model: string,
  value: unknown,
): ThinkingLevel {
  const fallback = getDefaultThinkingLevel(provider, model)
  if (!isThinkingLevel(value)) {
    return fallback
  }

  const supported = getModelThinkingLevels(provider, model)
  if (!supported.length || supported.includes(value)) {
    return value
  }

  return supported.includes(fallback) ? fallback : supported[0] as ThinkingLevel
}

export function createThinkingPayloadForChatCompletions(
  provider: ProviderId,
  settings: ThinkingSettings,
  level: ThinkingLevel,
): Record<string, unknown> {
  if (!getThinkingOptions(provider, settings).some((option) => option.value === level)) {
    return {}
  }

  const request = findModelProfile(provider, settings.model)?.thinking?.request
  if (request === 'deepseek-effort') {
    return level === 'off'
      ? { thinking: { type: 'disabled' } }
      : {
          reasoning_effort: level === 'max' ? 'max' : 'high',
          thinking: { type: 'enabled' },
        }
  }

  if (request === 'reasoning-effort') {
    return { reasoning_effort: level }
  }

  if (request === 'thinking-toggle') {
    return { thinking: { type: level === 'off' ? 'disabled' : 'enabled' } }
  }

  if (request === 'minimax-adaptive') {
    return level === 'off'
      ? { thinking: { type: 'disabled' } }
      : {
          reasoning_split: true,
          thinking: { type: 'adaptive' },
        }
  }

  return {}
}

export function createThinkingPayloadForResponses(
  provider: ProviderId,
  settings: ThinkingSettings,
  level: ThinkingLevel,
): Record<string, unknown> {
  if (!getThinkingOptions(provider, settings).some((option) => option.value === level)) {
    return {}
  }

  const thinking = findModelProfile(provider, settings.model)?.thinking
  if (thinking?.request !== 'openai-effort') {
    return {}
  }

  return {
    reasoning: {
      effort: level === 'off' ? 'none' : level === 'max' ? (thinking.maxEffort ?? 'max') : level,
    },
  }
}

function getModelThinkingLevels(provider: ProviderId, model: string): ThinkingLevel[] {
  return findModelProfile(provider, model)?.thinking?.levels ?? []
}

function isThinkingLevel(value: unknown): value is ThinkingLevel {
  return value === 'off'
    || value === 'low'
    || value === 'medium'
    || value === 'high'
    || value === 'max'
}
