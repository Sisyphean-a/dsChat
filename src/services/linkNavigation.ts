const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

export function normalizeExternalLink(href: string): string | null {
  const raw = href.trim()
  if (!raw) {
    return null
  }

  try {
    const base = typeof window !== 'undefined' ? window.location.href : 'https://localhost/'
    const url = new URL(raw, base)
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}

export function openExternalLink(href: string): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const normalized = normalizeExternalLink(href)
  if (!normalized) {
    return false
  }

  if (typeof window.utools?.shellOpenExternal === 'function') {
    window.utools.shellOpenExternal(normalized)
    return true
  }

  const opened = window.open(normalized, '_blank', 'noopener,noreferrer')
  return opened !== null
}
