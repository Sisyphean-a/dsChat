import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../services/deepseek', () => ({
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
  loadSettings: vi.fn().mockResolvedValue({
    apiKey: '',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    temperature: 1,
    theme: 'light',
  }),
  saveConversation: vi.fn(async (conversation) => conversation),
  saveSession: vi.fn().mockResolvedValue(undefined),
  saveSettings: vi.fn(),
}))

import { streamChatCompletion } from '../services/deepseek'
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
    vi.mocked(loadSettings).mockResolvedValue({
      apiKey: '',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      temperature: 1,
      theme: 'light',
    })
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

  it('persists a valid message flow without crashing', async () => {
    vi.mocked(loadSettings).mockResolvedValue({
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      temperature: 1,
      theme: 'light',
    })
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

  it('stores reasoning content when the model streams thinking output', async () => {
    vi.mocked(loadSettings).mockResolvedValue({
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-reasoner',
      temperature: 1,
      theme: 'light',
    })
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
    vi.mocked(loadSettings).mockResolvedValue({
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      temperature: 1,
      theme: 'light',
    })

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
          apiKey: 'sk-test',
          baseUrl: 'https://api.deepseek.com',
          model: 'deepseek-chat',
          temperature: 1,
          theme: 'light',
        },
        '给这段对话起标题',
      )
    })

    expect(app.conversations.value[0]?.title).toBe('自动标题')

    resolveReply('流式回复')
    await sendPromise
  })

  it('normalizes settings before saving them', async () => {
    const app = useChatApp()
    await app.initialize()

    app.updateSettingsField('apiKey', '  sk-test  ')
    app.updateSettingsField('baseUrl', '  https://api.deepseek.com/  ')
    app.updateSettingsField('model', '  deepseek-chat  ')
    app.updateSettingsField('temperature', 1.36)
    app.updateSettingsField('theme', 'dark')

    await app.saveSettings()

    expect(saveSettings).toHaveBeenCalledWith({
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com/',
      model: 'deepseek-chat',
      temperature: 1.4,
      theme: 'dark',
    })
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

  it('blocks sending when base url is blank', async () => {
    vi.mocked(loadSettings).mockResolvedValue({
      apiKey: 'sk-test',
      baseUrl: '   ',
      model: 'deepseek-chat',
      temperature: 1,
      theme: 'light',
    })

    const app = useChatApp()
    await app.initialize()
    app.draftMessage.value = '你好'

    await app.sendMessage()

    expect(app.lastError.value).toBe('请先在设置面板中填写 DeepSeek Base URL。')
    expect(app.isSettingsOpen.value).toBe(true)
    expect(app.messages.value).toEqual([])
    expect(streamChatCompletion).not.toHaveBeenCalled()
  })

  it('normalizes settings before sending the request', async () => {
    vi.mocked(loadSettings).mockResolvedValue({
      apiKey: '  sk-test  ',
      baseUrl: '  https://api.deepseek.com/  ',
      model: '  deepseek-chat  ',
      temperature: 1.3,
      theme: 'light',
    })
    vi.mocked(streamChatCompletion).mockResolvedValue('你好')

    const app = useChatApp()
    await app.initialize()
    app.draftMessage.value = '你好'

    await app.sendMessage()

    expect(streamChatCompletion).toHaveBeenCalledWith(
      expect.any(Array),
      {
        apiKey: 'sk-test',
        baseUrl: 'https://api.deepseek.com/',
        model: 'deepseek-chat',
        temperature: 1.3,
        theme: 'light',
      },
      expect.any(Function),
      expect.any(AbortSignal),
    )
  })

  it('blocks sending when model is blank', async () => {
    vi.mocked(loadSettings).mockResolvedValue({
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com',
      model: '   ',
      temperature: 1,
      theme: 'light',
    })

    const app = useChatApp()
    await app.initialize()
    app.draftMessage.value = '你好'

    await app.sendMessage()

    expect(app.lastError.value).toBe('请先在设置面板中选择 DeepSeek 模型。')
    expect(app.isSettingsOpen.value).toBe(true)
    expect(app.messages.value).toEqual([])
    expect(streamChatCompletion).not.toHaveBeenCalled()
  })

  it('releases sending state and exposes the error when the first conversation save fails', async () => {
    vi.mocked(loadSettings).mockResolvedValue({
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      temperature: 1,
      theme: 'light',
    })
    vi.mocked(saveConversation).mockRejectedValueOnce(new Error('uTools 数据库存储失败。'))

    const app = useChatApp()
    await app.initialize()
    app.draftMessage.value = '你好'

    await app.sendMessage()

    expect(app.isSending.value).toBe(false)
    expect(app.lastError.value).toBe('uTools 数据库存储失败。')
    expect(app.messages.value).toHaveLength(2)
    expect(app.messages.value[1]?.status).toBe('error')
    expect(app.messages.value[1]?.content).toBe('请求失败：uTools 数据库存储失败。')
  })

  it('keeps sendMessage resolved and exposes persistence failure when saving the error state fails', async () => {
    vi.mocked(loadSettings).mockResolvedValue({
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      temperature: 1,
      theme: 'light',
    })
    vi.mocked(streamChatCompletion).mockRejectedValueOnce(new Error('流式响应中断。'))
    vi.mocked(saveConversation)
      .mockImplementationOnce(async (conversation) => conversation)
      .mockRejectedValueOnce(new Error('uTools 数据库存储失败。'))

    const app = useChatApp()
    await app.initialize()
    app.draftMessage.value = '你好'

    await expect(app.sendMessage()).resolves.toBeUndefined()

    expect(app.isSending.value).toBe(false)
    expect(app.lastError.value).toBe('请求失败后写入会话记录失败：uTools 数据库存储失败。')
    expect(app.messages.value).toHaveLength(2)
    expect(app.messages.value[1]?.status).toBe('error')
    expect(app.messages.value[1]?.content).toBe('请求失败：流式响应中断。')
  })

  it('keeps the active conversation locked while a reply is streaming', async () => {
    vi.mocked(loadSettings).mockResolvedValue({
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      temperature: 1,
      theme: 'light',
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
          { id: 'm-existing', role: 'user', content: '旧消息', createdAt: 1, status: 'done' },
        ],
      },
    ])

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
    app.draftMessage.value = '新问题'

    const sendPromise = app.sendMessage()
    await vi.waitFor(() => {
      expect(streamChatCompletion).toHaveBeenCalledTimes(1)
    })
    const lockedConversationId = app.activeConversationId.value
    const lockedMessages = app.messages.value.map((message) => message.id)

    app.selectConversation('existing')
    app.startFreshConversation()

    expect(app.activeConversationId.value).toBe(lockedConversationId)
    expect(app.messages.value.map((message) => message.id)).toEqual(lockedMessages)

    resolveReply('流式回复')
    await sendPromise
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

  it('stops the current response without surfacing an error', async () => {
    vi.mocked(loadSettings).mockResolvedValue({
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      temperature: 1,
      theme: 'light',
    })

    let rejectReply: (reason?: unknown) => void = () => {
      throw new Error('流式回调未建立。')
    }
    vi.mocked(streamChatCompletion).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectReply = reject
        }),
    )

    const app = useChatApp()
    await app.initialize()
    app.draftMessage.value = '停一下'

    const sendPromise = app.sendMessage()
    await vi.waitFor(() => {
      expect(streamChatCompletion).toHaveBeenCalledTimes(1)
    })

    const stopPromise = app.stopGenerating()
    rejectReply(new DOMException('Aborted', 'AbortError'))
    await Promise.all([stopPromise, sendPromise])

    expect(app.lastError.value).toBeNull()
    expect(app.isSending.value).toBe(false)
    expect(app.messages.value[1]?.status).toBe('interrupted')
  })
})
