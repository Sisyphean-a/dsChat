import { describe, expect, it, vi } from 'vitest'
import { buildDefaultSettings } from '../../constants/providers'
import { getActiveProviderSettings } from '../../composables/chatAppSettings'
import { getDefaultProviderCapabilities } from '../../constants/providerCapabilities'
import { createProviderCompletion } from './providerCompletion'
import { defaultProviderAdapterRegistry } from './providerAdapter'

describe('ProviderCompletion', () => {
  it('records title completion tokens including cache without enabling stream options', async () => {
    const onProviderUsage = vi.fn()
    const completion = createProviderCompletion({
      httpAdapter: { send: async request => {
        expect(JSON.parse(request.body).stream_options).toBeUndefined()
        return response(JSON.stringify({
          choices: [{ message: { content: '标题' } }],
          usage: { prompt_tokens: 15, completion_tokens: 5, prompt_cache_hit_tokens: 10, prompt_cache_miss_tokens: 5 },
        }))
      } },
      providerAdapters: defaultProviderAdapterRegistry, onProviderUsage,
    })
    expect(await completion.complete({ messages: [], settings: getActiveProviderSettings(buildDefaultSettings()), thinkingLevel: 'off' })).toBe('标题')
    expect(onProviderUsage.mock.calls).toEqual([['deepseek', { inputTokens: 15, outputTokens: 5, cacheHitTokens: 10, cacheMissTokens: 5 }]])
  })

  it('reads a non-streaming Responses completion through the HTTP adapter', async () => {
    const completion = createProviderCompletion({
      httpAdapter: {
        send: async (request) => {
          expect(request.url).toBe('https://api.openai.com/v1/responses')
          expect(JSON.parse(request.body)).toMatchObject({
            reasoning: { effort: 'none' },
            stream: false,
          })
          return response('{"output_text":"简短标题"}')
        },
      },
      providerAdapters: defaultProviderAdapterRegistry,
    })

    await expect(completion.complete({
      messages: [{ content: '给对话起标题', role: 'user' }],
      settings: openAiSettings(),
      thinkingLevel: 'off',
    })).resolves.toBe('简短标题')
  })

  it('returns a stable failure code for an empty completion', async () => {
    const completion = createProviderCompletion({
      httpAdapter: { send: async () => response('{}') },
      providerAdapters: defaultProviderAdapterRegistry,
    })

    await expect(completion.complete({
      messages: [{ content: '给对话起标题', role: 'user' }],
      settings: openAiSettings(),
      thinkingLevel: 'off',
    })).rejects.toMatchObject({ code: 'empty-result' })
  })
})

function openAiSettings() {
  return {
    apiKey: 'sk-test',
    baseUrl: 'https://api.openai.com/v1',
    capabilities: getDefaultProviderCapabilities('openai'),
    configId: 'openai',
    label: 'OpenAI',
    model: 'gpt-5.6',
    modelOptions: ['gpt-5.6'],
    provider: 'openai' as const,
    reasoningLevel: 'medium' as const,
    temperature: 1,
  }
}

function response(content: string) {
  return {
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(content))
        controller.close()
      },
    }),
    status: 200,
    statusText: 'OK',
  }
}
