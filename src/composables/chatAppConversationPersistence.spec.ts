import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { ChatMessage, ConversationDoc, SessionDoc } from '../types/chat'
import { createChatAppConversationPersistence } from './chatAppConversationPersistence'

describe('createChatAppConversationPersistence', () => {
  it('saves a structured-cloneable conversation when applying a generated title', async () => {
    const activeConversationId = ref('conversation-1')
    const conversations = ref<ConversationDoc[]>([])
    const messages = ref<ChatMessage[]>([
      createMessage('user', '解释一下什么是大语言模型'),
      createMessage('assistant', ''),
    ])
    const savedDocs: ConversationDoc[] = []
    const saveConversation = vi.fn(async (conversation: ConversationDoc) => {
      const cloned = structuredClone(conversation)
      savedDocs.push(cloned)
      return cloned
    })

    const persistence = createChatAppConversationPersistence({
      getActiveConfigId: () => 'deepseek',
      activeConversationId,
      conversations,
      deleteConversationDoc: vi.fn().mockResolvedValue(undefined),
      messages,
      saveConversation,
      saveSession: vi.fn(async (session: SessionDoc) => session),
    })

    await persistence.persistConversation()

    await expect(
      persistence.applyGeneratedConversationTitle('conversation-1', '大语言模型简介'),
    ).resolves.toBeUndefined()

    expect(saveConversation).toHaveBeenCalledTimes(2)
    expect(savedDocs[0]?.configId).toBe('deepseek')
    expect(savedDocs[1]?.title).toBe('大语言模型简介')
    expect(savedDocs[1]?.messages[0]?.content).toBe('解释一下什么是大语言模型')
  })

  it('serializes title and message writes for the same conversation', async () => {
    const activeConversationId = ref('conversation-1')
    const conversations = ref<ConversationDoc[]>([])
    const messages = ref<ChatMessage[]>([
      createMessage('user', '解释一下什么是大语言模型'),
      createMessage('assistant', ''),
    ])

    const titleSaveStarted = createDeferred<void>()
    const releaseTitleSave = createDeferred<void>()
    const revisionStore = createConcurrentRevisionedStore(async ({ callIndex }) => {
      if (callIndex === 2) {
        titleSaveStarted.resolve()
        await releaseTitleSave.promise
      }
    })

    const persistence = createChatAppConversationPersistence({
      getActiveConfigId: () => 'deepseek',
      activeConversationId,
      conversations,
      deleteConversationDoc: vi.fn().mockResolvedValue(undefined),
      messages,
      saveConversation: (conversation) => revisionStore.save(conversation),
      saveSession: vi.fn(async (session: SessionDoc) => session),
    })

    await persistence.persistConversation()

    const applyTitlePromise = persistence.applyGeneratedConversationTitle('conversation-1', '大语言模型简介')
    await titleSaveStarted.promise

    messages.value = [
      createMessage('user', '解释一下什么是大语言模型'),
      {
        ...createMessage('assistant', '大语言模型是基于海量语料训练的生成模型'),
        status: 'done',
      },
    ]

    const persistFinalPromise = persistence.persistConversation()
    releaseTitleSave.resolve()

    await applyTitlePromise
    await persistFinalPromise

    expect(conversations.value[0]?.title).toBe('大语言模型简介')
    expect(conversations.value[0]?.messages[1]?.content).toBe('大语言模型是基于海量语料训练的生成模型')
  })

  it('serializes deletion behind an in-flight title write for the same conversation', async () => {
    const activeConversationId = ref('conversation-1')
    const conversations = ref<ConversationDoc[]>([])
    const messages = ref<ChatMessage[]>([
      createMessage('user', '解释一下什么是大语言模型'),
      createMessage('assistant', ''),
    ])

    const titleSaveStarted = createDeferred<void>()
    const releaseTitleSave = createDeferred<void>()
    const deleteConversationDoc = vi.fn().mockResolvedValue(undefined)
    const revisionStore = createConcurrentRevisionedStore(async ({ callIndex, title }) => {
      if (callIndex === 2 && title === '大语言模型简介') {
        titleSaveStarted.resolve()
        await releaseTitleSave.promise
      }
    })

    const persistence = createChatAppConversationPersistence({
      getActiveConfigId: () => 'deepseek',
      activeConversationId,
      conversations,
      deleteConversationDoc,
      messages,
      saveConversation: (conversation) => revisionStore.save(conversation),
      saveSession: vi.fn(async (session: SessionDoc) => session),
    })

    await persistence.persistConversation()

    const applyTitlePromise = persistence.applyGeneratedConversationTitle('conversation-1', '大语言模型简介')
    await titleSaveStarted.promise

    const deletePromise = persistence.deleteConversation('conversation-1')
    releaseTitleSave.resolve()

    await applyTitlePromise
    await deletePromise

    expect(deleteConversationDoc).toHaveBeenCalledWith(expect.objectContaining({
      id: 'conversation-1',
      title: '大语言模型简介',
    }))
    expect(activeConversationId.value).toBeNull()
    expect(messages.value).toEqual([])
    expect(conversations.value).toEqual([])
  })
})

function createMessage(
  role: ChatMessage['role'],
  content: string,
): ChatMessage {
  return {
    id: `${role}-${content}`,
    role,
    content,
    createdAt: 1,
    status: role === 'assistant' ? 'streaming' : 'done',
  }
}

function createDeferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })

  return {
    promise,
    resolve,
  }
}

function createConcurrentRevisionedStore(
  beforeCommit: (context: { callIndex: number; docId: string; title?: string }) => Promise<void>,
) {
  const docs = new Map<string, { _id: string; _rev?: string }>()
  const inFlightRevisions = new Map<string, string | undefined>()
  let callIndex = 0

  return {
    async save<T extends { _id: string; _rev?: string }>(doc: T): Promise<T> {
      callIndex += 1
      const current = docs.get(doc._id)
      if (current && inFlightRevisions.get(doc._id) === doc._rev && current._rev === doc._rev) {
        throw new Error(
          `stale revision for ${doc._id} on call ${callIndex} (doc=${doc._rev ?? 'none'}, current=${current?._rev ?? 'none'})`,
        )
      }

      inFlightRevisions.set(doc._id, doc._rev)

      try {
        await beforeCommit({
          callIndex,
          docId: doc._id,
          title: 'title' in doc && typeof doc.title === 'string' ? doc.title : undefined,
        })

        const latest = docs.get(doc._id)
        if (latest?._rev && doc._rev !== latest._rev) {
          throw new Error(
            `stale revision for ${doc._id} on call ${callIndex} after wait (doc=${doc._rev ?? 'none'}, current=${latest._rev})`,
          )
        }

        const saved = cloneSerializable({
          ...doc,
          _rev: `${readRevisionNumber(latest?._rev) + 1}-mock`,
        }) as T
        docs.set(saved._id, saved)
        return cloneSerializable(saved)
      } finally {
        if (inFlightRevisions.get(doc._id) === doc._rev) {
          inFlightRevisions.delete(doc._id)
        }
      }
    },
  }
}

function readRevisionNumber(revision?: string): number {
  if (!revision) {
    return 0
  }

  return Number.parseInt(revision, 10) || 0
}

function cloneSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
