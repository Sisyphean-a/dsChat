import type { ProcessTimelineItem, ToolTraceRecord } from '../types/chat'

const USER_MESSAGE_COLLAPSE_MAX_LINES = 6
const USER_MESSAGE_COLLAPSE_MIN_CHARACTERS = 180

export function shouldCollapsePlainMessage(content: string): boolean {
  const normalized = content.trim()
  if (!normalized) {
    return false
  }

  const lineCount = normalized.split(/\r?\n/).length
  return lineCount > USER_MESSAGE_COLLAPSE_MAX_LINES
    || normalized.length > USER_MESSAGE_COLLAPSE_MIN_CHARACTERS
}

export function buildFallbackTimeline(
  reasoningContent: string,
  traces: ToolTraceRecord[],
): ProcessTimelineItem[] {
  const items: ProcessTimelineItem[] = []
  if (reasoningContent.trim()) {
    items.push({
      id: 'fallback-reasoning',
      type: 'reasoning',
      round: 1,
      status: 'done',
      text: summarizeReasoning(reasoningContent),
    })
  }

  for (const trace of traces) {
    items.push({
      id: `fallback-tool-${trace.id}`,
      type: 'tool',
      round: trace.round,
      status: mapToolTraceStatus(trace.status),
      durationMs: trace.durationMs,
      text: describeToolTraceFallback(trace.toolName, trace.status, trace.errorMessage),
    })
  }

  return items
}

function mapToolTraceStatus(status: string): ProcessTimelineItem['status'] {
  if (status === 'failed') return 'error'
  if (status === 'stopped') return 'stopped'
  if (status === 'running' || status === 'planned') return 'running'
  return 'done'
}

function describeToolTraceFallback(toolName: string, status: string, errorMessage?: string): string {
  if (status === 'failed') {
    return `${resolveToolDisplayName(toolName)}失败：${errorMessage?.trim() || '未知错误'}`
  }

  if (status === 'running' || status === 'planned') {
    return `正在执行${resolveToolDisplayName(toolName)}`
  }

  if (status === 'stopped') {
    return `${resolveToolDisplayName(toolName)}已停止`
  }

  return `${resolveToolDisplayName(toolName)}已完成`
}

function resolveToolDisplayName(toolName: string): string {
  if (toolName === 'tavily_search') {
    return '联网检索'
  }

  if (toolName === 'get_current_time') {
    return '时间查询'
  }

  return `工具 ${toolName}`
}

function summarizeReasoning(content: string): string {
  const normalized = content
    .split('\n')
    .map((line) => line.trim().replace(/^[-*]\s+/, ''))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalized) {
    return ''
  }

  return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized
}
