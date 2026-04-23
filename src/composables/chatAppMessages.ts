import type { ChatMessage, MessageAttachment } from '../types/chat'
import { createMessageId } from '../utils/chat'

export function createChatMessage(
  role: ChatMessage['role'],
  content: string,
  attachments: MessageAttachment[] = [],
): ChatMessage {
  const normalizedAttachments = attachments.length
    ? attachments.map((item) => ({ ...item }))
    : undefined

  return {
    id: createMessageId(),
    role,
    content,
    attachments: normalizedAttachments,
    createdAt: Date.now(),
    status: role === 'assistant' && !content ? 'streaming' : 'done',
  }
}

export function finalizeStreamingMessages(
  messages: ChatMessage[],
  fallback: string,
): { changed: boolean; messages: ChatMessage[] } {
  let changed = false

  const nextMessages = messages.map((message) => {
    if (message.status !== 'streaming') {
      return { ...message }
    }

    changed = true
    return {
      ...message,
      content: message.content.trim() ? message.content : fallback,
      status: 'interrupted' as const,
    }
  })

  return { changed, messages: nextMessages }
}

export function updateMessageById(
  messages: ChatMessage[],
  id: string,
  mutate: (message: ChatMessage) => void,
): ChatMessage[] {
  return messages.map((message) => {
    if (message.id !== id) {
      return message
    }

    const next = { ...message }
    mutate(next)
    return next
  })
}
