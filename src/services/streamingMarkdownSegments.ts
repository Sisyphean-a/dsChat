import { renderMarkdown } from './markdown'

const FENCED_CODE_BLOCK_PATTERN = /(^|\n)(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\n\2(?=\n|$)/g

export interface MarkdownRenderSegment {
  html: string
  id: string
  kind: 'code' | 'prose'
  source: string
}

export function buildMarkdownRenderSegments(
  content: string,
  previousSegments: readonly MarkdownRenderSegment[] = [],
): MarkdownRenderSegment[] {
  if (!content.trim()) {
    return []
  }

  const reusableSegments = new Map(previousSegments.map((segment) => [createSegmentKey(segment), segment]))
  const segments: MarkdownRenderSegment[] = []
  let cursor = 0

  for (const match of content.matchAll(FENCED_CODE_BLOCK_PATTERN)) {
    const fullMatch = match[0]
    const boundary = match[1] ?? ''
    const start = match.index ?? 0
    const blockStart = start + boundary.length
    const blockEnd = blockStart + fullMatch.length - boundary.length

    appendProseSegment(segments, content.slice(cursor, blockStart), reusableSegments)
    appendSegment(segments, 'code', content.slice(blockStart, blockEnd), reusableSegments)
    cursor = blockEnd
  }

  appendProseSegment(segments, content.slice(cursor), reusableSegments)
  return segments
}

function appendProseSegment(
  segments: MarkdownRenderSegment[],
  source: string,
  reusableSegments: ReadonlyMap<string, MarkdownRenderSegment>,
): void {
  appendSegment(segments, 'prose', source, reusableSegments)
}

function appendSegment(
  segments: MarkdownRenderSegment[],
  kind: MarkdownRenderSegment['kind'],
  source: string,
  reusableSegments: ReadonlyMap<string, MarkdownRenderSegment>,
): void {
  if (!source.trim()) {
    return
  }

  const candidate: MarkdownRenderSegment = {
    html: '',
    id: `${kind}-${segments.length}`,
    kind,
    source,
  }
  const reusable = reusableSegments.get(createSegmentKey(candidate))
  segments.push(reusable ?? {
    ...candidate,
    html: renderMarkdown(source),
  })
}

function createSegmentKey(segment: Pick<MarkdownRenderSegment, 'id' | 'kind' | 'source'>): string {
  return `${segment.id}\u0000${segment.kind}\u0000${segment.source}`
}
