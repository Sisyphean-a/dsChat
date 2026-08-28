import type { ProviderId, ProviderSettings, ThinkingLevel } from '../types/chat'

export interface ThinkingOption {
  label: string
  value: ThinkingLevel
}

type ThinkingSettings = Pick<ProviderSettings, 'capabilities' | 'model'>

const DEEPSEEK_THINKING_MODELS = new Set([
  'deepseek-v4-flash',
  'deepseek-v4-flash-vision-exp',
  'deepseek-v4-pro',
  'deepseek-chat',
])
interface OpenAiReasoningProfile {
  maxEffort: 'max' | 'xhigh'
}

const OPENAI_REASONING_PROFILES = new Map<string, OpenAiReasoningProfile>([
  ['gpt-5.4', { maxEffort: 'xhigh' }],
  ['gpt-5.6', { maxEffort: 'max' }],
  ['gpt-5.6-sol', { maxEffort: 'max' }],
  ['gpt-5.6-terra', { maxEffort: 'max' }],
  ['gpt-5.6-luna', { maxEffort: 'max' }],
])

const OFF: ThinkingOption = { label: '关闭', value: 'off' }
const LOW: ThinkingOption = { label: '低', value: 'low' }
const MEDIUM: ThinkingOption = { label: '标准', value: 'medium' }
const HIGH: ThinkingOption = { label: '高', value: 'high' }
const MAX: ThinkingOption = { label: '极高', value: 'max' }
const ENABLED: ThinkingOption = { label: '启用', value: 'high' }
const ADAPTIVE: ThinkingOption = { label: '自适应', value: 'high' }

/**
 * Rule: 选项和请求参数必须从同一份供应商/模型档案生成，避免界面暴露无法实际发送的等级。
 */
export function getThinkingOptions(provider: ProviderId, settings: ThinkingSettings): ThinkingOption[] {
  if (!settings.capabilities.reasoning) {
    return []
  }

  if (provider === 'deepseek') {
    return settings.capabilities.protocol === 'chat_completions' && supportsDeepseekThinking(settings.model)
      ? [OFF, HIGH, MAX]
      : []
  }

  if (provider === 'openai') {
    return settings.capabilities.protocol === 'responses' && supportsOpenAiReasoning(settings.model)
      ? [OFF, LOW, MEDIUM, HIGH, MAX]
      : []
  }

  if (provider === 'kimi') {
    if (settings.capabilities.protocol !== 'chat_completions') {
      return []
    }
    if (isKimiK3(settings.model)) {
      return [LOW, HIGH, MAX]
    }
    if (isKimiK26(settings.model)) {
      return [OFF, ENABLED]
    }
    return []
  }

  if (provider === 'minimax') {
    return settings.capabilities.protocol === 'chat_completions' && isMiniMaxM3(settings.model)
      ? [OFF, ADAPTIVE]
      : []
  }

  return []
}

export function getDefaultThinkingLevel(provider: ProviderId, model: string): ThinkingLevel {
  if (provider === 'deepseek') {
    return 'high'
  }
  if (provider === 'openai') {
    return 'medium'
  }
  if (provider === 'kimi') {
    return isKimiK3(model) ? 'max' : 'high'
  }
  if (provider === 'minimax') {
    return 'high'
  }
  return 'off'
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

  if (provider === 'deepseek') {
    return level === 'off'
      ? { thinking: { type: 'disabled' } }
      : {
          reasoning_effort: level === 'max' ? 'max' : 'high',
          thinking: { type: 'enabled' },
        }
  }

  if (provider === 'kimi') {
    if (isKimiK3(settings.model)) {
      return { reasoning_effort: level }
    }
    return { thinking: { type: level === 'off' ? 'disabled' : 'enabled' } }
  }

  if (provider === 'minimax') {
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
  if (provider !== 'openai' || !getThinkingOptions(provider, settings).some((option) => option.value === level)) {
    return {}
  }

  const profile = getOpenAiReasoningProfile(settings.model)
  if (!profile) {
    return {}
  }

  return {
    reasoning: {
      effort: level === 'off' ? 'none' : level === 'max' ? profile.maxEffort : level,
    },
  }
}

export function supportsDeepseekThinking(model: string): boolean {
  return DEEPSEEK_THINKING_MODELS.has(model.trim())
}

function getModelThinkingLevels(provider: ProviderId, model: string): ThinkingLevel[] {
  if (provider === 'deepseek' && supportsDeepseekThinking(model)) {
    return ['off', 'high', 'max']
  }
  if (provider === 'openai' && supportsOpenAiReasoning(model)) {
    return ['off', 'low', 'medium', 'high', 'max']
  }
  if (provider === 'kimi' && isKimiK3(model)) {
    return ['low', 'high', 'max']
  }
  if (provider === 'kimi' && isKimiK26(model)) {
    return ['off', 'high']
  }
  if (provider === 'minimax' && isMiniMaxM3(model)) {
    return ['off', 'high']
  }
  return []
}

function supportsOpenAiReasoning(model: string): boolean {
  return Boolean(getOpenAiReasoningProfile(model))
}

function getOpenAiReasoningProfile(model: string): OpenAiReasoningProfile | undefined {
  return OPENAI_REASONING_PROFILES.get(model.trim().toLowerCase())
}

function isKimiK3(model: string): boolean {
  return model.trim().toLowerCase().startsWith('kimi-k3')
}

function isKimiK26(model: string): boolean {
  return model.trim().toLowerCase().startsWith('kimi-k2.6')
}

function isMiniMaxM3(model: string): boolean {
  return model.trim().toLowerCase() === 'minimax-m3'
}

function isThinkingLevel(value: unknown): value is ThinkingLevel {
  return value === 'off'
    || value === 'low'
    || value === 'medium'
    || value === 'high'
    || value === 'max'
}
