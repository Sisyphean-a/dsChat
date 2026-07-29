import type { ActiveProviderSettings, ThinkingLevel } from '../../types/chat'
import type { HttpAdapter } from './httpAdapter'
import type { ProviderAdapterRegistry, ProviderConversationMessage } from './providerAdapter'
import { selectProviderAdapter } from './providerAdapter'
import { ProviderRequestError } from './providerStream'

interface ProviderCompletionOptions {
  httpAdapter: HttpAdapter
  providerAdapters: ProviderAdapterRegistry
}

export interface ProviderCompletion {
  complete: (request: {
    messages: ProviderConversationMessage[]
    settings: ActiveProviderSettings
    thinkingLevel: ThinkingLevel
  }) => Promise<string>
}

export function createProviderCompletion(options: ProviderCompletionOptions): ProviderCompletion {
  return {
    async complete(request) {
      const adapter = selectProviderAdapter(options.providerAdapters, request.settings)
      if (!adapter) {
        throw new ProviderRequestError('protocol', `${request.settings.label} 找不到可用的 Provider adapter。`)
      }
      const providerRequest = adapter.createRequest({
        messages: request.messages,
        settings: request.settings,
        stream: false,
        thinkingLevel: request.thinkingLevel,
        tools: [],
      })
      const response = await options.httpAdapter.send({
        body: JSON.stringify(providerRequest.body),
        headers: providerRequest.headers,
        url: providerRequest.url,
      })
      const text = await readResponseText(response.body)
      if (response.status < 200 || response.status >= 300) {
        throw new ProviderRequestError('http', `${request.settings.label} 请求失败：${response.status} ${text}`.trim())
      }
      const content = extractCompletionText(text).trim()
      if (!content) {
        throw new ProviderRequestError('empty-result', `${request.settings.label} 未返回可用内容。`)
      }
      return content
    },
  }
}

async function readResponseText(body: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!body) return ''

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) return text + decoder.decode()
      text += decoder.decode(chunk.value, { stream: true })
    }
  } finally {
    reader.releaseLock()
  }
}

function extractCompletionText(text: string): string {
  try {
    const payload = JSON.parse(text) as {
      choices?: Array<{ message?: { content?: string } }>
      output?: Array<{ content?: Array<{ text?: string; type?: string }> }>
      output_text?: string
    }
    if (payload.output_text) {
      return payload.output_text
    }
    const responseText = payload.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === 'output_text')
      .map((item) => item.text ?? '')
      .join('')
    return responseText || payload.choices?.[0]?.message?.content || ''
  } catch {
    return ''
  }
}
