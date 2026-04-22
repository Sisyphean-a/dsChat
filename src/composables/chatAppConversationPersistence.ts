import type { Ref } from 'vue'
import { SESSION_DOC_ID } from '../constants/app'
import type { ChatMessage, ConversationDoc, SessionDoc } from '../types/chat'
import {
  buildConversationDoc,
  cloneConversationDoc,
  cloneMessages,
  sortConversations,
} from '../utils/chat'

interface ChatAppConversationPersistenceOptions {
  activeConversationId: Ref<string | null>
  conversations: Ref<ConversationDoc[]>
  messages: Ref<ChatMessage[]>
  saveConversation: (conversation: ConversationDoc) => Promise<ConversationDoc>
  saveSession: (session: SessionDoc) => Promise<SessionDoc>
}

export interface ChatAppConversationPersistenceActions {
  applyGeneratedConversationTitle: (conversationId: string, title: string) => Promise<void>
  persistConversation: () => Promise<void>
  persistSession: (conversationId: string | null) => Promise<void>
}

export function createChatAppConversationPersistence(
  options: ChatAppConversationPersistenceOptions,
): ChatAppConversationPersistenceActions {
  const {
    activeConversationId,
    conversations,
    messages,
    saveConversation,
    saveSession,
  } = options

  const conversationWriteLocks = new Map<string, Promise<void>>()

  async function persistConversation(): Promise<void> {
    if (!activeConversationId.value || !messages.value.length) {
      await persistSession(activeConversationId.value)
      return
    }

    const conversationId = activeConversationId.value
    const messageSnapshot = cloneMessages(messages.value)

    await runConversationWrite(conversationId, async () => {
      const existing = conversations.value.find((conversation) => conversation.id === conversationId)
      const saved = await saveConversation(
        buildConversationDoc(conversationId, messageSnapshot, existing),
      )
      mergeConversation(saved)
      await persistSession(saved.id)
    })
  }

  async function applyGeneratedConversationTitle(
    conversationId: string,
    title: string,
  ): Promise<void> {
    await runConversationWrite(conversationId, async () => {
      const latest = conversations.value.find((conversation) => conversation.id === conversationId)
      if (!latest || latest.title === title) {
        return
      }

      const saved = await saveConversation({
        ...cloneConversationDoc(latest),
        title,
      })
      mergeConversation(saved)
    })
  }

  async function persistSession(conversationId: string | null): Promise<void> {
    const session: SessionDoc = {
      _id: SESSION_DOC_ID,
      type: 'session',
      currentConversationId: conversationId,
      lastOutAt: null,
    }

    await saveSession(session)
  }

  function mergeConversation(savedConversation: ConversationDoc): void {
    conversations.value = sortConversations([
      savedConversation,
      ...conversations.value.filter((conversation) => conversation.id !== savedConversation.id),
    ])
  }

  function runConversationWrite<T>(
    conversationId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = conversationWriteLocks.get(conversationId) ?? Promise.resolve()
    let release: () => void = () => {}
    const current = new Promise<void>((resolve) => {
      release = resolve
    })
    const nextLock = previous.catch(() => undefined).then(() => current)

    conversationWriteLocks.set(conversationId, nextLock)

    return previous.catch(() => undefined).then(async () => {
      try {
        return await operation()
      } finally {
        release()
        if (conversationWriteLocks.get(conversationId) === nextLock) {
          conversationWriteLocks.delete(conversationId)
        }
      }
    })
  }

  return {
    applyGeneratedConversationTitle,
    persistConversation,
    persistSession,
  }
}
