import type { Ref } from 'vue'
import type { StreamDelta } from '../services/chatCompletion'
import type {
  ActiveProviderSettings,
  ChatMessage,
  SettingsForm,
} from '../types/chat'
import { buildConversationTitle } from '../utils/chat'
import { getErrorMessage } from './chatAppErrors'
import { getActiveProviderSettings, getSendSettingsError, normalizeSettings } from './chatAppSettings'

export interface SendPreparation {
  activeSettings: ActiveProviderSettings
  content: string
}

interface PrepareSendRequestOptions {
  draftMessage: Ref<string>
  isSending: Ref<boolean>
  settings: Ref<SettingsForm>
  openSettings: () => void
  lastError: Ref<string | null>
}

interface StreamAssistantReplyOptions {
  messages: Ref<ChatMessage[]>
  assistantIndex: number
  assistantId: string
  activeSettings: ActiveProviderSettings
  streamChatCompletion: (
    messages: ChatMessage[],
    settings: ActiveProviderSettings,
    onDelta: (delta: StreamDelta) => void,
    signal?: AbortSignal,
  ) => Promise<string>
  getAbortController: () => AbortController | null
}

interface HandleInterruptedReplyOptions {
  messages: Ref<ChatMessage[]>
  assistantIndex: number
  assistantId: string
  interruptedResponseMessage: string
  persistConversation: () => Promise<void>
}

interface HandleSendFailureOptions {
  error: unknown
  messages: Ref<ChatMessage[]>
  assistantIndex: number
  assistantId: string
  shouldPersistFailureState: boolean
  lastError: Ref<string | null>
  persistConversation: () => Promise<void>
}

interface GenerateConversationTitleOptions {
  applyGeneratedConversationTitle: (conversationId: string, title: string) => Promise<void>
  conversationId: string
  firstMessageContent: string
  settingsSnapshot: ActiveProviderSettings
  requestConversationTitle: (
    settings: ActiveProviderSettings,
    firstMessageContent: string,
  ) => Promise<string>
}

export function prepareSendRequest(
  options: PrepareSendRequestOptions,
): SendPreparation | null {
  const {
    draftMessage,
    isSending,
    settings,
    openSettings,
    lastError,
  } = options

  const content = draftMessage.value.trim()
  if (!content || isSending.value) {
    return null
  }

  const normalizedSettings = normalizeSettings(settings.value)
  const activeSettings = getActiveProviderSettings(normalizedSettings)
  const settingsError = getSendSettingsError(normalizedSettings)

  if (settingsError) {
    lastError.value = settingsError
    openSettings()
    return null
  }

  return {
    activeSettings,
    content,
  }
}

export async function streamAssistantReply(
  options: StreamAssistantReplyOptions,
): Promise<number> {
  const {
    messages,
    assistantId,
    activeSettings,
    streamChatCompletion,
    getAbortController,
  } = options
  let { assistantIndex } = options

  await streamChatCompletion(
    messages.value.slice(0, -1),
    activeSettings,
    (delta) => {
      assistantIndex = patchAssistantMessage(messages, assistantIndex, assistantId, (draft) => {
        appendStreamDelta(draft, delta)
      })
    },
    getAbortController()?.signal,
  )

  return assistantIndex
}

export function patchAssistantMessage(
  messages: Ref<ChatMessage[]>,
  preferredIndex: number,
  assistantId: string,
  mutate: (message: ChatMessage) => void,
): number {
  const resolvedIndex = resolveAssistantIndex(messages.value, preferredIndex, assistantId)
  if (resolvedIndex === -1) {
    return preferredIndex
  }

  const target = messages.value[resolvedIndex]
  if (!target) {
    return preferredIndex
  }

  const nextMessage = { ...target }
  mutate(nextMessage)

  const nextMessages = [...messages.value]
  nextMessages[resolvedIndex] = nextMessage
  messages.value = nextMessages
  return resolvedIndex
}

export async function handleInterruptedReply(
  options: HandleInterruptedReplyOptions,
): Promise<void> {
  const {
    messages,
    assistantId,
    interruptedResponseMessage,
    persistConversation,
  } = options
  let { assistantIndex } = options

  assistantIndex = patchAssistantMessage(messages, assistantIndex, assistantId, (draft) => {
    if (draft.status === 'interrupted') {
      return
    }

    draft.content = draft.content.trim() ? draft.content : interruptedResponseMessage
    draft.status = 'interrupted'
  })

  if (assistantIndex === -1) {
    return
  }

  await persistConversation()
}

export async function handleSendFailure(
  options: HandleSendFailureOptions,
): Promise<void> {
  const {
    error,
    messages,
    assistantIndex,
    assistantId,
    shouldPersistFailureState,
    lastError,
    persistConversation,
  } = options

  const message = getErrorMessage(error, '请求失败')
  patchAssistantMessage(messages, assistantIndex, assistantId, (draft) => {
    draft.content = draft.content || `请求失败：${message}`
    draft.status = 'error'
  })
  lastError.value = message

  if (!shouldPersistFailureState) {
    return
  }

  try {
    await persistConversation()
  } catch (persistError) {
    const persistMessage = getErrorMessage(persistError, '会话记录写入失败。')
    lastError.value = `请求失败后写入会话记录失败：${persistMessage}`
  }
}

export async function generateConversationTitle(
  options: GenerateConversationTitleOptions,
): Promise<void> {
  const {
    applyGeneratedConversationTitle,
    conversationId,
    firstMessageContent,
    settingsSnapshot,
    requestConversationTitle,
  } = options

  const title = await resolveTitleWithFallback(
    requestConversationTitle,
    settingsSnapshot,
    firstMessageContent,
  )
  await applyGeneratedConversationTitle(conversationId, title)
}

function appendStreamDelta(message: ChatMessage, delta: StreamDelta): void {
  if (delta.reasoningContent) {
    message.reasoningContent = `${message.reasoningContent ?? ''}${delta.reasoningContent}`
  }

  if (delta.content) {
    message.content += delta.content
  }
}

function resolveAssistantIndex(
  messages: ChatMessage[],
  preferredIndex: number,
  assistantId: string,
): number {
  if (messages[preferredIndex]?.id === assistantId) {
    return preferredIndex
  }

  return messages.findIndex((item) => item.id === assistantId)
}

async function resolveTitleWithFallback(
  requestConversationTitle: GenerateConversationTitleOptions['requestConversationTitle'],
  settingsSnapshot: ActiveProviderSettings,
  firstMessageContent: string,
): Promise<string> {
  try {
    const generated = await requestConversationTitle(settingsSnapshot, firstMessageContent)
    const normalized = generated.trim()
    if (normalized) {
      return normalized
    }
  } catch (error) {
    console.warn('Failed to generate conversation title, fallback to local title.', error)
  }

  return buildConversationTitle([
    {
      id: 'local-title',
      role: 'user',
      content: firstMessageContent,
      createdAt: Date.now(),
      status: 'done',
    },
  ])
}
