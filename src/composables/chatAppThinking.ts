import { supportsDeepseekThinking } from '../constants/providers'
import type { ProviderId, SettingsForm } from '../types/chat'

export function shouldShowThinkingToggle(provider: ProviderId, model: string): boolean {
  if (provider === 'deepseek') {
    return supportsDeepseekThinking(model)
  }

  return provider === 'kimi' || provider === 'minimax'
}

export function resolveThinkingEnabled(
  settings: SettingsForm,
  provider: ProviderId,
): boolean {
  const target = resolveThinkingProvider(provider)
  return target ? settings.providerThinking[target] : true
}

export function resolveThinkingProvider(
  provider: ProviderId,
): 'deepseek' | 'kimi' | 'minimax' | null {
  if (provider === 'deepseek' || provider === 'kimi' || provider === 'minimax') {
    return provider
  }

  return null
}
