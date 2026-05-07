import type { Ref } from 'vue'
import type { ChatRequestOptions, StreamDelta } from '../services/chatCompletion'
import type {
  ActiveProviderSettings,
  ChatMessage,
  MessageAttachment,
  SettingsForm,
} from '../types/chat'
import { createConversationId } from '../utils/chat'
import { createChatMessage, finalizeStreamingMessages } from './chatAppMessages'
import { getErrorMessage, isAbortError } from './chatAppErrors'
import {
  generateConversationTitle,
  handleInterruptedReply,
  handleSendFailure,
  patchAssistantMessage,
  prepareSendRequest,
  streamAssistantReply,
} from './chatAppSendHelpers'

type SendFailureStage = 'initial-persist' | 'stream' | 'final-persist'

interface ChatAppSendActionsOptions {
  settings: Ref<SettingsForm>
  activeConversationId: Ref<string | null>
  messages: Ref<ChatMessage[]>
  pendingAttachments: Ref<MessageAttachment[]>
  draftMessage: Ref<string>
  isSending: Ref<boolean>
  lastError: Ref<string | null>
  interruptedResponseMessage: string
  stoppedResponseMessage: string
  streamChatCompletion: (
    messages: ChatMessage[],
    settings: ActiveProviderSettings,
    onDelta: (delta: StreamDelta) => void,
    signal?: AbortSignal,
    requestOptions?: ChatRequestOptions,
  ) => Promise<string>
  requestConversationTitle: (
    settings: ActiveProviderSettings,
    firstMessageContent: string,
  ) => Promise<string>
  applyGeneratedConversationTitle: (conversationId: string, title: string) => Promise<void>
  openSettings: () => void
  persistConversation: () => Promise<void>
  getAbortController: () => AbortController | null
  getThinkingEnabled: (provider: ActiveProviderSettings['provider']) => boolean
  setAbortController: (controller: AbortController | null) => void
}

interface StreamingReply {
  assistantId: string
  assistantIndex: number
  conversationId: string
  failureStage: SendFailureStage
  isNewConversation: boolean
}

export interface ChatAppSendActions {
  interruptActiveSend: (fallback?: string) => Promise<void>
  sendMessage: () => Promise<void>
  stopGenerating: () => Promise<void>
}

export function createChatAppSendActions(options: ChatAppSendActionsOptions): ChatAppSendActions {
  const {
    settings,
    activeConversationId,
    messages,
    pendingAttachments,
    draftMessage,
    isSending,
    lastError,
    interruptedResponseMessage,
    stoppedResponseMessage,
    streamChatCompletion,
    requestConversationTitle,
    applyGeneratedConversationTitle,
    openSettings,
    persistConversation,
    getAbortController,
    getThinkingEnabled,
    setAbortController,
  } = options

  async function sendMessage(): Promise<void> {
    const prepared = prepareSendRequest({
      pendingAttachments,
      draftMessage,
      isSending,
      settings,
      getThinkingEnabled,
      openSettings,
      lastError,
    })
    if (!prepared) {
      return
    }

    const reply = startStreamingReply(prepared.content, prepared.attachments)
    try {
      reply.failureStage = 'initial-persist'
      await persistConversation()
      if (reply.isNewConversation) {
        generateConversationTitle({
          applyGeneratedConversationTitle,
          conversationId: reply.conversationId,
          firstMessageContent: prepared.content,
          settingsSnapshot: prepared.activeSettings,
          requestConversationTitle,
        }).catch(console.error)
      }

      reply.failureStage = 'stream'
      reply.assistantIndex = await streamAssistantReply({
        messages,
        assistantIndex: reply.assistantIndex,
        assistantId: reply.assistantId,
        activeSettings: prepared.activeSettings,
        streamChatCompletion,
        getAbortController,
        thinkingEnabled: prepared.thinkingEnabled,
      })

      reply.failureStage = 'final-persist'
      reply.assistantIndex = patchAssistantMessage(
        messages,
        reply.assistantIndex,
        reply.assistantId,
        (draft) => {
          draft.status = 'done'
          draft.streamingStatus = undefined
        },
      )
      await persistConversation()
    } catch (error) {
      if (isAbortError(error)) {
        await handleInterruptedReply({
          messages,
          assistantIndex: reply.assistantIndex,
          assistantId: reply.assistantId,
          interruptedResponseMessage,
          persistConversation,
        })
      } else {
        await handleSendFailure({
          error,
          messages,
          assistantIndex: reply.assistantIndex,
          assistantId: reply.assistantId,
          shouldPersistFailureState: reply.failureStage === 'stream',
          lastError,
          persistConversation,
        })
      }
    } finally {
      isSending.value = false
      setAbortController(null)
    }
  }

  async function interruptActiveSend(fallback = interruptedResponseMessage): Promise<void> {
    if (!isSending.value) {
      return
    }

    const restored = finalizeStreamingMessages(messages.value, fallback)
    messages.value = restored.messages
    getAbortController()?.abort()

    if (!restored.changed) {
      return
    }

    try {
      await persistConversation()
    } catch (error) {
      lastError.value = getErrorMessage(error, '会话记录写入失败。')
    }
  }

  async function stopGenerating(): Promise<void> {
    await interruptActiveSend(stoppedResponseMessage)
  }

  function startStreamingReply(content: string, attachments: MessageAttachment[]): StreamingReply {
    const isNewConversation = !activeConversationId.value
    if (!activeConversationId.value) {
      activeConversationId.value = createConversationId()
      messages.value = []
    }

    const conversationId = activeConversationId.value as string
    const userMessage = createChatMessage('user', content, attachments)
    const assistantMessage = createChatMessage('assistant', '')
    messages.value = [...messages.value, userMessage, assistantMessage]

    draftMessage.value = ''
    pendingAttachments.value = []
    lastError.value = null
    isSending.value = true
    setAbortController(new AbortController())

    return {
      assistantId: assistantMessage.id,
      assistantIndex: messages.value.length - 1,
      conversationId,
      failureStage: 'initial-persist',
      isNewConversation,
    }
  }

  return {
    interruptActiveSend,
    sendMessage,
    stopGenerating,
  }
}
