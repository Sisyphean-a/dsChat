import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const STYLE_FILES = [
  'src/components/AssistantMessageContent.vue',
  'src/styles/app-shell.css',
  'src/styles/message-bubble.css',
  'src/styles/settings-panel.css',
]

describe('CSS compatibility baseline', () => {
  it('does not use color-mix to avoid old WebView computed-value invalidation', () => {
    for (const relativePath of STYLE_FILES) {
      const content = readFileSync(resolve(process.cwd(), relativePath), 'utf8')
      expect(content.includes('color-mix('), `${relativePath} 不应包含 color-mix`).toBe(false)
    }
  })
})
