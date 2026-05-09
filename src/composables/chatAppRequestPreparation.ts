import type { Ref } from 'vue'
import type { ActiveProviderSettings, MessageAttachment, SettingsForm, ToolSettings } from '../types/chat'
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

  if (settings.provider === 'deepseek') {
    return 'DeepSeek 当前模型仅支持文本输入，不支持图片。请切换支持图片的供应商后再发送。'
  }

  if (settings.provider === 'minimax') {
    return 'MiniMax 当前文本模型不支持图片输入。请切换支持图片的供应商后再发送。'
  }

  return null
}
