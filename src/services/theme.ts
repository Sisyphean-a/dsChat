import type { FontSizeMode, ThemeMode } from '../types/chat'

export function applyTheme(theme: ThemeMode): void {
  applyAppearance({
    fontSize: resolveCurrentFontSize(),
    theme,
  })
}

export function applyAppearance(appearance: {
  fontSize: FontSizeMode
  theme: ThemeMode
}): void {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.dataset.fontSize = appearance.fontSize
  document.documentElement.dataset.theme = appearance.theme
}

function resolveCurrentFontSize(): FontSizeMode {
  const current = document.documentElement.dataset.fontSize
  return current === 'large' || current === 'x-large' ? current : 'medium'
}
