import { DEFAULT_TEMPERATURE, THEME_OPTIONS } from '../constants/app'
import type { SettingsForm } from '../types/chat'

export function normalizeSettings(currentSettings: SettingsForm): SettingsForm {
  return {
    apiKey: currentSettings.apiKey.trim(),
    baseUrl: currentSettings.baseUrl.trim(),
    model: currentSettings.model.trim(),
    temperature: normalizeTemperature(currentSettings.temperature),
    theme: normalizeTheme(currentSettings.theme),
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

export function modelSupportsTemperature(model: string): boolean {
  return model.trim() !== 'deepseek-reasoner'
}

function normalizeTemperature(temperature: number): number {
  if (!Number.isFinite(temperature)) {
    return DEFAULT_TEMPERATURE
  }

  return Math.min(2, Math.max(0, Number(temperature.toFixed(1))))
}

function normalizeTheme(theme: SettingsForm['theme']): SettingsForm['theme'] {
  return THEME_OPTIONS.includes(theme) ? theme : THEME_OPTIONS[0]
}
