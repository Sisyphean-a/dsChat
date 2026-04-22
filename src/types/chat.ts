export type ChatRole = 'user' | 'assistant' | 'system'
export type MessageStatus = 'done' | 'streaming' | 'error' | 'interrupted'
export type ThemeMode = 'light' | 'dark'
export type ProviderId = 'deepseek' | 'openai' | 'minimax' | 'kimi' | 'custom'
export type AddableProviderId = Exclude<ProviderId, 'deepseek'>
export type UtoolsUploadMode = 'local-only' | 'settings-only' | 'all-data'

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
  modelOptions: string[]
  temperature: number
}

export interface AddedModelConfig extends ProviderSettings {
  id: string
  name: string
  provider: AddableProviderId
}

export interface SettingsDoc extends BaseDoc {
  type: 'settings'
  activeConfigId: string
  deepseek: ProviderSettings
  customModels: AddedModelConfig[]
  theme: ThemeMode
  utoolsUploadMode: UtoolsUploadMode
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
  activeConfigId: string
  deepseek: ProviderSettings
  customModels: AddedModelConfig[]
  theme: ThemeMode
  utoolsUploadMode: UtoolsUploadMode
}

export interface ActiveProviderSettings extends ProviderSettings {
  configId: string
  label: string
  provider: ProviderId
}

export interface ModelConfigOption {
  badge: string
  detail: string
  label: string
  shortLabel: string
  value: string
}
