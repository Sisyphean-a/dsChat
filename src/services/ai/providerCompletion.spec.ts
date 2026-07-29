import { describe, expect, it } from 'vitest'
import { getDefaultProviderCapabilities } from '../../constants/providerCapabilities'
import { createProviderCompletion } from './providerCompletion'
import { defaultProviderAdapterRegistry } from './providerAdapter'

describe('ProviderCompletion', () => {
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
