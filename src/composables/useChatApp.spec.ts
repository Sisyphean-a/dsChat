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
import { loadSettings, saveSettings } from '../services/utools'
import { useChatApp } from './useChatApp'

describe('useChatApp', () => {
  beforeEach(() => {
    vi.mocked(loadSettings).mockResolvedValue({
      apiKey: '',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
    })
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
})
