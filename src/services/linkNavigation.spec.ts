// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeExternalLink, openExternalLink } from './linkNavigation'

describe('linkNavigation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete window.utools
  })

  it('normalizes relative and absolute http links', () => {
    expect(normalizeExternalLink('https://example.com/docs')).toBe('https://example.com/docs')
    expect(normalizeExternalLink('/help')).toContain('/help')
  })

  it('rejects unsafe protocols', () => {
    expect(normalizeExternalLink('javascript:alert(1)')).toBeNull()
    expect(normalizeExternalLink('data:text/plain,1')).toBeNull()
  })

  it('prefers utools external browser when available', () => {
    const shellOpenExternal = vi.fn()
    Object.defineProperty(window, 'utools', {
      configurable: true,
      value: {
        shellOpenExternal,
      },
    })
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    const opened = openExternalLink('https://example.com/news')

    expect(opened).toBe(true)
    expect(shellOpenExternal).toHaveBeenCalledWith('https://example.com/news')
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('falls back to opening a new browser tab when utools is unavailable', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => window)

    const opened = openExternalLink('https://example.com/news')

    expect(opened).toBe(true)
    expect(openSpy).toHaveBeenCalledWith('https://example.com/news', '_blank', 'noopener,noreferrer')
  })
})
