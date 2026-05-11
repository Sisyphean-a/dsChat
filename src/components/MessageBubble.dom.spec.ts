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

    const retryButton = wrapper.get('[data-testid="message-regenerate-button"]')
    expect(retryButton.attributes('aria-label')).toBe('重试')

    await retryButton.trigger('click')

    expect(wrapper.emitted('retry')).toEqual([[]])
  })

  it('shows copy action for user messages', () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: {
          id: 'user-copy',
          content: '你好，世界',
          createdAt: 1,
          role: 'user',
          status: 'done',
        },
      },
    })

    expect(wrapper.find('[data-testid="message-copy-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="message-regenerate-button"]').exists()).toBe(false)
  })

  it('shows copy and regenerate actions for latest assistant response', () => {
    const wrapper = mount(MessageBubble, {
      props: {
        canRetry: true,
        message: {
          id: 'assistant-done',
          content: '这是完整回答',
          createdAt: 2,
          role: 'assistant',
          status: 'done',
        },
      },
    })

    expect(wrapper.find('[data-testid="message-copy-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="message-regenerate-button"]').exists()).toBe(true)
  })

  it('renders unified process timeline collapsed by default and expands on toggle', async () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: {
          id: 'assistant-with-tools',
          content: '这是最终回答。',
          createdAt: 2,
          role: 'assistant',
          status: 'done',
          processTimeline: [
            {
              id: 'p-1',
              type: 'tool',
              text: '查询条件：关键词“AI 新闻”，时间范围 day；结果条数：5',
              status: 'done',
              round: 1,
              durationMs: 320,
            },
          ],
        },
      },
    })

    expect(wrapper.text()).toContain('过程（1）')
    expect(wrapper.find('.process-panel').classes()).not.toContain('expanded')

    await wrapper.get('.process-toggle').trigger('click')

    expect(wrapper.find('.process-panel').classes()).toContain('expanded')
    expect(wrapper.text()).toContain('查询条件：关键词“AI 新闻”，时间范围 day；结果条数：5')
  })

  it('auto-collapses process timeline when streaming finishes', async () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: {
          id: 'assistant-streaming-process',
          content: '',
          createdAt: 3,
          role: 'assistant',
          status: 'streaming',
          processTimeline: [
            {
              id: 'p-running',
              type: 'tool',
              text: '查询条件：关键词“AI”',
              status: 'running',
              round: 1,
            },
          ],
        },
      },
    })

    expect(wrapper.find('.process-panel').classes()).toContain('expanded')

    await wrapper.setProps({
      message: {
        id: 'assistant-streaming-process',
        content: '最终回答',
        createdAt: 3,
        role: 'assistant',
        status: 'done',
        processTimeline: [
          {
            id: 'p-running',
            type: 'tool',
            text: '查询条件：关键词“AI”；结果条数：5',
            status: 'done',
            round: 1,
          },
        ],
      },
    })

    expect(wrapper.find('.process-panel').classes()).not.toContain('expanded')
  })
})
