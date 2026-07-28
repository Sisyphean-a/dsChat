import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MessageBubble from './MessageBubble.vue'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

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

    expect(wrapper.find('[data-testid="message-row"]').exists()).toBe(true)
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

  it('keeps image preview focus contained and restores it after Escape', async () => {
    const wrapper = mount(MessageBubble, {
      attachTo: document.body,
      props: {
        message: {
          id: 'user-image',
          content: '',
          createdAt: 1,
          role: 'user',
          status: 'done',
          attachments: [{
            id: 'img-1',
            type: 'image',
            name: 'preview.png',
            mimeType: 'image/png',
            size: 128,
            width: 100,
            height: 80,
            dataUrl: 'data:image/png;base64,xxx',
          }],
        },
      },
    })
    const trigger = wrapper.get('.message-image-button')
    ;(trigger.element as HTMLButtonElement).focus()

    await trigger.trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(document.activeElement).toBe(wrapper.get('.image-preview-close').element)
    expect(wrapper.get('.image-preview-details').text()).toBe('100 × 80')

    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })

  it('switches the copy action to success feedback after copying', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mount(MessageBubble, {
      props: {
        message: {
          id: 'assistant-copy-feedback',
          content: '这是完整回答',
          createdAt: 2,
          role: 'assistant',
          status: 'done',
        },
      },
    })

    const copyButton = wrapper.get('[data-testid="message-copy-button"]')

    await copyButton.trigger('click')
    await Promise.resolve()

    expect(writeText).toHaveBeenCalledWith('这是完整回答')
    expect(copyButton.attributes('aria-label')).toBe('已复制')
    expect(copyButton.attributes('data-copy-state')).toBe('success')
    expect(copyButton.find('[data-testid="message-copy-success-icon"]').exists()).toBe(true)

    vi.advanceTimersByTime(1400)
    await wrapper.vm.$nextTick()

    expect(copyButton.attributes('aria-label')).toBe('复制')
    expect(copyButton.attributes('data-copy-state')).toBe('idle')
  })

  it('collapses long user messages by default and expands on demand', async () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: {
          id: 'user-long',
          content: `${'这是一段很长的代码说明。\n'.repeat(8)}const answer = 42`,
          createdAt: 1,
          role: 'user',
          status: 'done',
        },
      },
    })

    const collapseButton = wrapper.get('[data-testid="message-collapse-toggle"]')

    expect(wrapper.find('.plain-body-shell').classes()).toContain('is-collapsed')

    await collapseButton.trigger('click')

    expect(wrapper.find('.plain-body-shell').classes()).not.toContain('is-collapsed')
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
