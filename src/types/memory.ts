import type { MemorySettings } from './chat'

export type MemoryKind = 'profile' | 'preference' | 'background' | 'instruction'

export type MemoryEventOp = 'observe' | 'pin' | 'unpin' | 'forget'

/** 抽取结果：尚未进入记忆库的候选事实。 */
export interface MemoryCandidate {
  kind: MemoryKind
  subject: string
  text: string
  tags: string[]
  importance: number
  confidence: number
}

/** 追加日志中的一条事件；事件不可变，事实视图由全部事件投影得到。 */
export interface MemoryEvent {
  id: string
  op: MemoryEventOp
  at: number
  conversationId: string | null
  messageIds: string[]
  candidates?: MemoryCandidate[]
  targetId?: string
}

/** 当前记忆视图中的一条事实。validTo 非空表示已被取代或遗忘。 */
export interface MemoryFact {
  id: string
  kind: MemoryKind
  subject: string
  text: string
  tags: string[]
  importance: number
  confidence: number
  sourceConversationId: string | null
  sourceMessageIds: string[]
  createdAt: number
  updatedAt: number
  validFrom: number
  validTo: number | null
  supersededBy: string | null
  forgotten: boolean
  pinned: boolean
  lastUsedAt: number
  useCount: number
}

export interface MemoryState {
  version: number
  facts: MemoryFact[]
  lastEventId: string | null
  updatedAt: number
  /** 每个会话已观察到的最后一条消息，用于避免重复抽取。 */
  observed: Record<string, string>
}

/** preload.js 暴露给渲染进程的本地文件桥。 */
export interface MemoryFileBridge {
  rootDir: string
  readText(relativePath: string): string | null
  writeText(relativePath: string, text: string): boolean
  appendText(relativePath: string, text: string): boolean
  listFiles(relativeDir: string): string[]
}

export type MemoryStorageKind = 'file' | 'localStorage' | 'memory'

export interface MemoryStatus {
  enabled: boolean
  storage: MemoryStorageKind
  location: string
  factCount: number
  lastObservedAt: number | null
  lastError: string | null
  observing: boolean
}

export type { MemorySettings }

declare global {
  interface Window {
    dsChatMemory?: MemoryFileBridge
  }
}
