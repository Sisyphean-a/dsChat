import { describe, expect, it } from 'vitest'
import { getDefaultProviderCapabilities } from '../../../constants/providerCapabilities'
import { openAiResponsesAdapter } from './openAiResponsesAdapter'

describe('openAiResponsesAdapter', () => {
  it('sends the selected OpenAI reasoning effort in the Responses request', () => {
    const request = openAiResponsesAdapter.createRequest({
      messages: [{ content: '解释这段代码', role: 'user' }],
      settings: {
        apiKey: 'sk-test',
        baseUrl: 'https://api.openai.com/v1',
        capabilities: getDefaultProviderCapabilities('openai'),
        configId: 'openai',
        label: 'OpenAI',
        model: 'gpt-5.6',
        modelOptions: ['gpt-5.6'],
        provider: 'openai',
        reasoningLevel: 'medium',
        temperature: 1,
      },
      stream: true,
      thinkingLevel: 'high',
      tools: [],
    })

    expect(request.url).toBe('https://api.openai.com/v1/responses')
    expect(request.body).toMatchObject({
      reasoning: { effort: 'high' },
      stream: true,
    })
  })
})
