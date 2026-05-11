import {
  providerShowsThinkingToggle,
  resolveThinkingProviderKey,
  type ThinkingProviderKey,
} from '../constants/providerCapabilities'
import type { ProviderId, SettingsForm } from '../types/chat'

export function shouldShowThinkingToggle(provider: ProviderId, model: string): boolean {
  return providerShowsThinkingToggle(provider, model)
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
): ThinkingProviderKey | null {
  return resolveThinkingProviderKey(provider)
}
