import { describe, expect, it } from 'vitest'
import { applyMemoryEvent, applyMemoryEvents, activeFacts, createMemoryId } from './project'
import type { MemoryEvent, MemoryFact } from '../../types/memory'

function observeEvent(candidates: MemoryEvent['candidates'], at = 1_000): MemoryEvent {
  return {
    id: createMemoryId('evt'),
    op: 'observe',
    at,
    conversationId: 'conversation-1',
    messageIds: ['message-1'],
    candidates,
  }
}

function candidate(text: string, subject = '编辑器') {
  return {
    kind: 'preference' as const,
    subject,
    text,
    tags: ['工具'],
    importance: 3,
    confidence: 0.8,
  }
}

describe('memory projection', () => {
  it('合并同一件事的重复说法，不新增事实', () => {
    const first = applyMemoryEvent([], observeEvent([candidate('用户使用 VSCode')]))
    const second = applyMemoryEvent(first, observeEvent([candidate('用户使用 VSCode')], 2_000))

    expect(activeFacts(second)).toHaveLength(1)
    expect(activeFacts(second)[0].updatedAt).toBe(2_000)
    expect(activeFacts(second)[0].createdAt).toBe(1_000)
  })

  it('同 subject 的新值取代旧值并保留历史', () => {
    const first = applyMemoryEvent([], observeEvent([candidate('用户使用 VSCode')]))
    const second = applyMemoryEvent(first, observeEvent([candidate('用户使用 Cursor')], 2_000))

    const active = activeFacts(second)
    expect(active).toHaveLength(1)
    expect(active[0].text).toContain('Cursor')
    const superseded = second.find((fact) => fact.text.includes('VSCode')) as MemoryFact
    expect(superseded.validTo).toBe(2_000)
    expect(superseded.supersededBy).toBe(active[0].id)
  })

  it('钉住、取消钉住与遗忘都只追加事件', () => {
    const facts = applyMemoryEvents([], [
      observeEvent([candidate('用户使用 VSCode')]),
      { id: 'evt-pin', op: 'pin', at: 2_000, conversationId: null, messageIds: [], targetId: '' },
    ])
    const targetId = facts[0].id
    const pinned = applyMemoryEvents(facts, [
      { id: 'evt-pin-2', op: 'pin', at: 2_000, conversationId: null, messageIds: [], targetId },
      { id: 'evt-unpin', op: 'unpin', at: 3_000, conversationId: null, messageIds: [], targetId },
      { id: 'evt-forget', op: 'forget', at: 4_000, conversationId: null, messageIds: [], targetId },
    ])

    expect(pinned[0].pinned).toBe(false)
    expect(pinned[0].forgotten).toBe(true)
    expect(pinned[0].validTo).toBe(4_000)
    expect(activeFacts(pinned)).toHaveLength(0)
  })
})
