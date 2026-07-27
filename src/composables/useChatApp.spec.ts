import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PluginEnterPayload } from '../types/utools'
import { buildDefaultSettings } from '../constants/providers'

vi.mock('../services/utools', () => ({
  deleteConversation: vi.fn().mockResolvedValue(undefined),
  hasUtools: vi.fn(() => false),
  loadConversations: vi.fn().mockResolvedValue([]),
  loadSession: vi.fn().mockResolvedValue(null),
  loadSettings: vi.fn(),
  saveConversation: vi.fn(async (conversation) => conversation),
  saveSession: vi.fn().mockResolvedValue(undefined),
  saveSettings: vi.fn(),
}))

import { hasUtools, loadSettings } from '../services/utools'
import { useChatApp } from './useChatApp'

describe('useChatApp', () => {
  beforeEach(() => {
    vi.mocked(hasUtools).mockReturnValue(false)
    vi.mocked(loadSettings).mockResolvedValue(settings())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('wraps selected uTools text in a code block without sending it', async () => {
    vi.mocked(hasUtools).mockReturnValue(true)
    let handlePluginEnter: ((payload: PluginEnterPayload) => void | Promise<void>) | undefined
    vi.stubGlobal('window', {
      utools: {
        onPluginEnter: vi.fn((callback: (payload: PluginEnterPayload) => void | Promise<void>) => {
          handlePluginEnter = callback
        }),
        onPluginOut: vi.fn(),
      },
    })

    const app = useChatApp()
    await app.initialize()
    await handlePluginEnter?.({
      code: 'ask-ds',
      payload: 'const answer = 42',
      type: 'over',
    })

    expect(app.draftMessage.value).toBe('\n```\nconst answer = 42\n```')
    expect(app.composerFocusPosition.value).toBe('start')
    expect(app.messages.value).toEqual([])
    expect(app.isSending.value).toBe(false)
    expect(app.pluginEnterSignal.value).toBe(1)
  })

  it('keeps the send action while consuming the Provider stream', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { stream?: boolean }
      if (!body.stream) {
        return new Response(JSON.stringify({ choices: [{ message: { content: '自动标题' } }] }), { status: 200 })
      }
      return new Response('data: {"choices":[{"delta":{"content":"你好，我在。"}}]}\n\ndata: [DONE]\n\n', { status: 200 })
    }))

    const app = useChatApp()
    await app.initialize()
    app.draftMessage.value = '你好'
    await app.sendMessage()

    expect(app.lastError.value).toBeNull()
    expect(app.messages.value).toEqual([
      expect.objectContaining({ content: '你好', role: 'user', status: 'done' }),
      expect.objectContaining({ content: '你好，我在。', role: 'assistant', status: 'done' }),
    ])
  })
})

function settings() {
  const value = buildDefaultSettings()
  return {
    ...value,
    deepseek: { ...value.deepseek, apiKey: 'sk-test' },
  }
}
