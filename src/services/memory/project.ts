import type {
  MemoryCandidate,
  MemoryEvent,
  MemoryFact,
} from '../../types/memory'

/** 同一 kind + subject 视为同一件事，用于去重与取代。 */
export function memoryFactKey(kind: string, subject: string): string {
  return `${kind}|${normalizeSubject(subject)}`
}

export function createMemoryId(prefix = 'mem'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Flow: 事件按顺序投影成事实视图。
 * Rule: 只增不删；同 key 同文去重，同 key 异文让旧值失效并保留历史。
 * Guarantee: 同一事件序列在任意设备上得到相同结果（不依赖当前时间以外的环境状态）。
 */
export function applyMemoryEvents(facts: MemoryFact[], events: MemoryEvent[]): MemoryFact[] {
  return events.reduce((current, event) => applyMemoryEvent(current, event), facts)
}

export function applyMemoryEvent(facts: MemoryFact[], event: MemoryEvent): MemoryFact[] {
  if (event.op === 'observe') {
    return (event.candidates ?? []).reduce(
      (current, candidate) => applyObserve(current, candidate, event),
      facts,
    )
  }
  if (event.op === 'pin' || event.op === 'unpin') {
    return facts.map((fact) => fact.id === event.targetId
      ? { ...fact, pinned: event.op === 'pin', updatedAt: event.at }
      : fact)
  }
  if (event.op === 'forget') {
    return facts.map((fact) => fact.id === event.targetId
      ? { ...fact, forgotten: true, validTo: event.at, updatedAt: event.at }
      : fact)
  }
  return facts
}

function applyObserve(
  facts: MemoryFact[],
  candidate: MemoryCandidate,
  event: MemoryEvent,
): MemoryFact[] {
  const key = memoryFactKey(candidate.kind, candidate.subject)
  const normalized = normalizeText(candidate.text)
  const existing = facts.find((fact) => isActive(fact)
    && memoryFactKey(fact.kind, fact.subject) === key)

  if (existing && normalizeText(existing.text) === normalized) {
    return facts.map((fact) => fact.id === existing.id
      ? {
          ...fact,
          confidence: Math.max(fact.confidence, candidate.confidence),
          importance: Math.max(fact.importance, candidate.importance),
          tags: mergeTags(fact.tags, candidate.tags),
          updatedAt: event.at,
        }
      : fact)
  }

  const next: MemoryFact = {
    id: createMemoryId(),
    kind: candidate.kind,
    subject: candidate.subject,
    text: candidate.text,
    tags: candidate.tags,
    importance: candidate.importance,
    confidence: candidate.confidence,
    sourceConversationId: event.conversationId,
    sourceMessageIds: event.messageIds,
    createdAt: event.at,
    updatedAt: event.at,
    validFrom: event.at,
    validTo: null,
    supersededBy: null,
    forgotten: false,
    pinned: false,
    lastUsedAt: 0,
    useCount: 0,
  }
  if (!existing) {
    return [...facts, next]
  }
  return [
    ...facts.map((fact) => fact.id === existing.id
      ? { ...fact, validTo: event.at, supersededBy: next.id, updatedAt: event.at }
      : fact),
    next,
  ]
}

export function isActive(fact: MemoryFact): boolean {
  return fact.validTo === null && !fact.forgotten
}

export function activeFacts(facts: MemoryFact[]): MemoryFact[] {
  return facts.filter(isActive)
}

function normalizeSubject(subject: string): string {
  return normalizeText(subject)
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s，。,.!?！？：:；;、"'“”‘’()（）[\]【】]/g, '')
}

function mergeTags(current: string[], incoming: string[]): string[] {
  return [...new Set([...current, ...incoming])].slice(0, 8)
}
