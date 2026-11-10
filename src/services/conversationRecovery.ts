import type { ChatMessage, ConversationDoc } from '../types/chat'

export interface ConversationRecoveryResult {
  conversations: ConversationDoc[]
  /** 远程独有、本地没有的会话数。 */
  recoveredConversations: number
  /** 补进本地的消息条数。 */
  recoveredMessages: number
}

export interface ConversationRecoveryState {
  scanning: boolean
  availableConversations: number
  availableMessages: number
  recoveredConversations: number
  recoveredMessages: number
  error: string | null
}

export const EMPTY_RECOVERY_STATE: ConversationRecoveryState = {
  scanning: false,
  availableConversations: 0,
  availableMessages: 0,
  recoveredConversations: 0,
  recoveredMessages: 0,
  error: null,
}

/**
 * Flow: 把 uTools 数据库里的会话并回本地，只补缺失内容，不覆盖本地已有消息。
 * Rule: 同一会话按消息 id 取并集；同一 id 以本地为准，只有本地仍是 streaming 而远端是终态时才采用远端。
 * Guarantee: 纯函数，不写存储，可用于“先扫描再恢复”。
 */
export function mergeRecoveredConversations(
  local: ConversationDoc[],
  remote: ConversationDoc[],
): ConversationRecoveryResult {
  const localById = new Map(local.map((conversation) => [conversation.id, conversation]))
  const merged: ConversationDoc[] = []
  let recoveredConversations = 0
  let recoveredMessages = 0

  for (const conversation of local) {
    const remoteConversation = remote.find((item) => item.id === conversation.id)
    if (!remoteConversation) {
      merged.push(conversation)
      continue
    }
    const result = mergeConversation(conversation, remoteConversation)
    merged.push(result.conversation)
    if (result.addedMessages > 0) {
      recoveredConversations += 1
      recoveredMessages += result.addedMessages
    }
  }

  for (const conversation of remote) {
    if (localById.has(conversation.id)) continue
    merged.push(conversation)
    recoveredConversations += 1
    recoveredMessages += conversation.messages.length
  }

  return { conversations: merged, recoveredConversations, recoveredMessages }
}

function mergeConversation(
  local: ConversationDoc,
  remote: ConversationDoc,
): { conversation: ConversationDoc; addedMessages: number } {
  const localMessages = new Map(local.messages.map((message, index) => [messageKey(message, index), message]))
  const messages = [...local.messages]
  let addedMessages = 0

  remote.messages.forEach((message, index) => {
    const key = messageKey(message, index)
    const existing = localMessages.get(key)
    if (!existing) {
      messages.push(message)
      addedMessages += 1
      return
    }
    const result = preferTerminalMessage(existing, message)
    if (result !== existing) {
      const position = messages.findIndex((item, itemIndex) => item.id === existing.id
        && messageKey(item, itemIndex) === key)
      if (position >= 0) messages[position] = result
    }
  })

  return {
    addedMessages,
    conversation: {
      ...local,
      title: local.title.trim() ? local.title : remote.title,
      updatedAt: Math.max(local.updatedAt, remote.updatedAt),
      messages: messages.sort((a, b) => a.createdAt - b.createdAt),
    },
  }
}

function preferTerminalMessage(local: ChatMessage, remote: ChatMessage): ChatMessage {
  if (local.status === 'streaming' && remote.status !== 'streaming') {
    return remote
  }
  return local
}

function messageKey(message: ChatMessage, index: number): string {
  return message.id || `${message.role}-${message.createdAt}-${index}`
}
