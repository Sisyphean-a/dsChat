import type { ToolTraceErrorCode, ToolTraceRecord } from '../../types/chat'
import type { NormalizedToolCall } from './toolTypes'

const MAX_ARGS_SUMMARY_LENGTH = 120
const MAX_RESULT_SUMMARY_LENGTH = 140

export function createPlannedToolTrace(
  call: NormalizedToolCall,
  round: number,
  args: unknown,
): ToolTraceRecord {
  return {
    id: call.id,
    round,
    toolName: call.name,
    argsSummary: summarizeToolArguments(args),
    status: 'planned',
  }
}

export function markToolTraceRunning(
  trace: ToolTraceRecord,
  startedAtMs: number,
): ToolTraceRecord {
  return {
    ...trace,
    startedAtMs,
    status: 'running',
  }
}

export function markToolTraceSucceeded(
  trace: ToolTraceRecord,
  resultContent: string,
  finishedAtMs: number,
): ToolTraceRecord {
  const startedAtMs = trace.startedAtMs ?? finishedAtMs
  return {
    ...trace,
    durationMs: Math.max(0, finishedAtMs - startedAtMs),
    finishedAtMs,
    resultSize: resultContent.length,
    resultSummary: summarizeToolResult(resultContent),
    status: 'succeeded',
  }
}

export function markToolTraceFailed(
  trace: ToolTraceRecord,
  code: ToolTraceErrorCode,
  message: string,
  finishedAtMs: number,
): ToolTraceRecord {
  const startedAtMs = trace.startedAtMs ?? finishedAtMs
  return {
    ...trace,
    durationMs: Math.max(0, finishedAtMs - startedAtMs),
    errorCode: code,
    errorMessage: message,
    finishedAtMs,
    status: 'failed',
  }
}

export function createToolCallSignature(call: NormalizedToolCall): string {
  const parsed = safeParseJson(call.argumentsJson)
  if (parsed === null) {
    return `${call.name}:${call.argumentsJson.trim()}`
  }

  return `${call.name}:${stableStringify(parsed)}`
}

export function cloneToolTraces(traces: ToolTraceRecord[]): ToolTraceRecord[] {
  return traces.map((item) => ({ ...item }))
}

export function safeParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function summarizeToolArguments(args: unknown): string {
  const compact = stableStringify(args)
  if (!compact) {
    return '{}'
  }

  return trimText(compact, MAX_ARGS_SUMMARY_LENGTH)
}

function summarizeToolResult(content: string): string {
  const compact = content.replace(/\s+/g, ' ').trim()
  if (!compact) {
    return '(empty)'
  }

  return trimText(compact, MAX_RESULT_SUMMARY_LENGTH)
}

function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength)}...`
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? ''
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => stableStringify(item))
    return `[${items.join(',')}]`
  }

  const objectValue = value as Record<string, unknown>
  const keys = Object.keys(objectValue).sort()
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
  return `{${entries.join(',')}}`
}
