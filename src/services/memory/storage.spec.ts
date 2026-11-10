import { describe, expect, it } from 'vitest'
import { parseEventLines } from './storage'

describe('memory storage', () => {
  it('跳过损坏行，保留其余事件', () => {
    const events = parseEventLines([
      JSON.stringify({ id: 'evt-1', op: 'observe', at: 1, conversationId: null, messageIds: [] }),
      '{损坏的行',
      '',
      JSON.stringify({ id: 'evt-2', op: 'forget', at: 2, conversationId: null, messageIds: [], targetId: 'x' }),
    ].join('\n'))

    expect(events.map((event) => event.id)).toEqual(['evt-1', 'evt-2'])
  })

  it('忽略缺少必要字段的条目', () => {
    expect(parseEventLines('{"op":"observe","at":1}')).toEqual([])
  })
})
