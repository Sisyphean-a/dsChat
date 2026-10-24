import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { buildDefaultSettings, createAddedModelDraft } from '../../constants/providers'
import { normalizeSettings, getSendSettingsError, canActiveConversationSearchWeb } from '../../composables/chatAppSettings'
import { createToolOrchestrator } from '../ai/toolOrchestrator'
import { messageMapping } from '../ai/messageMapping'
import { getActiveProviderSettings } from '../../composables/chatAppSettings'
import type { ProviderStream } from '../ai/providerStream'
import { prepareRequestContext } from '../../composables/chatAppRequestPreparation'
import type { ToolExecutionContext } from '../ai/toolTypes'
import { getTurnTools } from './toolRegistry'
import { deepseekWebTools } from './deepseekWebTools'

const search = deepseekWebTools[0]!
const readPage = deepseekWebTools[1]!
function context(): ToolExecutionContext {
  const settings = buildDefaultSettings().toolSettings
  settings.enabled = true
  settings.builtinTools.deepseekWeb = { enabled: true }
  return { settings: { ...settings, deepseekApiKey: 'ds-key' }, signal: new AbortController().signal }
}
afterEach(() => vi.unstubAllGlobals())

describe('DeepSeek web tools', () => {
  it('enables search for a fresh user by configuring only the DeepSeek key', () => {
    const first = buildDefaultSettings()
    first.toolSettings.enabled = false
    first.toolSettings.builtinTools.deepseekWeb!.enabled = false
    const settings = ref(buildDefaultSettings())
    settings.value.deepseek.apiKey = 'ds-key'
    expect(settings.value.toolSettings.enabled).toBe(true)
    expect(settings.value.toolSettings.builtinTools.deepseekWeb?.enabled).toBe(true)
    const prepared = prepareRequestContext({ settings, attachments: [], lastError: ref(null), openSettings: vi.fn() })!
    expect(getTurnTools(prepared.toolSettings, []).map(t => t.definition.function.name)).toContain('deepseek_search')
    settings.value.toolSettings.enabled = false
    settings.value.toolSettings.builtinTools.deepseekWeb = { enabled: false }
    const restored = normalizeSettings(JSON.parse(JSON.stringify(settings.value)))
    expect(restored.toolSettings.enabled).toBe(false)
    expect(restored.toolSettings.builtinTools.deepseekWeb?.enabled).toBe(false)
  })

  it('reuses the existing DeepSeek key and keeps it out of persisted tool settings', () => {
    const settings = ref(buildDefaultSettings())
    settings.value.deepseek.apiKey = ' ds-key '
    settings.value.toolSettings.enabled = true
    settings.value.toolSettings.builtinTools.deepseekWeb = { enabled: true }
    const prepared = prepareRequestContext({ settings, attachments: [], lastError: ref(null), openSettings: vi.fn() })!
    expect(prepared.toolSettings.deepseekApiKey).toBe('ds-key')
    settings.value.deepseek.apiKey = 'changed-key'
    expect(prepared.toolSettings.deepseekApiKey).toBe('ds-key')
    expect(getTurnTools(prepared.toolSettings, []).map(t => t.definition.function.name)).toEqual(['get_current_time', 'deepseek_search', 'deepseek_fetch'])
    expect(JSON.stringify(normalizeSettings(settings.value).toolSettings)).not.toContain('key')
    expect(canActiveConversationSearchWeb(settings.value)).toBe(true)
  })

  it('supports other local-tool models without borrowing their credentials', () => {
    const settings = ref(buildDefaultSettings())
    const model = createAddedModelDraft('kimi', [])
    model.apiKey = 'kimi-key'
    settings.value.customModels = [model]
    settings.value.activeConfigId = model.id
    settings.value.deepseek.apiKey = 'ds-key'
    settings.value.toolSettings.enabled = true
    settings.value.toolSettings.builtinTools.deepseekWeb = { enabled: true }
    const prepared = prepareRequestContext({ settings, attachments: [], lastError: ref(null), openSettings: vi.fn() })!
    expect(prepared.toolSettings.deepseekApiKey).toBe('ds-key')
    settings.value.deepseek.apiKey = ''
    expect(getSendSettingsError(settings.value)).toContain('DeepSeek 模型设置')
    expect(canActiveConversationSearchWeb(settings.value)).toBe(false)
    settings.value.deepseek.apiKey = 'ds-key'
    model.capabilities.protocol = 'responses'
    model.provider = 'openai'
    model.capabilities.nativeWebSearch = true
    expect(getSendSettingsError(settings.value)).toContain('Chat Completions')
  })

  it('migrates old settings as disabled and preserves Tavily when disabled', () => {
    const settings = buildDefaultSettings()
    delete settings.toolSettings.builtinTools.deepseekWeb
    expect(normalizeSettings(settings).toolSettings.builtinTools.deepseekWeb).toEqual({ enabled: false })
    settings.toolSettings.enabled = true
    settings.toolSettings.builtinTools.tavilySearch.apiKey = 'tvly-key'
    expect(getTurnTools(settings.toolSettings, []).map(t => t.definition.function.name)).toEqual(['get_current_time', 'tavily_search'])
    expect(getTurnTools({ ...context().settings, enabled: false }, [])).toEqual([])
    expect(() => getTurnTools({ ...context().settings, deepseekApiKey: '' }, [])).toThrow('DeepSeek')
  })

  it('posts search schema, preserves sources, and accepts empty search results', async () => {
    const result = { title: '标题', url: 'https://example.com', snippet: '摘要', summary: '详细摘要', content: '', date: null }
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ results: [result] })).mockResolvedValueOnce(Response.json({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const ctx = context()
    const output = await search.execute({ query: '新消息 after:2026', count: 5, need_content: false }, ctx)
    expect(JSON.parse(output.content).results).toEqual([result])
    expect(fetchMock).toHaveBeenCalledWith('https://api.deepseek.com/v1/tools/search', expect.objectContaining({
      method: 'POST', redirect: 'error', signal: ctx.signal,
      headers: { Authorization: 'Bearer ds-key', 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '新消息 after:2026', count: 5, need_content: false }),
    }))
    expect(JSON.parse((await search.execute({ query: '无结果' }, ctx)).content).results).toEqual([])
  })

  it('fetches Markdown through the official endpoint, not the target site', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ title: '', content: '# 正文' }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await readPage.execute({ url: 'http://example.com/article' }, context())
    expect(JSON.parse(result.content)).toEqual({ url: 'http://example.com/article', title: '', content: '# 正文' })
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.deepseek.com/v1/tools/fetch')
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ url: 'http://example.com/article' })
  })

  it.each([{}, [], { query: '' }, { query: ' ' }, { query: '字'.repeat(129) }, { query: 'q', count: 0 }, { query: 'q', count: 51 }, { query: 'q', count: 1.5 }, { query: 'q', need_content: 1 }])('rejects invalid search arguments %j before IO', async args => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(search.execute(args, context())).rejects.toThrow('参数错误')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['file:///secret', 'javascript:alert(1)', 'https://user:pass@example.com', '/relative', 'x'.repeat(8193)])('rejects invalid fetch URL %s', async url => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(readPage.execute({ url }, context())).rejects.toThrow('参数错误')
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([401, 402, 403, 404, 429, 500, 504])('exposes HTTP %i without retries or fake success', async status => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('failure', { status }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(search.execute({ query: 'q' }, context())).rejects.toThrow('HTTP ' + status)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed success responses and empty fetch bodies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({})).mockResolvedValueOnce(Response.json({ results: [{}] })).mockResolvedValueOnce(Response.json({ title: '', content: '' })))
    await expect(search.execute({ query: 'q' }, context())).rejects.toThrow('响应格式')
    await expect(search.execute({ query: 'q' }, context())).rejects.toThrow('响应格式')
    await expect(readPage.execute({ url: 'https://example.com' }, context())).rejects.toThrow('响应格式')
  })

  it.each([200, 402])('runs search then fetch then a final answer through orchestration (fetch HTTP %i)', async status => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({ results: [{ title: '标题', url: 'https://example.com', snippet: '短', summary: '长', content: '' }] }))
      .mockResolvedValueOnce(status === 200 ? Response.json({ title: '标题', content: '# 正文' }) : new Response('', { status })))
    let round = 0
    const providerStream: ProviderStream = {
      async *stream(request) {
        if (round++ === 0) {
          yield { type: 'tool-calls', calls: [{ id: 's', name: 'deepseek_search', argumentsJson: '{"query":"问题"}' }] }
        } else if (round === 2) {
          expect(request.messages.at(-1)?.content).toContain('https://example.com')
          yield { type: 'tool-calls', calls: [{ id: 'f', name: 'deepseek_fetch', argumentsJson: '{"url":"https://example.com"}' }] }
        } else {
          expect(request.messages.at(-1)?.content).toContain(status === 200 ? '# 正文' : 'HTTP 402')
          yield { type: 'content', content: status === 200 ? '最终回答 [来源](https://example.com)' : '网页抓取失败：余额不足' }
        }
      },
    }
    const ctx = context()
    const events = []
    for await (const event of createToolOrchestrator({ messageMapping, providerStream }).stream({
      messages: [{ role: 'user', content: '搜索并读取网页' }],
      settings: getActiveProviderSettings(buildDefaultSettings()), thinkingLevel: 'off',
      tools: getTurnTools(ctx.settings, []), toolContext: ctx,
    })) events.push(event)
    expect(round).toBe(3)
    expect(events).toContainEqual(expect.objectContaining({ type: 'content' }))
    expect(events).toContainEqual(expect.objectContaining({
      type: 'tool-trace', trace: expect.objectContaining({ toolName: 'deepseek_fetch', status: status === 200 ? 'succeeded' : 'failed' }),
    }))
    expect(events).toContainEqual(expect.objectContaining({
      type: 'timeline', item: expect.objectContaining({ text: '查询条件：关键词“问题”；结果条数：1' }),
    }))
  })

  it('propagates cancellation while an HTTP request is in flight', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
    })))
    const pending = search.execute({ query: 'q' }, { ...context(), signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})
