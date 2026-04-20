import type { ChatMessage } from '../types/chat'
import { createMessageId } from '../utils/chat'

export function createChatMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: createMessageId(),
    role,
    content,
    createdAt: Date.now(),
    status: role === 'assistant' && !content ? 'streaming' : 'done',
  }
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
