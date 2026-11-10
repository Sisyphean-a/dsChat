import { describe, expect, it } from 'vitest'
import { selectMemoryFacts, tokenize } from './retrieve'
import { renderMemorySection } from './prompt'
import type { MemoryFact } from '../../types/memory'

const NOW = 1_700_000_000_000

function fact(overrides: Partial<MemoryFact> = {}): MemoryFact {
  return {
    id: overrides.id ?? 'fact-1',
    kind: overrides.kind ?? 'preference',
    subject: overrides.subject ?? '编辑器',
    text: overrides.text ?? '用户使用 VSCode 写前端',
    tags: overrides.tags ?? ['工具'],
    importance: overrides.importance ?? 3,
    confidence: overrides.confidence ?? 0.8,
    sourceConversationId: null,
    sourceMessageIds: [],
    createdAt: NOW,
    updatedAt: overrides.updatedAt ?? NOW,
    validFrom: NOW,
    validTo: null,
    supersededBy: null,
    forgotten: false,
    pinned: overrides.pinned ?? false,
    lastUsedAt: 0,
    useCount: 0,
  }
}

describe('memory retrieval', () => {
  it('中文按 2-gram 切分，英文按词切分', () => {
    expect(tokenize('VSCode 编辑器')).toContain('vscode')
    expect(tokenize('编辑器')).toEqual(['编辑', '辑器'])
  })

  it('相关事实优先，无关事实不注入', () => {
    const facts = [
      fact({ id: 'a', text: '用户使用 VSCode 写前端', subject: '编辑器' }),
      fact({ id: 'b', text: '用户喜欢喝美式咖啡', subject: '饮品', kind: 'background' }),
    ]
    const selected = selectMemoryFacts(facts, '前端项目用哪个编辑器', { now: NOW })
    expect(selected.map((item) => item.id)).toEqual(['a'])
  })

  it('没有词法命中时只补入钉住的事实', () => {
    const facts = [
      fact({ id: 'a', text: '用户喜欢喝美式咖啡', subject: '饮品' }),
      fact({ id: 'b', text: '永远先给结论', subject: '回答风格', pinned: true }),
    ]
    const selected = selectMemoryFacts(facts, '今天天气怎么样', { now: NOW })
    expect(selected.map((item) => item.id)).toEqual(['b'])
  })

  it('渲染结果包含类别标签且不含内部字段', () => {
    const text = renderMemorySection([fact({ text: '用户使用 VSCode 写前端' })])
    expect(text).toContain('关于用户')
    expect(text).toContain('[偏好] 用户使用 VSCode 写前端')
    expect(text).not.toContain('confidence')
    expect(text).not.toContain('fact-1')
  })
})
