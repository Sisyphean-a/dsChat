import type { ChatMessage, SettingsForm } from '../types/chat'

export const CHAT_IDLE_RESET_MS = 60_000
export const SETTINGS_DOC_ID = 'settings/config'
export const SESSION_DOC_ID = 'session/runtime'
export const CONVERSATION_PREFIX = 'conversation/'

export const MODEL_OPTIONS = ['deepseek-chat', 'deepseek-reasoner']

export const DEFAULT_SETTINGS: SettingsForm = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: MODEL_OPTIONS[0],
}

export const PLACEHOLDER_MESSAGES: ChatMessage[] = [
  {
    id: 'placeholder-user',
    role: 'user',
    content: '可以帮我整理今天的待办，并给出优先级吗？',
    createdAt: 0,
    status: 'done',
  },
  {
    id: 'placeholder-assistant',
    role: 'assistant',
    content:
      '当然可以。建议先列出必须今天完成的事项，再区分可委托与可延后任务。你把清单发我，我会按紧急度帮你重排。',
    createdAt: 0,
    status: 'done',
  },
]
