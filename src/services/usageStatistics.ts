import type { BaseDoc, ProviderId } from '../types/chat'
import { loadLocalDoc, saveLocalDoc } from './localDocStorage'

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheHitTokens?: number
  cacheMissTokens?: number
}

export interface UsageStatistics extends BaseDoc {
  type: 'usage-statistics'
  since: number
  deepseek: {
    requests: number
    usageReports: number
    cacheReports: number
    inputTokens: number
    outputTokens: number
    cacheHitTokens: number
    cacheMissTokens: number
  }
  tools: Record<string, number>
}

export interface UsageObserver {
  onProviderUsage?: (provider: ProviderId, usage: TokenUsage | undefined) => void
  onToolCall?: (name: string) => void
}

export const USAGE_STATISTICS_ID = 'usage-statistics'

export function createEmptyUsageStatistics(): UsageStatistics {
  return {
    _id: USAGE_STATISTICS_ID,
    type: 'usage-statistics',
    since: Date.now(),
    deepseek: { requests: 0, usageReports: 0, cacheReports: 0, inputTokens: 0, outputTokens: 0, cacheHitTokens: 0, cacheMissTokens: 0 },
    tools: {},
  }
}

export function parseDeepseekUsage(value: unknown): TokenUsage | undefined {
  if (!isRecord(value)) return undefined
  if (!isCount(value.prompt_tokens) || !isCount(value.completion_tokens)) return undefined
  const usage: TokenUsage = { inputTokens: value.prompt_tokens, outputTokens: value.completion_tokens }
  if (isCount(value.prompt_cache_hit_tokens) && isCount(value.prompt_cache_miss_tokens)
    && value.prompt_cache_hit_tokens + value.prompt_cache_miss_tokens === value.prompt_tokens) {
    usage.cacheHitTokens = value.prompt_cache_hit_tokens
    usage.cacheMissTokens = value.prompt_cache_miss_tokens
  }
  return usage
}

export function createUsageStatisticsStore(options: {
  onChange: (statistics: UsageStatistics) => void
  load?: () => Promise<unknown>
  save?: (statistics: UsageStatistics) => Promise<unknown>
}) {
  let statistics: UsageStatistics
  let initialization: Promise<void> | undefined
  let pending: Promise<void> = Promise.resolve()

  function initialize(): Promise<void> {
    initialization ??= (async () => {
      const saved = await (options.load ?? (() => loadLocalDoc(USAGE_STATISTICS_ID)))()
      statistics = saved === null ? createEmptyUsageStatistics() : validateStatistics(saved)
      options.onChange(structuredClone(statistics))
    })()
    return initialization
  }

  function update(change: (current: UsageStatistics) => void): Promise<void> {
    // Guarantee: 标题与正文并发结束时串行累计；写入失败保留内存累计，下一次保存不丢增量。
    const operation = pending.then(async () => {
      await initialize()
      change(statistics)
      options.onChange(structuredClone(statistics))
      await (options.save ?? saveLocalDoc)(structuredClone(statistics))
    })
    // Failure: 调用方仍收到拒绝并展示错误；队列恢复只允许后续保存继续，不伪装本次成功。
    pending = operation.catch(() => undefined)
    return operation
  }

  return {
    initialize,
    recordProvider(provider: ProviderId, usage: TokenUsage | undefined): Promise<void> {
      if (provider !== 'deepseek') return Promise.resolve()
      return update(current => {
        const totals = current.deepseek
        totals.requests += 1
        if (!usage) return
        totals.usageReports += 1
        totals.inputTokens += usage.inputTokens
        totals.outputTokens += usage.outputTokens
        if (usage.cacheHitTokens !== undefined && usage.cacheMissTokens !== undefined) {
          totals.cacheReports += 1
          totals.cacheHitTokens += usage.cacheHitTokens
          totals.cacheMissTokens += usage.cacheMissTokens
        }
      })
    },
    recordTool(name: string): Promise<void> {
      return update(current => {
        const previous = Object.hasOwn(current.tools, name) ? current.tools[name]! : 0
        Object.defineProperty(current.tools, name, { value: previous + 1, enumerable: true, writable: true, configurable: true })
      })
    },
  }
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateStatistics(value: unknown): UsageStatistics {
  if (!isRecord(value) || value._id !== USAGE_STATISTICS_ID || value.type !== 'usage-statistics'
    || !isCount(value.since) || !isRecord(value.deepseek) || !isRecord(value.tools)) {
    throw new Error('本机使用统计数据损坏，未覆盖原数据。')
  }
  const totals = value.deepseek
  const fields = ['requests', 'usageReports', 'cacheReports', 'inputTokens', 'outputTokens', 'cacheHitTokens', 'cacheMissTokens'] as const
  if (!fields.every(key => isCount(totals[key])) || !Object.values(value.tools).every(isCount)
    || Number(totals.usageReports) > Number(totals.requests) || Number(totals.cacheReports) > Number(totals.usageReports)) {
    throw new Error('本机使用统计数据损坏，未覆盖原数据。')
  }
  return structuredClone(value) as unknown as UsageStatistics
}
