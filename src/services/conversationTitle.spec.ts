import { describe, expect, it, vi } from 'vitest'
import { buildDefaultSettings } from '../constants/providers'
import type { ActiveProviderSettings } from '../types/chat'
import { createConversationTitleRequester } from './conversationTitle'

const settings: ActiveProviderSettings = {
  ...buildDefaultSettings().deepseek,
  configId: 'deepseek',
  label: 'DeepSeek',
  provider: 'deepseek',
}

describe('conversation title requester', () => {
  it('summarizes an image question from its text instead of accepting a refusal', async () => {
    const complete = vi.fn(async () => '您没有提供具体内容，请把需要总结的文字发给我')
    const requester = createConversationTitleRequester({ complete })

    await expect(requester.request(settings, {
      content: '这个图片是哪个地区的？',
      hasAttachments: true,
    })).resolves.toBe('这个图片是哪个地区的')

    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      messages: [{
        content: expect.stringContaining('用户消息附带图片'),
        role: 'user',
      }],
    }))
  })

  it('uses an image title when the first message contains only an attachment', async () => {
    const requester = createConversationTitleRequester({
      complete: vi.fn(async () => '请提供需要总结的内容'),
    })

    await expect(requester.request(settings, {
      content: '',
      hasAttachments: true,
    })).resolves.toBe('图片分析')
  })

  it('keeps a valid generated title', async () => {
    const requester = createConversationTitleRequester({
      complete: vi.fn(async () => '地区识别') ,
    })

    await expect(requester.request(settings, {
      content: '请判断这张图片属于哪个地区',
      hasAttachments: true,
    })).resolves.toBe('地区识别')
  })
})
