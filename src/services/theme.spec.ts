import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyAppearance } from './theme'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('applyAppearance', () => {
  it('applies both theme and font size to the document root', () => {
    const documentElement = {
      dataset: {} as Record<string, string>,
    }
    vi.stubGlobal('document', {
      documentElement,
    })

    applyAppearance({
      fontSize: 'large',
      theme: 'dark',
    })

    expect(documentElement.dataset.theme).toBe('dark')
    expect(documentElement.dataset.fontSize).toBe('large')
  })
})
