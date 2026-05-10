import type { ProcessTimelineItem, ProcessTimelineItemStatus } from '../../types/chat'

const REASONING_SUMMARY_MAX_LENGTH = 180

export function createReasoningTimelineItem(options: {
  content: string
  id: string
  round: number
}): ProcessTimelineItem | null {
  const summary = summarizeReasoning(options.content)
  if (!summary) {
    return null
  }

  return {
    id: options.id,
    type: 'reasoning',
    text: summary,
    status: 'done',
    round: options.round,
  }
}

export function createToolTimelineItem(options: {
  id: string
  round: number
  status: ProcessTimelineItemStatus
  toolName: string
  toolArgs?: unknown
  durationMs?: number
  errorMessage?: string
  resultContent?: string
}): ProcessTimelineItem {
  return {
    id: options.id,
    type: 'tool',
    text: buildToolTimelineText(options),
    status: options.status,
    round: options.round,
    durationMs: options.durationMs,
  }
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

  return normalized.length > REASONING_SUMMARY_MAX_LENGTH
    ? `${normalized.slice(0, REASONING_SUMMARY_MAX_LENGTH)}...`
    : normalized
}

function buildToolTimelineText(options: {
  status: ProcessTimelineItemStatus
  toolName: string
  toolArgs?: unknown
  errorMessage?: string
  resultContent?: string
}): string {
  if (options.toolName === 'tavily_search') {
    return buildSearchTimelineText(options)
  }

  if (options.status === 'running') {
    return toolRunningLabel(options.toolName)
  }

  if (options.status === 'error') {
    const reason = options.errorMessage?.trim() || '未知错误'
    return `${toolDoneLabel(options.toolName)}失败：${reason}`
  }

  return `${toolDoneLabel(options.toolName)}完成`
}

function buildSearchTimelineText(options: {
  status: ProcessTimelineItemStatus
  toolArgs?: unknown
  errorMessage?: string
  resultContent?: string
}): string {
  const condition = buildSearchConditionText(options.toolArgs)
  const count = extractSearchResultCount(options.resultContent)

  if (options.status === 'running') {
    return `查询条件：${condition}`
  }

  if (options.status === 'error') {
    const reason = options.errorMessage?.trim() || '未知错误'
    return `查询条件：${condition}；查询失败：${reason}`
  }

  if (count === null) {
    return `查询条件：${condition}；结果条数：未知`
  }

  return `查询条件：${condition}；结果条数：${count}`
}

function toolRunningLabel(toolName: string): string {
  if (toolName === 'get_current_time') {
    return '正在获取当前时间信息'
  }

  return `正在调用工具 ${toolName}`
}

function toolDoneLabel(toolName: string): string {
  if (toolName === 'tavily_search') {
    return '联网检索'
  }

  if (toolName === 'get_current_time') {
    return '时间查询'
  }

  return `工具 ${toolName}`
}

function extractSearchResultCount(resultContent: string | undefined): number | null {
  if (!resultContent?.trim()) {
    return null
  }

  try {
    const parsed = JSON.parse(resultContent) as { results?: unknown }
    return Array.isArray(parsed.results) ? parsed.results.length : null
  } catch {
    return null
  }
}

function buildSearchConditionText(args: unknown): string {
  if (typeof args !== 'object' || args === null) {
    return '未提供'
  }

  const payload = args as {
    query?: unknown
    timeRange?: unknown
    topic?: unknown
  }

  const query = typeof payload.query === 'string' ? payload.query.trim() : ''
  const topic = typeof payload.topic === 'string' ? payload.topic.trim() : ''
  const timeRange = typeof payload.timeRange === 'string' ? payload.timeRange.trim() : ''

  const parts: string[] = []
  if (query) {
    parts.push(`关键词“${query}”`)
  }
  if (topic) {
    parts.push(`主题 ${topic}`)
  }
  if (timeRange) {
    parts.push(`时间范围 ${timeRange}`)
  }

  return parts.length ? parts.join('，') : '未提供'
}
