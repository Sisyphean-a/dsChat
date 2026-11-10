import { ref, type Ref } from 'vue'
import type { ActiveProviderSettings, ConversationDoc, SettingsForm } from '../types/chat'
import type {
  MemoryCandidate,
  MemoryEvent,
  MemoryFact,
  MemoryState,
  MemoryStatus,
} from '../types/memory'
import type { ProviderCompletion } from '../services/ai/providerCompletion'
import { createMemoryStorage, type MemoryStorage } from '../services/memory/storage'
import { applyMemoryEvent, applyMemoryEvents, activeFacts, createMemoryId } from '../services/memory/project'
import { selectMemoryFacts } from '../services/memory/retrieve'
import { renderMemorySection } from '../services/memory/prompt'
import { buildMemoryExtractionPrompt, parseMemoryExtraction } from '../services/memory/extract'

export interface MemoryStoreOptions {
  settings: Ref<SettingsForm>
  conversations: Ref<ConversationDoc[]>
  completion: ProviderCompletion
  resolveActiveSettings: () => ActiveProviderSettings
  storage?: MemoryStorage
  now?: () => number
}

export interface MemoryStore {
  status: Ref<MemoryStatus>
  facts: Ref<MemoryFact[]>
  initialize(): Promise<void>
  buildPromptSection(query: string): Promise<string>
  observeTurn(conversationId: string): Promise<void>
  listFacts(): MemoryFact[]
  forgetFact(id: string): Promise<void>
  togglePin(id: string): Promise<void>
  clearAll(): Promise<void>
  applySettings(): void
}

/**
 * Flow: 回合结束后按间隔抽取事实写入追加日志；每轮请求前按查询检索并渲染进系统提示词。
 * Rule: 抽取失败只记录错误、不自动重试；未启用时不读写记忆；读取到的状态视为事实视图缓存。
 */
export function createMemoryStore(options: MemoryStoreOptions): MemoryStore {
  const storage = options.storage ?? createMemoryStorage()
  const now = options.now ?? Date.now
  const status = ref<MemoryStatus>({
    enabled: options.settings.value.memory.enabled,
    storage: storage.kind,
    location: storage.location,
    factCount: 0,
    lastObservedAt: null,
    lastError: null,
    observing: false,
  })
  let state: MemoryState = emptyState(now())
  let initialization: Promise<void> | null = null
  const facts = ref<MemoryFact[]>([])

  function syncFacts(): void {
    facts.value = activeFacts(state.facts).sort((a, b) => b.updatedAt - a.updatedAt)
    status.value.factCount = facts.value.length
  }

  async function initialize(): Promise<void> {
    initialization ??= (async () => {
      const saved = await storage.readState()
      if (saved) {
        state = saved
      } else {
        const events = await storage.readEvents()
        state = {
          ...emptyState(now()),
          facts: applyMemoryEvents([], events),
          lastEventId: events.at(-1)?.id ?? null,
        }
      }
      applySettings()
      syncFacts()
    })()
    return initialization
  }

  async function persist(event: MemoryEvent): Promise<void> {
    await storage.appendEvent(event)
    state = {
      ...state,
      facts: applyMemoryEvent(state.facts, event),
      lastEventId: event.id,
      updatedAt: event.at,
    }
    await storage.writeState(state)
    await storage.backup(state)
    syncFacts()
  }

  async function buildPromptSection(query: string): Promise<string> {
    if (!options.settings.value.memory.enabled) return ''
    await initialize()
    const facts = activeFacts(state.facts)
    if (!facts.length) return ''
    const selected = selectMemoryFacts(facts, query, { now: now() })
    if (!selected.length) return ''
    const selectedIds = new Set(selected.map((fact) => fact.id))
    state = {
      ...state,
      facts: state.facts.map((fact) => selectedIds.has(fact.id)
        ? { ...fact, lastUsedAt: now(), useCount: fact.useCount + 1 }
        : fact),
    }
    return renderMemorySection(selected)
  }

  async function observeTurn(conversationId: string): Promise<void> {
    if (!options.settings.value.memory.enabled) return
    await initialize()
    const conversation = options.conversations.value.find((item) => item.id === conversationId)
    if (!conversation) return
    const messages = conversation.messages.filter(
      (message) => message.content.trim() || (message.attachments?.length ?? 0) > 0,
    )
    const pending = messagesSince(messages, state.observed[conversationId])
    const userMessages = pending.filter((message) => message.role === 'user')
    if (userMessages.length < options.settings.value.memory.observeEveryTurns) return
    const lastMessage = pending.at(-1)
    if (!lastMessage) return

    status.value.observing = true
    status.value.lastError = null
    try {
      const prompt = buildMemoryExtractionPrompt({
        messages: pending,
        existingFacts: activeFacts(state.facts),
      })
      const raw = await options.completion.complete({
        messages: [
          { content: prompt.system, role: 'system' },
          { content: prompt.user, role: 'user' },
        ],
        settings: options.resolveActiveSettings(),
        thinkingLevel: 'off',
      })
      const candidates = parseMemoryExtraction(raw)
      if (candidates.length) {
        await persist(createObserveEvent(
          conversationId,
          userMessages.map((message) => message.id),
          candidates,
          now(),
        ))
      }
      state = {
        ...state,
        observed: { ...state.observed, [conversationId]: lastMessage.id },
        updatedAt: now(),
      }
      await storage.writeState(state)
      status.value.lastObservedAt = now()
    } catch (error) {
      status.value.lastError = error instanceof Error && error.message.trim()
        ? error.message
        : '记忆抽取失败。'
    } finally {
      status.value.observing = false
    }
  }

  async function forgetFact(id: string): Promise<void> {
    await initialize()
    const target = state.facts.find((fact) => fact.id === id)
    if (!target || target.forgotten) return
    await persist(createTargetEvent('forget', id, now()))
  }

  async function togglePin(id: string): Promise<void> {
    await initialize()
    const target = state.facts.find((fact) => fact.id === id)
    if (!target) return
    await persist(createTargetEvent(target.pinned ? 'unpin' : 'pin', id, now()))
  }

  async function clearAll(): Promise<void> {
    await initialize()
    for (const fact of activeFacts(state.facts)) {
      await persist(createTargetEvent('forget', fact.id, now()))
    }
  }

  function applySettings(): void {
    status.value.enabled = options.settings.value.memory.enabled
  }

  return {
    status,
    facts,
    initialize,
    buildPromptSection,
    observeTurn,
    listFacts: () => activeFacts(state.facts).sort((a, b) => b.updatedAt - a.updatedAt),
    forgetFact,
    togglePin,
    clearAll,
    applySettings,
  }
}

function emptyState(at: number): MemoryState {
  return { version: 1, facts: [], lastEventId: null, updatedAt: at, observed: {} }
}

function messagesSince(
  messages: ConversationDoc['messages'],
  lastObservedId: string | undefined,
): ConversationDoc['messages'] {
  if (!lastObservedId) return messages
  const index = messages.findIndex((message) => message.id === lastObservedId)
  return index < 0 ? messages : messages.slice(index + 1)
}

function createObserveEvent(
  conversationId: string,
  messageIds: string[],
  candidates: MemoryCandidate[],
  at: number,
): MemoryEvent {
  return {
    id: createMemoryId('evt'),
    op: 'observe',
    at,
    conversationId,
    messageIds,
    candidates,
  }
}

function createTargetEvent(
  op: 'pin' | 'unpin' | 'forget',
  targetId: string,
  at: number,
): MemoryEvent {
  return { id: createMemoryId('evt'), op, at, conversationId: null, messageIds: [], targetId }
}
