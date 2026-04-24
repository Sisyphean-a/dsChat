import { describe, expect, it } from 'vitest'
import { applyAppearance } from './theme'

describe('applyAppearance', () => {
  it('applies both theme and font size to the document root', () => {
    applyAppearance({
      fontSize: 'large',
      theme: 'dark',
    })

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.dataset.fontSize).toBe('large')
  })
})
