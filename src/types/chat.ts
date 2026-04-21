export type ChatRole = 'user' | 'assistant' | 'system'
export type MessageStatus = 'done' | 'streaming' | 'error' | 'interrupted'

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

export interface SettingsDoc extends BaseDoc {
  type: 'settings'
  apiKey: string
  baseUrl: string
  model: string
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
  apiKey: string
  baseUrl: string
  model: string
}
