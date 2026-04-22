import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDefaultSettings, createAddedModelDraft } from '../constants/providers'
import type { ProviderSettings, SettingsForm } from '../types/chat'

vi.mock('../services/chatCompletion', () => ({
  streamChatCompletion: vi.fn(),
}))

vi.mock('../services/conversationTitle', () => ({
  requestConversationTitle: vi.fn().mockResolvedValue('自动标题'),
}))

vi.mock('../services/utools', () => ({
  deleteConversation: vi.fn().mockResolvedValue(undefined),
  hasUtools: vi.fn(() => false),
  loadConversations: vi.fn().mockResolvedValue([]),
  loadSession: vi.fn().mockResolvedValue(null),
  loadSettings: vi.fn().mockResolvedValue(createSettings()),
  saveConversation: vi.fn(async (conversation) => conversation),
  saveSession: vi.fn().mockResolvedValue(undefined),
  saveSettings: vi.fn(),
}))

import { streamChatCompletion } from '../services/chatCompletion'
import { requestConversationTitle } from '../services/conversationTitle'
import {
  deleteConversation,
  hasUtools,
  loadConversations,
  loadSession,
  loadSettings,
  saveConversation,
  saveSettings,
} from '../services/utools'
import { useChatApp } from './useChatApp'

describe('useChatApp', () => {
  beforeEach(() => {
    vi.mocked(hasUtools).mockReturnValue(false)
    vi.mocked(loadConversations).mockResolvedValue([])
    vi.mocked(loadSession).mockResolvedValue(null)
    vi.mocked(loadSettings).mockResolvedValue(createSettings())
    vi.mocked(deleteConversation).mockResolvedValue(undefined)
    vi.mocked(requestConversationTitle).mockResolvedValue('自动标题')
    vi.mocked(saveConversation).mockImplementation(async (conversation) => conversation)
    vi.mocked(streamChatCompletion).mockReset()
  })

  it('starts with a clean conversation when there is no history', async () => {
    const app = useChatApp()

    await app.initialize()

    expect(app.messages.value).toEqual([])
  })

  it('persists a valid deepseek message flow without crashing', async () => {
    vi.mocked(loadSettings).mockResolvedValue(createSettings({
      deepseek: {
        apiKey: 'sk-test',
      },
    }))
    vi.mocked(streamChatCompletion).mockImplementation(async (_messages, _settings, onDelta) => {
      onDelta({ content: '你好，我在。' })
      return '你好，我在。'
    })

    const app = useChatApp()
    await app.initialize()
    app.draftMessage.value = '你好'

    await app.sendMessage()

    expect(app.lastError.value).toBeNull()
    expect(app.messages.value).toHaveLength(2)
    expect(app.messages.value[0]?.content).toBe('你好')
    expect(app.messages.value[1]?.content).toBe('你好，我在。')
    expect(app.messages.value[1]?.status).toBe('done')
  })

  it('stores reasoning content when deepseek reasoner streams thinking output', async () => {
    vi.mocked(loadSettings).mockResolvedValue(createSettings({
      deepseek: {
        apiKey: 'sk-test',
        model: 'deepseek-reasoner',
      },
    }))
    vi.mocked(streamChatCompletion).mockImplementation(async (_messages, _settings, onDelta) => {
      onDelta({ reasoningContent: '先思考' })
      onDelta({ content: '再回答' })
      return '再回答'
    })

    const app = useChatApp()
    await app.initialize()
    app.draftMessage.value = '你好'

    await app.sendMessage()

    expect(app.messages.value[1]?.reasoningContent).toBe('先思考')
    expect(app.messages.value[1]?.content).toBe('再回答')
    expect(app.messages.value[1]?.status).toBe('done')
  })

  it('starts title generation before the streaming reply finishes', async () => {
    vi.mocked(hasUtools).mockReturnValue(true)
    vi.mocked(loadSettings).mockResolvedValue(createSettings({
      deepseek: {
        apiKey: 'sk-test',
      },
    }))

    let resolveReply: (value: string) => void = () => {
      throw new Error('流式回调未建立。')
    }
    vi.mocked(streamChatCompletion).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveReply = resolve
        }),
    )

    const app = useChatApp()
    await app.initialize()
    app.draftMessage.value = '给这段对话起标题'

    const sendPromise = app.sendMessage()

    await vi.waitFor(() => {
      expect(requestConversationTitle).toHaveBeenCalledWith(
        {
          configId: 'deepseek',
          label: 'DeepSeek',
          provider: 'deepseek',
          apiKey: 'sk-test',
          baseUrl: 'https://api.deepseek.com',
          model: 'deepseek-chat',
          temperature: 1,
        },
        '给这段对话起标题',
      )
    })

    expect(app.conversations.value[0]?.title).toBe('自动标题')

    resolveReply('流式回复')
    await sendPromise
  })

  it('still starts title generation when utools is unavailable (browser mode)', async () => {
    vi.mocked(hasUtools).mockReturnValue(false)
    vi.mocked(loadSettings).mockResolvedValue(createSettings({
      deepseek: {
        apiKey: 'sk-test',
      },
    }))
    vi.mocked(streamChatCompletion).mockResolvedValue('流式回复')

    const app = useChatApp()
    await app.initialize()
    app.draftMessage.value = '浏览器模式也应触发标题请求'

    await app.sendMessage()

    await vi.waitFor(() => {
      expect(requestConversationTitle).toHaveBeenCalledWith(
        expect.objectContaining({
          configId: 'deepseek',
          provider: 'deepseek',
        }),
        '浏览器模式也应触发标题请求',
      )
    })
  })

  it('falls back to local title when title generation request fails', async () => {
    vi.mocked(hasUtools).mockReturnValue(true)
    vi.mocked(loadSettings).mockResolvedValue(createSettings({
      deepseek: {
        apiKey: 'sk-test',
      },
    }))
    vi.mocked(requestConversationTitle).mockRejectedValueOnce(new Error('title api failed'))
    vi.mocked(streamChatCompletion).mockResolvedValue('流式回复')

    const app = useChatApp()
    await app.initialize()
    app.draftMessage.value = '这个标题接口会失败但不该丢失标题'

    await app.sendMessage()

    await vi.waitFor(() => {
      expect(app.conversations.value[0]?.title).toBe('这个标题接口会失败但不该丢失标题')
    })
  })

  it('falls back to local title when generated title is empty', async () => {
    vi.mocked(hasUtools).mockReturnValue(true)
    vi.mocked(loadSettings).mockResolvedValue(createSettings({
      deepseek: {
        apiKey: 'sk-test',
      },
    }))
    vi.mocked(requestConversationTitle).mockResolvedValueOnce('   ')
    vi.mocked(streamChatCompletion).mockResolvedValue('流式回复')

    const app = useChatApp()
    await app.initialize()
    app.draftMessage.value = '标题返回空字符串时也应该有兜底'

    await app.sendMessage()

    await vi.waitFor(() => {
      expect(app.conversations.value[0]?.title).toBe('标题返回空字符串时也应该有兜底')
    })
  })

  it('updates the title when title generation resolves after the final conversation save', async () => {
    vi.mocked(hasUtools).mockReturnValue(true)
    vi.mocked(loadSettings).mockResolvedValue(createSettings({
      deepseek: {
        apiKey: 'sk-test',
      },
    }))
    vi.mocked(streamChatCompletion).mockResolvedValue('流式回复')

    const deferredTitle = createDeferred<string>()
    const revisionStore = createRevisionedDocStore()
    vi.mocked(requestConversationTitle).mockImplementation(() => deferredTitle.promise)
    vi.mocked(saveConversation).mockImplementation(async (conversation) => revisionStore.save(conversation))

    const app = useChatApp()
    await app.initialize()
    app.draftMessage.value = '这个标题会在回复结束后才返回'

    await app.sendMessage()

    expect(app.conversations.value[0]?.title).toBe('新对话')

    deferredTitle.resolve('延迟返回的标题')

    await vi.waitFor(() => {
      expect(app.conversations.value[0]?.title).toBe('延迟返回的标题')
    })
  })

  it('normalizes deepseek settings before saving them', async () => {
    const app = useChatApp()
    await app.initialize()

    app.updateDeepseekField('apiKey', '  sk-test  ')
    app.updateDeepseekField('baseUrl', '  https://api.deepseek.com/  ')
    app.updateDeepseekField('model', '  deepseek-chat  ')
    app.updateTheme('dark')

    await app.saveSettings()

    expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({
      activeConfigId: 'deepseek',
      deepseek: {
        apiKey: 'sk-test',
        baseUrl: 'https://api.deepseek.com/',
        model: 'deepseek-chat',
        temperature: 1,
      },
      theme: 'dark',
    }))
  })

  it('keeps deepseek and custom model settings isolated', async () => {
    const app = useChatApp()
    await app.initialize()

    app.updateDeepseekField('apiKey', 'sk-deepseek')
    app.addCustomModel('openai')

    const customId = app.settings.value.customModels[0]?.id
    expect(customId).toBeTruthy()

    app.updateCustomModelField(customId as string, 'apiKey', 'sk-openai')
    app.selectActiveConfig(customId as string)

    expect(app.settings.value.deepseek.apiKey).toBe('sk-deepseek')
    expect(app.settings.value.customModels[0]?.apiKey).toBe('sk-openai')
    expect(app.settings.value.activeConfigId).toBe(customId)
  })

  it('exposes deepseek model options for quick switching and updates the active model', async () => {
    const app = useChatApp()
    await app.initialize()

    expect(app.modelOptions.value.map((item) => item.value)).toEqual([
      'deepseek-chat',
      'deepseek-reasoner',
    ])

    app.selectActiveModel('deepseek-reasoner')

    expect(app.settings.value.deepseek.model).toBe('deepseek-reasoner')
  })

  it('blocks sending when the active custom model base url is blank', async () => {
    const customModel = createAddedModelDraft('custom', [])
    customModel.name = '自定义模型'
    customModel.apiKey = 'sk-test'
    customModel.baseUrl = '   '
    customModel.model = 'my-model'

    vi.mocked(loadSettings).mockResolvedValue(createSettings({
      activeConfigId: customModel.id,
      customModels: [customModel],
    }))

    const app = useChatApp()
    await app.initialize()
    app.draftMessage.value = '你好'

    await app.sendMessage()

    expect(app.lastError.value).toBe('请先在设置面板中填写 自定义模型 Base URL。')
    expect(app.isSettingsOpen.value).toBe(true)
    expect(streamChatCompletion).not.toHaveBeenCalled()
  })

  it('normalizes the active custom model before sending the request', async () => {
    const customModel = createAddedModelDraft('openai', [])
    customModel.name = 'OpenAI 自定义'
    customModel.apiKey = '  sk-openai  '
    customModel.baseUrl = '  https://api.openai.com/v1/  '
    customModel.model = '  gpt-4.1  '

    vi.mocked(loadSettings).mockResolvedValue(createSettings({
      activeConfigId: customModel.id,
      customModels: [customModel],
    }))
    vi.mocked(streamChatCompletion).mockResolvedValue('你好')

    const app = useChatApp()
    await app.initialize()
    app.draftMessage.value = '你好'

    await app.sendMessage()

    expect(streamChatCompletion).toHaveBeenCalledWith(
      expect.any(Array),
      {
        configId: customModel.id,
        label: 'OpenAI 自定义',
        provider: 'openai',
        apiKey: 'sk-openai',
        baseUrl: 'https://api.openai.com/v1/',
        model: 'gpt-4.1',
        temperature: 1,
      },
      expect.any(Function),
      expect.any(AbortSignal),
    )
  })

  it('exposes a visible error when saving settings fails', async () => {
    vi.mocked(saveSettings).mockRejectedValueOnce(new Error('设置保存失败。'))

    const app = useChatApp()
    await app.initialize()
    app.openSettings()

    await expect(app.saveSettings()).resolves.toBeUndefined()

    expect(app.isSavingSettings.value).toBe(false)
    expect(app.isSettingsOpen.value).toBe(true)
    expect(app.lastError.value).toBe('设置保存失败。')
  })

  it('releases sending state and exposes the error when the first conversation save fails', async () => {
    vi.mocked(loadSettings).mockResolvedValue(createSettings({
      deepseek: {
        apiKey: 'sk-test',
      },
    }))
    vi.mocked(saveConversation).mockRejectedValueOnce(new Error('uTools 数据库存储失败。'))

    const app = useChatApp()
    await app.initialize()
    app.draftMessage.value = '你好'

    await app.sendMessage()

    expect(app.isSending.value).toBe(false)
    expect(app.lastError.value).toBe('uTools 数据库存储失败。')
    expect(app.messages.value[1]?.status).toBe('error')
    expect(app.messages.value[1]?.content).toBe('请求失败：uTools 数据库存储失败。')
  })

  it('repairs persisted streaming messages when restoring a session', async () => {
    vi.mocked(hasUtools).mockReturnValue(true)
    vi.mocked(loadSession).mockResolvedValue({
      _id: 'session/runtime',
      type: 'session',
      currentConversationId: 'existing',
      lastOutAt: Date.now(),
    })
    vi.mocked(loadConversations).mockResolvedValue([
      {
        _id: 'conversation/existing',
        type: 'conversation',
        id: 'existing',
        title: '已有会话',
        createdAt: 1,
        updatedAt: 1,
        messages: [
          { id: 'm-user', role: 'user', content: '旧消息', createdAt: 1, status: 'done' },
          { id: 'm-assistant', role: 'assistant', content: '', createdAt: 2, status: 'streaming' },
        ],
      },
    ])

    const app = useChatApp()
    await app.initialize()

    expect(app.messages.value[1]?.status).toBe('interrupted')
    expect(app.messages.value[1]?.content).toBe('本次响应已中断，请重新发送。')
    expect(saveConversation).toHaveBeenCalled()
  })

  it('deletes the active conversation and clears the current session pointer', async () => {
    vi.mocked(loadConversations).mockResolvedValue([
      {
        _id: 'conversation/existing',
        type: 'conversation',
        id: 'existing',
        title: '已有会话',
        createdAt: 1,
        updatedAt: 1,
        messages: [
          { id: 'm-user', role: 'user', content: '旧消息', createdAt: 1, status: 'done' },
        ],
      },
    ])

    const app = useChatApp()
    await app.initialize()
    app.selectConversation('existing')
    await vi.waitFor(() => {
      expect(app.activeConversationId.value).toBe('existing')
    })

    await app.deleteConversation('existing')

    expect(deleteConversation).toHaveBeenCalled()
    expect(app.activeConversationId.value).toBeNull()
    expect(app.messages.value).toEqual([])
    expect(app.conversations.value).toEqual([])
  })

  it('marks the assistant message as interrupted when stop is triggered during streaming', async () => {
    vi.mocked(loadSettings).mockResolvedValue(createSettings({
      deepseek: {
        apiKey: 'sk-test',
      },
    }))

    vi.mocked(streamChatCompletion).mockImplementation(
      async (_messages, _settings, _onDelta, signal) =>
        new Promise((_resolve, reject) => {
          if (signal?.aborted) {
            reject(createAbortError())
            return
          }

          signal?.addEventListener('abort', () => {
            reject(createAbortError())
          })
        }),
    )

    const app = useChatApp()
    await app.initialize()
    app.draftMessage.value = '你好'

    const sending = app.sendMessage()
    await vi.waitFor(() => {
      expect(app.isSending.value).toBe(true)
    })

    await app.stopGenerating()
    await sending

    expect(app.isSending.value).toBe(false)
    expect(app.messages.value[1]?.status).toBe('interrupted')
    expect(app.messages.value[1]?.content).toBe('已停止生成。')
  })
})

