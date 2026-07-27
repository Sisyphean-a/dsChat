import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AssistantMessageContent from './AssistantMessageContent.vue'
import { openExternalLink } from '../services/linkNavigation'

vi.mock('../services/linkNavigation', () => ({
  openExternalLink: vi.fn(() => true),
}))

describe('AssistantMessageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('applies syntax highlight and copy button for static code content on initial render', async () => {
    const wrapper = mount(AssistantMessageContent, {
      props: {
        content: [
          '```ts',
          'const value = 42',
          '```',
        ].join('\n'),
      },
    })

    await waitForHighlight(wrapper)

    const code = wrapper.find('pre code')
    const copyButton = wrapper.find('.code-block-shell > .code-copy-button')

    expect(code.exists()).toBe(true)
    expect(code.classes()).toContain('hljs')
    expect(copyButton.exists()).toBe(true)
  })

  it('limits Markdown re-rendering during streamed text while flushing the final content', async () => {
    vi.useFakeTimers()
    const wrapper = mount(AssistantMessageContent, {
      props: {
        content: '第一段',
        revealActive: true,
      },
    })

    await wrapper.setProps({ content: '第一段继续生成' })
    expect(wrapper.text()).toContain('第一段')
    expect(wrapper.text()).not.toContain('继续生成')

    vi.advanceTimersByTime(48)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('第一段继续生成')

    await wrapper.setProps({ revealActive: false, content: '最终内容' })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('最终内容')
  })

  it('delegates markdown link click to external link opener', async () => {
    const wrapper = mount(AssistantMessageContent, {
      props: {
        content: '[文档链接](https://example.com/docs)',
      },
    })

    await wrapper.find('a').trigger('click')

    expect(openExternalLink).toHaveBeenCalledWith('https://example.com/docs')
  })

})

async function waitForHighlight(
  wrapper: { find: (selector: string) => { classes: () => string[]; exists: () => boolean } },
): Promise<void> {
  const maxAttempts = 20
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = wrapper.find('pre code')
    const copyButton = wrapper.find('.code-block-shell > .code-copy-button')
    if (code.classes().includes('hljs') && copyButton.exists()) {
      return
    }

    await new Promise((resolve) => window.setTimeout(resolve, 20))
  }
}
