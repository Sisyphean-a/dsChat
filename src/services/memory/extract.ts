import type { ChatMessage } from '../../types/chat'
import type { MemoryCandidate, MemoryFact, MemoryKind } from '../../types/memory'

const MAX_CANDIDATES = 6
const MAX_TEXT_LENGTH = 200
const MAX_SUBJECT_LENGTH = 20
const MAX_TAGS = 6

const MEMORY_KINDS: MemoryKind[] = ['profile', 'preference', 'background', 'instruction']

const SENSITIVE_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
  /(密码|口令|password|passwd)\s*[:：=]/i,
  /(api[\s_-]?key|access[\s_-]?token|secret[\s_-]?key)\s*[:：=]/i,
  /\b\d{17}[\dXx]\b/,
]

export const MEMORY_EXTRACTION_SYSTEM_PROMPT = `你是记忆整理器。你的唯一任务是从对话片段中提取值得长期记住的用户信息。
只提取用户明确表达、且在跨会话之后仍然成立的内容：身份、偏好、背景、明确要求。
不要提取：临时任务细节、模型自己的推测或建议、一次性的问题、敏感信息。
每条记忆用一句完整的大白话描述，不要把多个事实合并成一条。
subject 是稳定的归类词（例如"编辑器""回答风格""所在地""技术栈"），同一件事必须使用同一个 subject。
只输出 JSON，不要输出解释或代码块：{"memories":[{"kind":"profile|preference|background|instruction","subject":"...","text":"...","tags":["..."],"importance":3,"confidence":0.8}]}
importance 取 1-5 的整数，confidence 取 0-1；最多 ${MAX_CANDIDATES} 条。若无值得记住的内容，输出 {"memories":[]}。`

export interface MemoryExtractionInput {
  messages: ChatMessage[]
  existingFacts: MemoryFact[]
}

export function buildMemoryExtractionPrompt(input: MemoryExtractionInput): {
  system: string
  user: string
} {
  const existing = input.existingFacts
    .slice(0, 30)
    .map((fact) => `- ${fact.kind}/${fact.subject}：${fact.text}`)
    .join('\n')
  return {
    system: MEMORY_EXTRACTION_SYSTEM_PROMPT,
    user: [
      existing ? `已有记忆（同 subject 视为同一件事，新值会取代旧值）：\n${existing}` : '已有记忆：无',
      '对话片段：',
      renderTranscript(input.messages),
    ].join('\n\n'),
  }
}

/** Flow: 只把用户消息作为事实来源，助手消息仅保留少量上下文用于理解指代。 */
export function renderTranscript(messages: ChatMessage[]): string {
  return messages
    .slice(-12)
    .map((message) => {
      const content = message.content.trim().replace(/\s+/g, ' ')
      if (!content) return null
      const limit = message.role === 'user' ? 400 : 120
      return `${message.role === 'user' ? '用户' : '助手'}：${clip(content, limit)}`
    })
    .filter((line): line is string => Boolean(line))
    .join('\n')
}

export function parseMemoryExtraction(raw: string): MemoryCandidate[] {
  const payload = extractJson(raw)
  if (!payload) return []
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { memories?: unknown }).memories)
      ? (payload as { memories: unknown[] }).memories
      : []
  const candidates: MemoryCandidate[] = []
  for (const item of list) {
    const candidate = normalizeCandidate(item)
    if (!candidate) continue
    if (candidates.some((existing) => existing.kind === candidate.kind
      && normalize(existing.text) === normalize(candidate.text))) {
      continue
    }
    candidates.push(candidate)
    if (candidates.length >= MAX_CANDIDATES) break
  }
  return candidates
}

export function isSensitiveMemory(text: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text))
}

function normalizeCandidate(value: unknown): MemoryCandidate | null {
  if (!isRecord(value)) return null
  const text = typeof value.text === 'string' ? value.text.trim() : ''
  if (!text || text.length > MAX_TEXT_LENGTH) return null
  if (isSensitiveMemory(text)) return null
  const subject = typeof value.subject === 'string' && value.subject.trim()
    ? clip(value.subject.trim(), MAX_SUBJECT_LENGTH)
    : clip(text, 12)
  const kind = MEMORY_KINDS.includes(value.kind as MemoryKind)
    ? (value.kind as MemoryKind)
    : 'background'
  return {
    kind,
    subject,
    text,
    tags: normalizeTags(value.tags),
    importance: clamp(Math.round(Number(value.importance) || 3), 1, 5),
    confidence: clamp(Number(value.confidence) || 0.7, 0, 1),
  }
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0 && tag.length <= 20))]
    .slice(0, MAX_TAGS)
}

function extractJson(raw: string): unknown {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1))
  } catch {
    return null
  }
}

function clip(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit)}…` : value
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
