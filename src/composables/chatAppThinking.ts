import {
  providerShowsThinkingToggle,
  resolveThinkingProviderKey,
  type ThinkingProviderKey,
} from '../constants/providerCapabilities'
import type { ActiveProviderSettings, ProviderId, SettingsForm } from '../types/chat'

export function shouldShowThinkingToggle(settings: ActiveProviderSettings): boolean {
  return providerShowsThinkingToggle(settings.provider, settings)
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
