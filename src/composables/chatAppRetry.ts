import type { Ref } from 'vue'
import type { ChatMessage, SettingsForm } from '../types/chat'
import { cloneMessages } from '../utils/chat'
import { prepareRequestContext, type PreparedRequestContext } from './chatAppRequestPreparation'

interface PrepareRetryRequestOptions {
  isSending: Ref<boolean>
  messages: Ref<ChatMessage[]>
  settings: Ref<SettingsForm>
  getThinkingEnabled: (provider: PreparedRequestContext['activeSettings']['provider']) => boolean
  openSettings: () => void
  lastError: Ref<string | null>
}

export interface RetryableAssistantReply {
  assistantId: string
  assistantIndex: number
}

export interface PreparedRetryRequest extends PreparedRequestContext, RetryableAssistantReply {}

export function resolveRetryableAssistantReply(messages: ChatMessage[]): RetryableAssistantReply | null {
  if (messages.length < 2) {
    return null
  }

  const assistantIndex = messages.length - 1
  const assistantMessage = messages[assistantIndex]
  const previousMessage = messages[assistantIndex - 1]
  if (!assistantMessage || !previousMessage) {
    return null
  }

  if (assistantMessage.role !== 'assistant' || previousMessage.role !== 'user') {
    return null
  }

  if (assistantMessage.status !== 'error' && assistantMessage.status !== 'interrupted') {
    return null
  }

  return {
    assistantId: assistantMessage.id,
    assistantIndex,
  }
}

export function prepareRetryRequest(
  options: PrepareRetryRequestOptions,
): PreparedRetryRequest | null {
  const {
    isSending,
    messages,
    settings,
    getThinkingEnabled,
    openSettings,
    lastError,
  } = options
  if (isSending.value) {
    return null
  }

  const retryableReply = resolveRetryableAssistantReply(messages.value)
  if (!retryableReply) {
    return null
  }

  const previousUserMessage = messages.value[retryableReply.assistantIndex - 1]
  if (!previousUserMessage) {
    return null
  }

  const requestContext = prepareRequestContext({
    attachments: previousUserMessage.attachments ?? [],
    getThinkingEnabled,
    lastError,
    openSettings,
    settings,
  })
  if (!requestContext) {
    return null
  }

  return {
    ...requestContext,
    ...retryableReply,
  }
}

export function buildRequestMessages(messages: ChatMessage[]): ChatMessage[] {
  return cloneMessages(messages.filter(shouldIncludeInRequestContext))
}

function shouldIncludeInRequestContext(message: ChatMessage): boolean {
  return message.role !== 'assistant'
    || (message.status !== 'error' && message.status !== 'interrupted')
}
