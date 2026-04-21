import type { SettingsForm } from '../types/chat'

export const CHAT_IDLE_RESET_MS = 60_000
export const SETTINGS_DOC_ID = 'settings/config'
export const SESSION_DOC_ID = 'session/runtime'
export const CONVERSATION_PREFIX = 'conversation/'
export const INTERRUPTED_RESPONSE_MESSAGE = '本次响应已中断，请重新发送。'

export const MODEL_OPTIONS = ['deepseek-chat', 'deepseek-reasoner']

export const DEFAULT_SETTINGS: SettingsForm = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: MODEL_OPTIONS[0],
}
