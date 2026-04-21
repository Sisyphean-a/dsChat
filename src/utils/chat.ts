import type { ChatMessage, ConversationDoc } from '../types/chat'
import { CONVERSATION_PREFIX } from '../constants/app'

export function createMessageId(): string {
  return crypto.randomUUID()
}

export function createConversationId(): string {
  return crypto.randomUUID()
}

export function buildConversationTitle(messages: ChatMessage[]): string {
  const source = messages.find((message) => message.role === 'user')?.content ?? '新对话'
  return source.replace(/\s+/g, ' ').trim().slice(0, 24) || '新对话'
}

function resolveConversationTitle(existing?: ConversationDoc): string {
  return existing?.title?.trim() || '新对话'
}

export function buildConversationDoc(
  id: string,
  messages: ChatMessage[],
  existing?: ConversationDoc,
): ConversationDoc {
  const now = Date.now()

  return {
    _id: existing?._id ?? `${CONVERSATION_PREFIX}${id}`,
    _rev: existing?._rev,
    type: 'conversation',
    id,
    title: resolveConversationTitle(existing),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    messages,
  }
}

export function cloneMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    ...message,
  }))
}

export function sortConversations(conversations: ConversationDoc[]): ConversationDoc[] {
  return [...conversations].sort((left, right) => right.updatedAt - left.updatedAt)
}
