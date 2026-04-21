export type ChatRole = 'user' | 'assistant' | 'system'
export type MessageStatus = 'done' | 'streaming' | 'error' | 'interrupted'
export type ThemeMode = 'light' | 'dark'
export type ProviderId = 'deepseek' | 'openai' | 'claude' | 'minimax'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  reasoningContent?: string
  createdAt: number
  status: MessageStatus
}

export interface BaseDoc {
  _id: string
  _rev?: string
}

export interface ProviderSettings {
  apiKey: string
  baseUrl: string
  model: string
  temperature: number
}

export type ProviderSettingsMap = Record<ProviderId, ProviderSettings>

export interface SettingsDoc extends BaseDoc {
  type: 'settings'
  activeProvider: ProviderId
  providers: ProviderSettingsMap
  theme: ThemeMode
}

export interface SessionDoc extends BaseDoc {
  type: 'session'
  currentConversationId: string | null
  lastOutAt: number | null
}

export interface ConversationDoc extends BaseDoc {
  type: 'conversation'
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

export interface SettingsForm {
  activeProvider: ProviderId
  providers: ProviderSettingsMap
  theme: ThemeMode
}

export interface ActiveProviderSettings extends ProviderSettings {
  provider: ProviderId
}
