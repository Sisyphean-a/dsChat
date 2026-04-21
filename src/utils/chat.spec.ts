import { describe, expect, it } from 'vitest'
import { buildConversationDoc, buildConversationTitle } from './chat'

describe('buildConversationTitle', () => {
  it('keeps the fallback title logic available for title generation prompts', () => {
    expect(buildConversationTitle([
      { id: '1', role: 'user', content: '这是第一句话', createdAt: 1, status: 'done' },
    ])).toBe('这是第一句话')
  })
})

describe('buildConversationDoc', () => {
  it('preserves an existing generated title instead of overwriting it with the first message', () => {
    const doc = buildConversationDoc(
      'c1',
      [
        { id: '1', role: 'user', content: '这不是标题，只是第一句话', createdAt: 1, status: 'done' },
      ],
      {
        _id: 'conversation/c1',
        type: 'conversation',
        id: 'c1',
        title: '真正的标题',
        createdAt: 1,
        updatedAt: 1,
        messages: [],
      },
    )

    expect(doc.title).toBe('真正的标题')
  })

  it('uses a neutral title before automatic title generation completes', () => {
    const doc = buildConversationDoc('c1', [
      { id: '1', role: 'user', content: '这不是标题，只是第一句话', createdAt: 1, status: 'done' },
    ])

    expect(doc.title).toBe('新对话')
  })
})
