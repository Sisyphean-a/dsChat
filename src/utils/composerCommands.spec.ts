import { describe, expect, it } from 'vitest'
import { resolveComposerCommand } from './composerCommands'

describe('resolveComposerCommand', () => {
  it('recognizes the /new command with surrounding whitespace', () => {
    expect(resolveComposerCommand('  /new  ')).toEqual({
      type: 'new-conversation',
    })
  })

  it('does not treat normal text as a command', () => {
    expect(resolveComposerCommand('/new topic')).toBeNull()
    expect(resolveComposerCommand('hello')).toBeNull()
  })
})
