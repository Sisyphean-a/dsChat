import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MessageBubble from './MessageBubble.vue'

describe('MessageBubble', () => {
  it('shows an inline retry action for a retryable assistant failure', async () => {
    const wrapper = mount(MessageBubble, {
      props: {
        canRetry: true,
        message: {
          id: 'assistant-error',
          content: '请求失败：Failed to fetch',
          createdAt: 1,
          role: 'assistant',
          status: 'error',
        },
      },
    })

    const retryButton = wrapper.get('[data-testid="message-retry-button"]')
    expect(retryButton.text()).toBe('重试')

    await retryButton.trigger('click')

    expect(wrapper.emitted('retry')).toEqual([[]])
  })
})
