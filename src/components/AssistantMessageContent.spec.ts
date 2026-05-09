import { beforeEach, describe, expect, it, vi } from 'vitest'
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
    const copyButton = wrapper.find('pre .code-copy-button')

    expect(code.exists()).toBe(true)
    expect(code.classes()).toContain('hljs')
    expect(copyButton.exists()).toBe(true)
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

  it('uses per-block rhythm instead of a shared segment gap', () => {
    const wrapper = mount(AssistantMessageContent, {
      props: {
        content: [
          '第一段。',
          '',
          '```ts',
          'const value = 42',
          '```',
          '',
          '第二段。',
        ].join('\n'),
      },
    })

    const container = wrapper.get('.message-rich-content').element as HTMLElement

    expect(container.style.gap).toBe('0px')
    expect(container.style.getPropertyValue('--message-flow-space-compact')).toBe('12px')
    expect(container.style.getPropertyValue('--message-flow-space-block')).toBe('16px')
    expect(container.style.getPropertyValue('--message-flow-space-divider')).toBe('16px')
    expect(container.style.getPropertyValue('--message-flow-space-section')).toBe('18px')
  })
})

async function waitForHighlight(
  wrapper: { find: (selector: string) => { classes: () => string[]; exists: () => boolean } },
): Promise<void> {
  const maxAttempts = 20
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = wrapper.find('pre code')
    const copyButton = wrapper.find('pre .code-copy-button')
    if (code.classes().includes('hljs') && copyButton.exists()) {
      return
    }

    await new Promise((resolve) => window.setTimeout(resolve, 20))
  }
}
