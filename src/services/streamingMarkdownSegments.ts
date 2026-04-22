import { renderMarkdown } from './markdown'

const FENCED_CODE_BLOCK_PATTERN = /(^|\n)(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\n\2(?=\n|$)/g

export interface MarkdownRenderSegment {
  html: string
  id: string
  kind: 'code' | 'prose'
  source: string
}

export function buildMarkdownRenderSegments(content: string): MarkdownRenderSegment[] {
  if (!content.trim()) {
    return []
  }

  const segments: MarkdownRenderSegment[] = []
  let cursor = 0

  for (const match of content.matchAll(FENCED_CODE_BLOCK_PATTERN)) {
    const fullMatch = match[0]
    const boundary = match[1] ?? ''
    const start = match.index ?? 0
    const blockStart = start + boundary.length
    const blockEnd = blockStart + fullMatch.length - boundary.length

    appendProseSegment(segments, content.slice(cursor, blockStart))
    appendSegment(segments, 'code', content.slice(blockStart, blockEnd))
    cursor = blockEnd
  }

  appendProseSegment(segments, content.slice(cursor))
  return segments
}

function appendProseSegment(segments: MarkdownRenderSegment[], source: string): void {
  appendSegment(segments, 'prose', source)
}

function appendSegment(
  segments: MarkdownRenderSegment[],
  kind: MarkdownRenderSegment['kind'],
  source: string,
): void {
  if (!source.trim()) {
    return
  }

  segments.push({
    html: renderMarkdown(source),
    id: `${kind}-${segments.length}`,
    kind,
    source,
  })
}
