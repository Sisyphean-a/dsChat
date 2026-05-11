import type { ChatMessage, ConversationDoc, MessageAttachment } from '../types/chat'
import { CONVERSATION_PREFIX } from '../constants/app'

export function createMessageId(): string {
  return crypto.randomUUID()
}

export function createConversationId(): string {
  return crypto.randomUUID()
}

export function createAttachmentId(): string {
  return crypto.randomUUID()
}

export function buildConversationTitle(messages: ChatMessage[]): string {
  const source = messages.find((message) => message.role === 'user')?.content ?? '新对话'
  return source.replace(/\s+/g, ' ').trim().slice(0, 24) || '新对话'
}

function resolveConversationTitle(existing?: ConversationDoc): string {
  return existing?.title?.trim() || '新对话'
}

function resolveConversationConfigId(
  existing: ConversationDoc | undefined,
  activeConfigId: string | undefined,
): string | undefined {
  const value = activeConfigId?.trim() ?? ''
  if (value) {
    return value
  }

  const fallback = existing?.configId?.trim() ?? ''
  return fallback || undefined
}

export function buildConversationDoc(
  id: string,
  messages: ChatMessage[],
  existing?: ConversationDoc,
  activeConfigId?: string,
): ConversationDoc {
  const now = Date.now()
  const configId = resolveConversationConfigId(existing, activeConfigId)

  const doc: ConversationDoc = {
    _id: existing?._id ?? `${CONVERSATION_PREFIX}${id}`,
    _rev: existing?._rev,
    type: 'conversation',
    id,
    title: resolveConversationTitle(existing),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    messages,
  }

  if (configId) {
    doc.configId = configId
  }

  return doc
}

export function cloneMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    ...message,
    attachments: message.attachments ? cloneMessageAttachments(message.attachments) : undefined,
  }))
}

export function cloneMessageAttachments(attachments: MessageAttachment[]): MessageAttachment[] {
  return attachments.map((item) => ({
    ...item,
  }))
}

export function cloneConversationDoc(conversation: ConversationDoc): ConversationDoc {
  return {
    ...conversation,
    messages: cloneMessages(conversation.messages),
  }
}

export function sortConversations(conversations: ConversationDoc[]): ConversationDoc[] {
  return [...conversations].sort((left, right) => right.updatedAt - left.updatedAt)
}
