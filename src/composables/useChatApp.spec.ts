import { describe, expect, it, vi } from 'vitest'

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
  saveConversation: vi.fn(),
  saveSession: vi.fn(),
  saveSettings: vi.fn(),
}))

import { useChatApp } from './useChatApp'

describe('useChatApp', () => {
  it('starts with a clean conversation when there is no history', async () => {
    const app = useChatApp()

    await app.initialize()

    expect(app.messages.value).toEqual([])
  })
})
