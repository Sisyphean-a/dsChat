import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AssistantMessageContent from './AssistantMessageContent.vue'

describe('AssistantMessageContent', () => {
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
