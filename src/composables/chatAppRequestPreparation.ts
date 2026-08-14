import type { Ref } from 'vue'
import type { ActiveProviderSettings, MessageAttachment, SettingsForm, ToolSettings } from '../types/chat'
import {
  createImageInputUnsupportedMessage,
  providerSupportsImageInput,
} from '../constants/providerCapabilities'
import { canUseBuiltinQwenImageTool } from './chatAppToolSettings'
import { getActiveProviderSettings, getSendSettingsError, normalizeSettings } from './chatAppSettings'

interface PrepareRequestContextOptions {
  attachments: MessageAttachment[]
  settings: Ref<SettingsForm>
  openSettings: () => void
  lastError: Ref<string | null>
}

export interface PreparedRequestContext {
  activeSettings: ActiveProviderSettings
  systemPrompt: string
  thinkingLevel: ActiveProviderSettings['reasoningLevel']
  toolSettings: ToolSettings
}

export function prepareRequestContext(
  options: PrepareRequestContextOptions,
): PreparedRequestContext | null {
  const {
    attachments,
    settings,
    openSettings,
    lastError,
  } = options

  const normalizedSettings = normalizeSettings(settings.value)
  const activeSettings = getActiveProviderSettings(normalizedSettings)
  const settingsError = getSendSettingsError(normalizedSettings)
  const imageInputError = getImageInputSupportError(
    activeSettings,
    attachments,
    normalizedSettings.toolSettings,
  )

  if (settingsError || imageInputError) {
    lastError.value = settingsError ?? imageInputError
    openSettings()
    return null
  }

  return {
    activeSettings,
    systemPrompt: normalizedSettings.systemPrompt,
    thinkingLevel: activeSettings.reasoningLevel,
    toolSettings: normalizedSettings.toolSettings,
  }
}

function getImageInputSupportError(
  settings: ActiveProviderSettings,
  attachments: MessageAttachment[],
  toolSettings: ToolSettings,
): string | null {
  if (!attachments.length) {
    return null
  }

  if (!providerSupportsImageInput(settings)
    && !canUseBuiltinQwenImageTool(settings, toolSettings)) {
    return `${createImageInputUnsupportedMessage(settings.provider, settings.label)} 如需让文本模型处理图片，请在“工具”设置中启用阿里云 Qwen 图片工具并填写 API Key。`
  }

  return null
}
