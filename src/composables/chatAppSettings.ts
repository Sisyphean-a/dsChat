import { THEME_OPTIONS } from '../constants/app'
import {
  buildDefaultProviderSettings,
  buildDefaultProviderSettingsMap,
  DEFAULT_PROVIDER_ID,
  findProviderModel,
  getProviderDefinition,
  getProviderTemperatureRange,
  isProviderId,
  PROVIDER_IDS,
} from '../constants/providers'
import type {
  ActiveProviderSettings,
  ProviderId,
  ProviderSettings,
  ProviderSettingsMap,
  SettingsForm,
} from '../types/chat'

export function normalizeSettings(currentSettings: SettingsForm): SettingsForm {
  const activeProvider = normalizeProvider(currentSettings.activeProvider)

  return {
    activeProvider,
    providers: normalizeProviderSettingsMap(currentSettings.providers),
    theme: normalizeTheme(currentSettings.theme),
  }
}

export function getSendSettingsError(currentSettings: SettingsForm): string | null {
  const activeSettings = getActiveProviderSettings(currentSettings)
  const providerLabel = getProviderDefinition(activeSettings.provider).label

  if (!activeSettings.apiKey.trim()) {
    return `请先在设置面板中填写 ${providerLabel} API Key。`
  }

  if (!activeSettings.baseUrl.trim()) {
    return `请先在设置面板中填写 ${providerLabel} Base URL。`
  }

  if (!activeSettings.model.trim()) {
    return `请先在设置面板中选择 ${providerLabel} 模型。`
  }

  return null
}

export function getActiveProviderSettings(settings: SettingsForm): ActiveProviderSettings {
  const provider = normalizeProvider(settings.activeProvider)
  return {
    provider,
    ...normalizeProviderSettings(provider, settings.providers?.[provider]),
  }
}

export function modelSupportsTemperature(provider: ProviderId, model: string): boolean {
  const matched = findProviderModel(provider, model)
  return matched?.supportsTemperature ?? true
}

function normalizeProviderSettingsMap(
  incomingSettings: SettingsForm['providers'] | undefined,
): ProviderSettingsMap {
  const defaults = buildDefaultProviderSettingsMap()

  return PROVIDER_IDS.reduce<ProviderSettingsMap>((accumulator, provider) => {
    accumulator[provider] = normalizeProviderSettings(provider, incomingSettings?.[provider] ?? defaults[provider])
    return accumulator
  }, {} as ProviderSettingsMap)
}

function normalizeProviderSettings(
  provider: ProviderId,
  incomingSettings?: Partial<ProviderSettings>,
): ProviderSettings {
  const defaults = buildDefaultProviderSettings(provider)
  const model = incomingSettings?.model === undefined
    ? defaults.model
    : incomingSettings.model.trim()

  return {
    apiKey: incomingSettings?.apiKey?.trim() ?? defaults.apiKey,
    baseUrl: incomingSettings?.baseUrl === undefined
      ? defaults.baseUrl
      : incomingSettings.baseUrl.trim(),
    model,
    temperature: normalizeTemperature(provider, model, incomingSettings?.temperature),
  }
}

function normalizeTemperature(
  provider: ProviderId,
  model: string,
  temperature: number | undefined,
): number {
  const range = getProviderTemperatureRange(provider)

  if (typeof temperature !== 'number' || !Number.isFinite(temperature)) {
    return range.defaultValue
  }

  if (!modelSupportsTemperature(provider, model)) {
    return range.defaultValue
  }

  const roundedTemperature = Number(temperature.toFixed(1))
  return Math.min(range.max, Math.max(range.min, roundedTemperature))
}

function normalizeProvider(provider: string): ProviderId {
  return isProviderId(provider) ? provider : DEFAULT_PROVIDER_ID
}

function normalizeTheme(theme: SettingsForm['theme']): SettingsForm['theme'] {
  return THEME_OPTIONS.includes(theme) ? theme : THEME_OPTIONS[0]
}
