import { describe, expect, it, vi } from 'vitest'
import { createEmptyUsageStatistics, createUsageStatisticsStore, parseDeepseekUsage, USAGE_STATISTICS_ID, type UsageStatistics } from './usageStatistics'
import { loadLocalDoc, removeLocalDoc } from './localDocStorage'

const usage = { inputTokens: 100, outputTokens: 20, cacheHitTokens: 60, cacheMissTokens: 40 }

describe('usage statistics', () => {
  it('parses provider totals without double-counting cache as extra input', () => {
    expect(parseDeepseekUsage({ prompt_tokens: 100, completion_tokens: 20, prompt_cache_hit_tokens: 60, prompt_cache_miss_tokens: 40 })).toEqual(usage)
    expect(parseDeepseekUsage({ prompt_tokens: 100, completion_tokens: 20 })).toEqual({ inputTokens: 100, outputTokens: 20 })
    expect(parseDeepseekUsage({ prompt_tokens: 100, completion_tokens: 20, prompt_cache_hit_tokens: 200, prompt_cache_miss_tokens: 0 })).toEqual({ inputTokens: 100, outputTokens: 20 })
    expect(parseDeepseekUsage({ prompt_tokens: -1, completion_tokens: 20 })).toBeUndefined()
    expect(parseDeepseekUsage({ prompt_tokens: 1.2, completion_tokens: 20 })).toBeUndefined()
    expect(parseDeepseekUsage(null)).toBeUndefined()
  })

  it('serializes concurrent title, reply and tool increments and restores them after restart', async () => {
    await removeLocalDoc(USAGE_STATISTICS_ID)
    let current!: UsageStatistics
    const store = createUsageStatisticsStore({ onChange: value => { current = value } })
    await Promise.all([
      store.recordProvider('deepseek', usage), store.recordProvider('deepseek', usage),
      store.recordProvider('deepseek', undefined), store.recordProvider('openai', usage),
      store.recordTool('deepseek_search'), store.recordTool('deepseek_search'), store.recordTool('get_current_time'),
    ])
    expect(current.deepseek).toEqual({ requests: 3, usageReports: 2, cacheReports: 2, inputTokens: 200, outputTokens: 40, cacheHitTokens: 120, cacheMissTokens: 80 })
    expect(current.tools).toEqual({ deepseek_search: 2, get_current_time: 1 })
    const restored = vi.fn()
    await createUsageStatisticsStore({ onChange: restored }).initialize()
    expect(restored.mock.lastCall?.[0]).toMatchObject(current)
    expect(await loadLocalDoc(USAGE_STATISTICS_ID)).toMatchObject({ type: 'usage-statistics' })
    await removeLocalDoc(USAGE_STATISTICS_ID)
  })

  it('keeps incomplete cache coverage separate from token coverage', async () => {
    let current!: UsageStatistics
    const store = createUsageStatisticsStore({ onChange: value => { current = value }, load: async () => null, save: vi.fn() })
    await store.recordProvider('deepseek', { inputTokens: 5, outputTokens: 3 })
    expect(current.deepseek).toMatchObject({ usageReports: 1, cacheReports: 0, inputTokens: 5, outputTokens: 3 })
  })

  it('exposes failed persistence and retains the increment for the next write', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined)
    const store = createUsageStatisticsStore({ onChange: vi.fn(), load: async () => null, save })
    await expect(store.recordTool('deepseek_fetch')).rejects.toThrow('disk full')
    await store.recordTool('deepseek_fetch')
    expect(save.mock.lastCall?.[0].tools).toEqual({ deepseek_fetch: 2 })
  })

  it('does not overwrite malformed stored data with zeroes', async () => {
    const save = vi.fn()
    const store = createUsageStatisticsStore({ onChange: vi.fn(), load: async () => ({ ...createEmptyUsageStatistics(), deepseek: {} }), save })
    await expect(store.initialize()).rejects.toThrow('数据损坏')
    await expect(store.recordTool('deepseek_fetch')).rejects.toThrow('数据损坏')
    expect(save).not.toHaveBeenCalled()
  })

  it('counts tool names as data, including object prototype names', async () => {
    const save = vi.fn()
    const store = createUsageStatisticsStore({ onChange: vi.fn(), load: async () => null, save })
    await store.recordTool('__proto__')
    await store.recordTool('constructor')
    expect(save.mock.lastCall?.[0].tools).toEqual(JSON.parse('{"__proto__":1,"constructor":1}'))
  })
})
