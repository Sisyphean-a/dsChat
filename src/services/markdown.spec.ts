// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
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
})
