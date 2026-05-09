import { describe, expect, it, vi } from 'vitest'
import { highlightCodeBlocks, renderMarkdown } from './markdown'

describe('markdown highlighting', () => {
  it('highlights javascript fences with token classes', async () => {
    const container = document.createElement('div')
    container.innerHTML = renderMarkdown([
      '```js',
      'const answer = 42',
      '```',
    ].join('\n'))

    await highlightCodeBlocks(container)

    const code = container.querySelector('code')
    expect(code?.className).toContain('hljs')
    expect(code?.innerHTML).toContain('hljs-keyword')
  })

  it('highlights bash aliases without requiring the full bundle up front', async () => {
    const container = document.createElement('div')
    container.innerHTML = renderMarkdown([
      '```sh',
      'echo "hello"',
      '```',
    ].join('\n'))

    await highlightCodeBlocks(container)

    const code = container.querySelector('code')
    expect(code?.className).toContain('hljs')
    expect(code?.innerHTML).toContain('hljs-built_in')
  })

  it('injects a copy button and updates feedback state after copy succeeds', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    const container = document.createElement('div')
    container.innerHTML = renderMarkdown([
      '```ts',
      'const a = 1',
      '```',
    ].join('\n'))

    await highlightCodeBlocks(container)
    await highlightCodeBlocks(container)

    const buttons = container.querySelectorAll<HTMLButtonElement>('pre .code-copy-button')
    expect(buttons).toHaveLength(1)

    const button = buttons[0]
    button.click()
    await new Promise((resolve) => window.setTimeout(resolve, 0))

    expect(writeText).toHaveBeenCalledWith('const a = 1')
    expect(button.dataset.copyState).toBe('success')
    expect(button.textContent).toBe('已复制')
  })

  it('shows error feedback when clipboard write is rejected', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const writeText = vi.fn(async () => {
      throw new Error('denied')
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    const container = document.createElement('div')
    container.innerHTML = renderMarkdown([
      '```python',
      'print(123)',
      '```',
    ].join('\n'))

    await highlightCodeBlocks(container)

    const button = container.querySelector<HTMLButtonElement>('pre .code-copy-button')
    expect(button).toBeTruthy()

    button?.click()
    await new Promise((resolve) => window.setTimeout(resolve, 0))

    expect(button?.dataset.copyState).toBe('error')
    expect(button?.textContent).toBe('复制失败')
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('decorates markdown links with secure external attributes', () => {
    const html = renderMarkdown('[OpenAI](https://openai.com)')
    const container = document.createElement('div')
    container.innerHTML = html

    const link = container.querySelector('a')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toContain('noopener')
    expect(link?.getAttribute('rel')).toContain('noreferrer')
  })
})
