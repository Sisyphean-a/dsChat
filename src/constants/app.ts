import type { SettingsForm, ThemeMode } from '../types/chat'
import { buildDefaultSettings } from './providers'

export const CHAT_IDLE_RESET_MS = 60_000
export const SETTINGS_DOC_ID = 'settings/config'
export const SESSION_DOC_ID = 'session/runtime'
export const CONVERSATION_PREFIX = 'conversation/'
export const INTERRUPTED_RESPONSE_MESSAGE = '本次响应已中断，请重新发送。'
export const STOPPED_RESPONSE_MESSAGE = '已停止生成。'

export const THEME_OPTIONS: ThemeMode[] = ['light', 'dark']

export const DEFAULT_SETTINGS: SettingsForm = buildDefaultSettings()
