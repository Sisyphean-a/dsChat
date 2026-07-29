import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDefaultSettings, createAddedModelDraft } from '../constants/providers'
import type { BaseDoc, ConversationDoc, SessionDoc } from '../types/chat'
import {
  deleteConversation,
  loadConversations,
  loadSession,
  loadSettings,
  saveConversation,
  saveSession,
  saveSettings,
} from './utools'

type StoredDoc = BaseDoc & Partial<Pick<SessionDoc, 'lastOutAt' | 'updatedAt'>>

describe('utools storage routing', () => {
  beforeEach(() => {
    vi.stubGlobal('window', createWindowMock())
  })

  afterEach(() => {
    delete window.utools
    window.localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('persists settings in localStorage when utools is unavailable', async () => {
    const settings = buildDefaultSettings()
    settings.fontSize = 'large'
    settings.deepseek.reasoningLevel = 'off'
    settings.theme = 'dark'
    settings.deepseek.apiKey = 'sk-local'
    settings.utoolsUploadMode = 'local-only'

    await saveSettings(settings)
    const loaded = await loadSettings()

    expect(loaded.fontSize).toBe('large')
    expect(loaded.deepseek.reasoningLevel).toBe('off')
    expect(loaded.theme).toBe('dark')
    expect(loaded.deepseek.apiKey).toBe('sk-local')
    expect(loaded.utoolsUploadMode).toBe('local-only')
  })

  it('reports local storage quota exhaustion instead of hiding the failed save', async () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: vi.fn(),
        getItem: vi.fn(() => null),
        key: vi.fn(() => null),
        get length() {
          return 0
        },
        removeItem: vi.fn(),
        setItem: vi.fn(() => {
          throw new DOMException('quota exceeded', 'QuotaExceededError')
        }),
      } as Storage,
    })

    await expect(saveSettings(buildDefaultSettings())).rejects.toThrow('浏览器本地存储空间不足')
  })

  it('uploads only settings when the upload mode is settings-only', async () => {
    const remote = installMockUtools()
    const settings = buildDefaultSettings()
    settings.deepseek.apiKey = 'sk-remote'
    settings.utoolsUploadMode = 'settings-only'

    await saveSettings(settings)
    await saveConversation(createConversation('c-1', '本地会话'))
    await saveSession(createSession('c-1'))

    expect(remote.docs.has('settings/config')).toBe(true)
    expect(remote.docs.has('conversation/c-1')).toBe(false)
    expect(remote.docs.has('session/runtime')).toBe(false)

    const conversations = await loadConversations()
    const session = await loadSession()

    expect(conversations.map((item) => item.id)).toEqual(['c-1'])
    expect(session?.currentConversationId).toBe('c-1')
  })

  it('syncs local conversations and session to utools when switching to all-data', async () => {
    const remote = installMockUtools()
    const settings = buildDefaultSettings()
    settings.utoolsUploadMode = 'settings-only'

    await saveSettings(settings)
    await saveConversation(createConversation('c-1', '切换前本地会话'))
    await saveSession(createSession('c-1'))

    settings.utoolsUploadMode = 'all-data'
    await saveSettings(settings)

    expect(remote.docs.has('settings/config')).toBe(true)
    expect(remote.docs.has('conversation/c-1')).toBe(true)
    expect(remote.docs.has('session/runtime')).toBe(true)
  })

  it('keeps the newer remote session when enabling all-data sync', async () => {
    const remote = installMockUtools([{
      ...createSession('remote-current'),
      updatedAt: 20,
    }])
    const settings = buildDefaultSettings()
    settings.utoolsUploadMode = 'local-only'

    await saveSettings(settings)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(10))
    try {
      await saveSession(createSession('local-stale'))

      settings.utoolsUploadMode = 'all-data'
      await saveSettings(settings)

      expect((remote.docs.get('session/runtime') as unknown as SessionDoc).currentConversationId).toBe('remote-current')
      await expect(loadSession()).resolves.toMatchObject({ currentConversationId: 'remote-current' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('uses lastOutAt to merge legacy sessions without updatedAt', async () => {
    const remote = installMockUtools([{
      ...createSession('remote-newer'),
      lastOutAt: 20,
    }])
    const settings = buildDefaultSettings()
    settings.utoolsUploadMode = 'local-only'

    await saveSettings(settings)
    window.localStorage.setItem('dsChat/doc/session/runtime', JSON.stringify({
      ...createSession('local-older'),
      lastOutAt: 10,
    }))

    settings.utoolsUploadMode = 'all-data'
    await saveSettings(settings)

    expect((remote.docs.get('session/runtime') as unknown as SessionDoc).currentConversationId).toBe('remote-newer')
  })

  it('uses remote session as the deterministic winner when legacy timestamps are tied', async () => {
    const remote = installMockUtools([createSession('remote-session')])
    const settings = buildDefaultSettings()
    settings.utoolsUploadMode = 'local-only'

    await saveSettings(settings)
    window.localStorage.setItem('dsChat/doc/session/runtime', JSON.stringify(createSession('local-session')))

    settings.utoolsUploadMode = 'all-data'
    await saveSettings(settings)

    expect((remote.docs.get('session/runtime') as unknown as SessionDoc).currentConversationId).toBe('remote-session')
  })

  it('keeps the newer local session when enabling all-data sync', async () => {
    const remote = installMockUtools([{
      ...createSession('remote-stale'),
      updatedAt: 10,
    }])
    const settings = buildDefaultSettings()
    settings.utoolsUploadMode = 'local-only'

    await saveSettings(settings)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(20))
    try {
      await saveSession(createSession('local-current'))

      settings.utoolsUploadMode = 'all-data'
      await saveSettings(settings)

      expect((remote.docs.get('session/runtime') as unknown as SessionDoc).currentConversationId).toBe('local-current')
    } finally {
      vi.useRealTimers()
    }
  })

  it('deletes local conversations without touching remote storage in settings-only mode', async () => {
    const remote = installMockUtools()
    const settings = buildDefaultSettings()
    settings.utoolsUploadMode = 'settings-only'

    await saveSettings(settings)
    await saveConversation(createConversation('c-1', '本地会话'))

    await deleteConversation(createConversation('c-1', '本地会话'))

    expect(remote.promises.remove).toHaveBeenCalledTimes(0)
    await expect(loadConversations()).resolves.toEqual([])
  })

  it('deletes mirrored conversations from remote storage in all-data mode', async () => {
    const remote = installMockUtools()
    const settings = buildDefaultSettings()
    settings.utoolsUploadMode = 'all-data'

    await saveSettings(settings)
    await saveConversation(createConversation('c-1', '远端会话'))

    expect(remote.docs.has('conversation/c-1')).toBe(true)

    await deleteConversation(createConversation('c-1', '远端会话'))

    expect(remote.promises.remove).toHaveBeenCalledWith('conversation/c-1')
    expect(remote.docs.has('conversation/c-1')).toBe(false)
    await expect(loadConversations()).resolves.toEqual([])
  })

  it('keeps the newer remote conversation when enabling all-data sync', async () => {
    const remote = installMockUtools([createConversation('shared', '远端较新会话', 20)])
    const settings = buildDefaultSettings()
    settings.utoolsUploadMode = 'local-only'

    await saveSettings(settings)
    await saveConversation(createConversation('shared', '本地较旧会话', 10))

    settings.utoolsUploadMode = 'all-data'
    await saveSettings(settings)

    expect((remote.docs.get('conversation/shared') as unknown as ConversationDoc).title).toBe('远端较新会话')
    await expect(loadConversations()).resolves.toMatchObject([
      { id: 'shared', title: '远端较新会话' },
    ])
  })

  it('hydrates remote-only conversations before clearing all-data storage', async () => {
    const remote = installMockUtools()
    const settings = buildDefaultSettings()
    settings.utoolsUploadMode = 'all-data'

    await saveSettings(settings)
    remote.docs.set('conversation/remote-only', createConversation('remote-only', '仅远端会话', 10))

    await expect(loadConversations()).resolves.toMatchObject([
      { id: 'remote-only', title: '仅远端会话' },
    ])

    settings.utoolsUploadMode = 'local-only'
    await saveSettings(settings)

    await expect(loadConversations()).resolves.toMatchObject([
      { id: 'remote-only', title: '仅远端会话' },
    ])
    expect(remote.docs.has('conversation/remote-only')).toBe(false)
  })

  it('clears remote settings and chat data when switching to local-only', async () => {
    const remote = installMockUtools()
    const settings = buildDefaultSettings()
    settings.deepseek.apiKey = 'sk-remote'
    settings.utoolsUploadMode = 'all-data'

    await saveSettings(settings)
    await saveConversation(createConversation('c-1', '远端会话'))
    await saveSession(createSession('c-1'))

    settings.utoolsUploadMode = 'local-only'
    await saveSettings(settings)

    expect(remote.docs.has('settings/config')).toBe(false)
    expect(remote.docs.has('conversation/c-1')).toBe(false)
    expect(remote.docs.has('session/runtime')).toBe(false)
  })

  it('round-trips the new settings format with custom models in local mode', async () => {
    const settings = buildDefaultSettings()
    const openaiModel = createAddedModelDraft('openai', [])
    openaiModel.name = 'OpenAI 工作模型'
    openaiModel.apiKey = 'sk-openai'
    openaiModel.model = 'gpt-5.5'
    openaiModel.reasoningLevel = 'high'

    settings.activeConfigId = openaiModel.id
    settings.fontSize = 'large'
    settings.theme = 'dark'
    settings.utoolsUploadMode = 'local-only'
    settings.customModels = [openaiModel]

    await saveSettings(settings)
    const loaded = await loadSettings()

    expect(loaded.activeConfigId).toBe(openaiModel.id)
    expect(loaded.fontSize).toBe('large')
    expect(loaded.customModels[0]?.reasoningLevel).toBe('high')
    expect(loaded.theme).toBe('dark')
    expect(loaded.utoolsUploadMode).toBe('local-only')
    expect(loaded.customModels[0]).toEqual({
      ...openaiModel,
      baseUrl: 'https://api.openai.com/v1',
      capabilities: {
        imageInput: true,
        nativeWebSearch: true,
        protocol: 'responses',
        reasoning: true,
        toolCalling: false,
      },
      modelOptions: [...openaiModel.modelOptions, 'gpt-5.5'],
      temperature: 1,
    })
  })
})

function createConversation(id: string, title: string, updatedAt = 1): ConversationDoc {
  return {
    _id: `conversation/${id}`,
    type: 'conversation',
    id,
    title,
    createdAt: 1,
    updatedAt,
    messages: [
      {
        id: `user-${id}`,
        role: 'user',
        content: title,
        createdAt: 1,
        status: 'done',
      },
    ],
  }
}

function createSession(conversationId: string): SessionDoc {
  return {
    _id: 'session/runtime',
    type: 'session',
    currentConversationId: conversationId,
    lastOutAt: null,
  }
}

function installMockUtools(initialDocs: StoredDoc[] = []) {
  const docs = new Map(initialDocs.map((doc) => [doc._id, cloneSerializable(doc)]))
  const promises = {
    allDocs: vi.fn(async (prefix = '') => {
      return [...docs.values()]
        .filter((doc) => doc._id.startsWith(prefix))
        .map((doc) => cloneSerializable(doc))
    }),
    get: vi.fn(async (id: string) => {
      const doc = docs.get(id)
      return doc ? cloneSerializable(doc) : null
    }),
    put: vi.fn(async (doc: BaseDoc) => {
      const current = docs.get(doc._id)
      const next = cloneSerializable({
        ...doc,
        _rev: `${readRevisionNumber(current?._rev) + 1}-remote`,
      })
      docs.set(next._id, next)
      return {
        id: next._id,
        ok: true,
        rev: next._rev,
      }
    }),
    remove: vi.fn(async (docOrId: BaseDoc | string) => {
      const id = typeof docOrId === 'string' ? docOrId : docOrId._id
      const existed = docs.delete(id)
      return existed
        ? { id, ok: true }
        : { error: true, id, message: 'not found' }
    }),
  }

  Object.defineProperty(window, 'utools', {
    configurable: true,
    value: {
      db: {
        promises,
      },
    },
  })

  return {
    docs,
    promises,
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

function createWindowMock(): Window & typeof globalThis {
  return {
    localStorage: createLocalStorageMock(),
  } as Window & typeof globalThis
}

function createLocalStorageMock(): Storage {
  const store = new Map<string, string>()

  return {
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    key(index: number) {
      return [...store.keys()][index] ?? null
    },
    get length() {
      return store.size
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
  } as Storage
}
