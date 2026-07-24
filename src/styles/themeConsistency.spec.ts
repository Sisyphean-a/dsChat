import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const composerStyles = readFileSync(new URL('./chat-composer.css', import.meta.url), 'utf8')

describe('homepage theme styles', () => {
  it('derives composer colors from the shared theme tokens', () => {
    expect(composerStyles).toContain('background: var(--accent);')
    expect(composerStyles).toContain('background: var(--accent-soft);')
    expect(composerStyles).not.toMatch(/#(?:7c3aed|6d28d9|4b4b6e|adadbe|e4e4ef)/i)
    expect(composerStyles).not.toMatch(/rgba?\(\s*(?:124\s*,\s*58\s*,\s*237|139\s*,\s*92\s*,\s*246)/i)
  })
})
