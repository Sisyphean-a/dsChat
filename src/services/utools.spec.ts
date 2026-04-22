import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildDefaultSettings, createAddedModelDraft } from '../constants/providers'
import type { BaseDoc, ConversationDoc, SessionDoc } from '../types/chat'
import {
  loadConversations,
  loadSession,
  loadSettings,
  saveConversation,
  saveSession,
  saveSettings,
} from './utools'

type StoredDoc = BaseDoc & Record<string, unknown>

describe('utools storage routing', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete window.utools
    window.localStorage.clear()
  })

  it('migrates legacy flat settings docs into the deepseek-first structure', async () => {
    installMockUtools([
      {
        _id: 'settings/config',
        type: 'settings',
        apiKey: 'sk-legacy',
        baseUrl: 'https://api.deepseek.com/',
        model: 'deepseek-chat',
        temperature: 1.5,
        theme: 'dark',
      },
    ])

    const settings = await loadSettings()

    expect(settings.activeConfigId).toBe('deepseek')
    expect(settings.theme).toBe('dark')
    expect(settings.utoolsUploadMode).toBe('all-data')
    expect(settings.deepseek).toEqual({
      apiKey: 'sk-legacy',
      baseUrl: 'https://api.deepseek.com/',
      model: 'deepseek-chat',
      temperature: 1.5,
    })
    expect(settings.customModels).toEqual([])
  })

  it('persists settings in localStorage when utools is unavailable', async () => {
    const settings = buildDefaultSettings()
    settings.theme = 'dark'
    settings.deepseek.apiKey = 'sk-local'
    settings.utoolsUploadMode = 'local-only'

    await saveSettings(settings)
    const loaded = await loadSettings()

    expect(loaded.theme).toBe('dark')
    expect(loaded.deepseek.apiKey).toBe('sk-local')
    expect(loaded.utoolsUploadMode).toBe('local-only')
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

  it('migrates the previous multi-provider document into deepseek plus custom models', async () => {
    installMockUtools([
      {
        _id: 'settings/config',
        type: 'settings',
        activeProvider: 'openai',
        providers: {
          claude: {
            apiKey: 'sk-ant-test',
            baseUrl: 'https://api.anthropic.com/v1',
            model: 'claude-sonnet-4-6',
            temperature: 1,
          },
          deepseek: {
            apiKey: 'sk-deepseek',
            baseUrl: 'https://api.deepseek.com',
            model: 'deepseek-chat',
            temperature: 1,
          },
          kimi: {
            apiKey: '',
            baseUrl: 'https://api.moonshot.cn/v1',
            model: 'kimi-k2.6',
            temperature: 1,
          },
          minimax: {
            apiKey: 'sk-minimax',
            baseUrl: 'https://api.minimaxi.com/v1',
            model: 'MiniMax-M2.7',
            temperature: 1,
          },
          openai: {
            apiKey: 'sk-openai',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4.1',
            temperature: 1,
          },
        },
        theme: 'dark',
      },
    ])

    const settings = await loadSettings()

    expect(settings.deepseek.apiKey).toBe('sk-deepseek')
    expect(settings.theme).toBe('dark')
    expect(settings.utoolsUploadMode).toBe('all-data')
    expect(settings.customModels.map((item) => item.provider)).toEqual(['openai', 'minimax'])
    expect(settings.customModels[0]?.model).toBe('gpt-4.1')
    expect(settings.activeConfigId).toBe(settings.customModels[0]?.id)
  })

  it('round-trips the new settings format with custom models in local mode', async () => {
    const settings = buildDefaultSettings()
    const openaiModel = createAddedModelDraft('openai', [])
    openaiModel.name = 'OpenAI 工作模型'
    openaiModel.apiKey = 'sk-openai'
    openaiModel.model = 'gpt-4.1'

    settings.activeConfigId = openaiModel.id
    settings.theme = 'dark'
    settings.utoolsUploadMode = 'local-only'
    settings.customModels = [openaiModel]

    await saveSettings(settings)
    const loaded = await loadSettings()

    expect(loaded.activeConfigId).toBe(openaiModel.id)
    expect(loaded.theme).toBe('dark')
    expect(loaded.utoolsUploadMode).toBe('local-only')
    expect(loaded.customModels[0]).toEqual({
      ...openaiModel,
      baseUrl: 'https://api.openai.com/v1',
      temperature: 1,
    })
  })
})

function createConversation(id: string, title: string): ConversationDoc {
  return {
    _id: `conversation/${id}`,
    type: 'conversation',
    id,
    title,
    createdAt: 1,
    updatedAt: 1,
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
