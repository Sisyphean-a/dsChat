import type { SettingsForm } from '../types/chat'

export function normalizeSettings(currentSettings: SettingsForm): SettingsForm {
  return {
    apiKey: currentSettings.apiKey.trim(),
    baseUrl: currentSettings.baseUrl.trim(),
    model: currentSettings.model.trim(),
  }
}

export function getSendSettingsError(currentSettings: SettingsForm): string | null {
  if (!currentSettings.apiKey.trim()) {
    return '请先在设置面板中填写 DeepSeek API Key。'
  }

  if (!currentSettings.baseUrl.trim()) {
    return '请先在设置面板中填写 DeepSeek Base URL。'
  }

  if (!currentSettings.model.trim()) {
    return '请先在设置面板中选择 DeepSeek 模型。'
  }

  return null
}