function createSettings(
  overrides: Omit<Partial<SettingsForm>, 'deepseek'> & { deepseek?: Partial<ProviderSettings> } = {},
): SettingsForm {
  const settings = buildDefaultSettings()

  return {
    ...settings,
    ...overrides,
    customModels: overrides.customModels ?? settings.customModels,
    deepseek: {
      ...settings.deepseek,
      ...(overrides.deepseek ?? {}),
    },
  }
}

function createAbortError(): Error & { name: 'AbortError' } {
  const error = new Error('aborted') as Error & { name: 'AbortError' }
  error.name = 'AbortError'
  return error
}

function createDeferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
} {
  let resolve: (value: T) => void = () => undefined
  let reject: (reason?: unknown) => void = () => undefined
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return {
    promise,
    reject,
    resolve,
  }
}

function createRevisionedDocStore() {
  const docs = new Map<string, { _id: string; _rev?: string }>()

  return {
    async save<T extends { _id: string; _rev?: string }>(doc: T): Promise<T> {
      const current = docs.get(doc._id)
      if (current?._rev && doc._rev !== current._rev) {
        throw new Error(`stale revision for ${doc._id}`)
      }

      const nextRevision = `${readRevisionNumber(current?._rev) + 1}-mock`
      const saved = cloneSerializable({
        ...doc,
        _rev: nextRevision,
      }) as T
      docs.set(saved._id, saved)
      return cloneSerializable(saved)
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
