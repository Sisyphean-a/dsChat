import type {
  MemoryEvent,
  MemoryState,
  MemoryStorageKind,
} from '../../types/memory'

const EVENTS_FILE = 'memory/events.jsonl'
const STATE_FILE = 'memory/state.json'
const BACKUP_DIR = 'memory/backup'
const LOCAL_PREFIX = 'dsChat/memory/'

export interface MemoryStorage {
  kind: MemoryStorageKind
  location: string
  readEvents(): Promise<MemoryEvent[]>
  appendEvent(event: MemoryEvent): Promise<void>
  readState(): Promise<MemoryState | null>
  writeState(state: MemoryState): Promise<void>
  backup(state: MemoryState): Promise<void>
}

/**
 * Flow: 优先使用 preload 暴露的插件本地数据目录；浏览器预览降级到 localStorage；最后退回内存。
 * Rule: 存储层只负责读写，不判断记忆语义；任何读取失败都按"暂无数据"返回，由上层展示存储状态。
 */
export function createMemoryStorage(): MemoryStorage {
  const bridge = typeof window !== 'undefined' ? window.dsChatMemory : undefined
  if (bridge) {
    return createFileStorage(bridge)
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    return createLocalStorageStorage()
  }
  return createMemoryStorageFallback()
}

function createFileStorage(bridge: NonNullable<Window['dsChatMemory']>): MemoryStorage {
  return {
    kind: 'file',
    location: bridge.rootDir,
    async readEvents() {
      return parseEventLines(bridge.readText(EVENTS_FILE) ?? '')
    },
    async appendEvent(event) {
      const ok = bridge.appendText(EVENTS_FILE, `${JSON.stringify(event)}\n`)
      if (!ok) {
        throw new Error('记忆事件写入本地文件失败。')
      }
    },
    async readState() {
      return parseState(bridge.readText(STATE_FILE))
    },
    async writeState(state) {
      const ok = bridge.writeText(STATE_FILE, JSON.stringify(state))
      if (!ok) {
        throw new Error('记忆状态写入本地文件失败。')
      }
    },
    async backup(state) {
      const date = new Date(state.updatedAt || Date.now()).toISOString().slice(0, 10)
      bridge.writeText(`${BACKUP_DIR}/state-${date}.json`, JSON.stringify(state))
    },
  }
}

function createLocalStorageStorage(): MemoryStorage {
  return {
    kind: 'localStorage',
    location: '浏览器 localStorage',
    async readEvents() {
      return parseEventLines(window.localStorage.getItem(`${LOCAL_PREFIX}events`) ?? '')
    },
    async appendEvent(event) {
      const key = `${LOCAL_PREFIX}events`
      const current = window.localStorage.getItem(key) ?? ''
      window.localStorage.setItem(key, `${current}${JSON.stringify(event)}\n`)
    },
    async readState() {
      return parseState(window.localStorage.getItem(`${LOCAL_PREFIX}state`))
    },
    async writeState(state) {
      window.localStorage.setItem(`${LOCAL_PREFIX}state`, JSON.stringify(state))
    },
    async backup(state) {
      const date = new Date(state.updatedAt || Date.now()).toISOString().slice(0, 10)
      window.localStorage.setItem(`${LOCAL_PREFIX}backup-${date}`, JSON.stringify(state))
    },
  }
}

function createMemoryStorageFallback(): MemoryStorage {
  let events = ''
  let state: string | null = null
  return {
    kind: 'memory',
    location: '内存（临时）',
    async readEvents() {
      return parseEventLines(events)
    },
    async appendEvent(event) {
      events += `${JSON.stringify(event)}\n`
    },
    async readState() {
      return parseState(state)
    },
    async writeState(next) {
      state = JSON.stringify(next)
    },
    async backup() {
      // 内存存储不保留备份。
    },
  }
}

export function parseEventLines(raw: string): MemoryEvent[] {
  const events: MemoryEvent[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const parsed = JSON.parse(trimmed) as MemoryEvent
      if (isMemoryEvent(parsed)) events.push(parsed)
    } catch {
      // 单行损坏不影响其余事件；追加日志保持只增不改。
    }
  }
  return events
}

function parseState(raw: string | null): MemoryState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as MemoryState
    if (!parsed || !Array.isArray(parsed.facts)) return null
    return {
      version: Number(parsed.version) || 1,
      facts: parsed.facts,
      lastEventId: typeof parsed.lastEventId === 'string' ? parsed.lastEventId : null,
      updatedAt: Number(parsed.updatedAt) || 0,
      observed: isRecord(parsed.observed) ? parsed.observed as Record<string, string> : {},
    }
  } catch {
    return null
  }
}

function isMemoryEvent(value: MemoryEvent): boolean {
  return Boolean(value)
    && typeof value.id === 'string'
    && typeof value.op === 'string'
    && typeof value.at === 'number'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
