import { describe, expect, it } from 'vitest'
import { buildMarkdownRenderSegments } from './streamingMarkdownSegments'

describe('buildMarkdownRenderSegments', () => {
  it('splits prose and completed fenced code blocks into separate segments', () => {
    const segments = buildMarkdownRenderSegments([
      '第一段说明',
      '',
      '```ts',
      'const value = 1',
      '```',
      '',
      '第二段说明',
    ].join('\n'))

    expect(segments.map((segment) => segment.kind)).toEqual(['prose', 'code', 'prose'])
    expect(segments[0]?.source).toContain('第一段说明')
    expect(segments[1]?.source).toContain('```ts')
    expect(segments[2]?.source).toContain('第二段说明')
  })

  it('keeps incomplete fenced blocks inside prose while streaming', () => {
    const segments = buildMarkdownRenderSegments([
      '说明文字',
      '',
      '```ts',
      'const value = 1',
    ].join('\n'))

    expect(segments).toHaveLength(1)
    expect(segments[0]?.kind).toBe('prose')
    expect(segments[0]?.source).toContain('```ts')
  })
})
