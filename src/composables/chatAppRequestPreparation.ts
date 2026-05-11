import type { Ref } from 'vue'
import type { ActiveProviderSettings, MessageAttachment, SettingsForm, ToolSettings } from '../types/chat'
import {
  createImageInputUnsupportedMessage,
  providerSupportsImageInput,
} from '../constants/providerCapabilities'
import { getActiveProviderSettings, getSendSettingsError, normalizeSettings } from './chatAppSettings'

interface PrepareRequestContextOptions {
  attachments: MessageAttachment[]
  settings: Ref<SettingsForm>
  getThinkingEnabled: (provider: ActiveProviderSettings['provider']) => boolean
  openSettings: () => void
  lastError: Ref<string | null>
}

export interface PreparedRequestContext {
  activeSettings: ActiveProviderSettings
  thinkingEnabled: boolean
  toolSettings: ToolSettings
}

export function prepareRequestContext(
  options: PrepareRequestContextOptions,
): PreparedRequestContext | null {
  const {
    attachments,
    settings,
    getThinkingEnabled,
    openSettings,
    lastError,
  } = options

  const normalizedSettings = normalizeSettings(settings.value)
  const activeSettings = getActiveProviderSettings(normalizedSettings)
  const thinkingEnabled = getThinkingEnabled(activeSettings.provider)
  const settingsError = getSendSettingsError(normalizedSettings)
  const imageInputError = getImageInputSupportError(activeSettings, attachments)

  if (settingsError || imageInputError) {
    lastError.value = settingsError ?? imageInputError
    openSettings()
    return null
  }

  return {
    activeSettings,
    thinkingEnabled,
    toolSettings: normalizedSettings.toolSettings,
  }
}

function getImageInputSupportError(
  settings: ActiveProviderSettings,
  attachments: MessageAttachment[],
): string | null {
  if (!attachments.length) {
    return null
  }

  if (!providerSupportsImageInput(settings.provider)) {
    return createImageInputUnsupportedMessage(settings.provider, settings.label)
  }

  return null
}
