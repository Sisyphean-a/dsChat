import type { MemorySettings } from '../types/chat'

export const DEFAULT_MEMORY_SETTINGS: MemorySettings = {
  enabled: true,
  observeEveryTurns: 6,
}

export const MEMORY_OBSERVE_INTERVAL_OPTIONS = [3, 6, 12] as const

export function normalizeMemorySettings(incoming: Partial<MemorySettings> | undefined): MemorySettings {
  const enabled = typeof incoming?.enabled === 'boolean'
    ? incoming.enabled
    : DEFAULT_MEMORY_SETTINGS.enabled
  const interval = Number(incoming?.observeEveryTurns)
  return {
    enabled,
    observeEveryTurns: Number.isFinite(interval) && interval >= 1 && interval <= 50
      ? Math.round(interval)
      : DEFAULT_MEMORY_SETTINGS.observeEveryTurns,
  }
}
