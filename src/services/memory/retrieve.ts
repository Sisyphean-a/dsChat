import type { MemoryFact } from '../../types/memory'
import { isActive } from './project'
import { renderMemorySection } from './prompt'

const HALF_LIFE_DAYS = 30
const DEFAULT_LIMIT = 6
const DEFAULT_MIN_SCORE = 0.18
const PINNED_RESERVE = 2

export interface MemoryRetrievalOptions {
  limit?: number
  minScore?: number
  now?: number
}

/**
 * Flow: 用查询词法命中、重要性、新近度和使用次数加权，选出本轮要注入的事实。
 * Rule: 未命中的事实不注入；钉住的事实最多补入两条，其余必须有词法命中。
 */
export function selectMemoryFacts(
  facts: MemoryFact[],
  query: string,
  options: MemoryRetrievalOptions = {},
): MemoryFact[] {
  const now = options.now ?? Date.now()
  const limit = options.limit ?? DEFAULT_LIMIT
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE
  const queryTokens = new Set(tokenize(query))
  const active = facts.filter(isActive)

  const scored = active
    .map((fact) => ({ fact, score: scoreMemoryFact(fact, queryTokens, now) }))
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.fact)

  if (!scored.length) {
    return pinnedReserve(active, limit)
  }
  if (scored.some((fact) => fact.pinned)) {
    return scored
  }
  const reserve = pinnedReserve(active, PINNED_RESERVE)
    .filter((fact) => !scored.some((item) => item.id === fact.id))
  return [...scored, ...reserve].slice(0, limit)
}

export function scoreMemoryFact(
  fact: MemoryFact,
  queryTokens: Set<string>,
  now: number,
): number {
  const factTokens = new Set(tokenize(`${fact.subject} ${fact.text} ${fact.tags.join(' ')}`))
  let matched = 0
  for (const token of queryTokens) {
    if (factTokens.has(token)) matched += 1
  }
  const lexical = queryTokens.size ? matched / queryTokens.size : 0
  // Rule: 没有词法命中的事实不参与打分；钉住的事实由 pinnedReserve 单独补位。
  if (lexical === 0) return 0
  const importance = clamp((fact.importance - 1) / 4, 0, 1)
  const days = Math.max(0, (now - fact.updatedAt) / 86_400_000)
  const recency = Math.exp(-days / HALF_LIFE_DAYS)
  const usage = clamp(fact.useCount / 5, 0, 1)
  const bonus = fact.pinned ? 0.12 : 0
  return 0.45 * lexical + 0.25 * importance + 0.2 * recency + 0.1 * usage + bonus
}

/** Flow: 中文按 2-gram、英文按词切分；不使用分词库，保证浏览器与 Node 测试一致。 */
export function tokenize(text: string): string[] {
  const normalized = text.toLowerCase()
  const tokens = new Set<string>()
  for (const word of normalized.match(/[a-z0-9_+#.-]{2,}/g) ?? []) {
    tokens.add(word)
  }
  for (const run of (normalized.match(/[\u4e00-\u9fa5]+/g) ?? [])) {
    if (run.length === 1) {
      tokens.add(run)
      continue
    }
    for (let index = 0; index + 2 <= run.length; index += 1) {
      tokens.add(run.slice(index, index + 2))
    }
  }
  return [...tokens]
}

export function buildMemoryPrompt(facts: MemoryFact[], query: string, now = Date.now()): string {
  return renderMemorySection(selectMemoryFacts(facts, query, { now }))
}

function pinnedReserve(facts: MemoryFact[], limit: number): MemoryFact[] {
  return [...facts]
    .filter((fact) => fact.pinned)
    .sort((a, b) => b.importance - a.importance || b.updatedAt - a.updatedAt)
    .slice(0, limit)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
