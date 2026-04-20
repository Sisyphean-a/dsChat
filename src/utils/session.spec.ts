import { describe, expect, it } from 'vitest'
import { shouldResetConversation } from './session'

describe('shouldResetConversation', () => {
  it('keeps current conversation within timeout', () => {
    expect(shouldResetConversation(1_000, 60_000, 60_000)).toBe(false)
  })

  it('resets current conversation after timeout', () => {
    expect(shouldResetConversation(1_000, 61_001, 60_000)).toBe(true)
  })

  it('keeps first launch untouched when there is no timestamp', () => {
    expect(shouldResetConversation(null, 61_001, 60_000)).toBe(false)
  })
})
