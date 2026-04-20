import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../services/deepseek', () => ({
  streamChatCompletion: vi.fn(),
}))

vi.mock('../services/utools', () => ({
  hasUtools: () => false,
  loadConversations: vi.fn().mockResolvedValue([]),
  loadSession: vi.fn().mockResolvedValue(null),
  loadSettings: vi.fn().mockResolvedValue({
    apiKey: '',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  }),
  saveConversation: vi.fn(async (conversation) => conversation),
  saveSession: vi.fn().mockResolvedValue(undefined),
  saveSettings: vi.fn(),
}))

import { streamChatCompletion } from '../services/deepseek'
import { loadConversations, loadSettings, saveConversation, saveSettings } from '../services/utools'
import { useChatApp } from './useChatApp'

describe('useChatApp', () => {
  beforeEach(() => {
    vi.mocked(loadConversations).mockResolvedValue([])
    vi.mocked(loadSettings).mockResolvedValue({
      apiKey: '',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
    })
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
    })
    vi.mocked(streamChatCompletion).mockImplementation(async (_messages, _settings, onDelta) => {
      onDelta('你好，我在。')
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

  it('normalizes settings before saving them', async () => {
    const app = useChatApp()
    await app.initialize()

    app.updateSettingsField('apiKey', '  sk-test  ')
    app.updateSettingsField('baseUrl', '  https://api.deepseek.com/  ')
    app.updateSettingsField('model', '  deepseek-chat  ')

    await app.saveSettings()

    expect(saveSettings).toHaveBeenCalledWith({
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com/',
      model: 'deepseek-chat',
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
      },
      expect.any(Function),
    )
  })

  it('blocks sending when model is blank', async () => {
    vi.mocked(loadSettings).mockResolvedValue({
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com',
      model: '   ',
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
})
