import { describe, expect, it } from 'vitest'
import { formatAskDsDraft } from './askDsPayload'

describe('formatAskDsDraft', () => {
  it('wraps selected text in a code block and keeps the first line free', () => {
    expect(formatAskDsDraft({ code: 'ask-ds', payload: 'const answer = 42', type: 'over' }))
      .toBe('\n```\nconst answer = 42\n```')
  })

  it('keeps the original text formatting inside the code block', () => {
    expect(formatAskDsDraft({ code: 'ask-ds', payload: '  line one\nline two  ' }))
      .toBe('\n```\n  line one\nline two  \n```')
  })

  it('ignores other entry commands, non-string payloads and blank text', () => {
    expect(formatAskDsDraft({ code: 'other', payload: 'text' })).toBeNull()
    expect(formatAskDsDraft({ code: 'ask-ds', payload: { text: 'text' } })).toBeNull()
    expect(formatAskDsDraft({ code: 'ask-ds', payload: '   ' })).toBeNull()
    expect(formatAskDsDraft(null)).toBeNull()
  })
})
