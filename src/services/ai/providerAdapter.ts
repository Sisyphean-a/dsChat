import type { ActiveProviderSettings, MessageAttachment, ProviderId } from '../../types/chat'
import type { ChatRequestOptions } from '../chatCompletion'
import type { AiToolDefinition, NormalizedToolCall, ProviderStreamDelta } from './toolTypes'
import { chatCompletionsAdapter } from './providerAdapters/chatCompletionsAdapter'
import { openAiResponsesAdapter } from './providerAdapters/openAiResponsesAdapter'

export interface ProviderConversationMessage {
  role: 'assistant' | 'system' | 'tool' | 'user'
  content: string
  attachments?: MessageAttachment[]
  toolCallId?: string
  toolCalls?: NormalizedToolCall[]
}

export interface ProviderPayloadInput {
  messages: ProviderConversationMessage[]
  settings: ActiveProviderSettings
  stream: boolean
  requestOptions?: ChatRequestOptions
  tools?: AiToolDefinition[]
}

export interface ProviderStreamState {
  lastContent: string
  lastReasoning: string
  toolCalls: Map<number, { argumentsJson: string; id: string; name: string }>
}

export interface ProviderAdapter {
  supportsTools: boolean
  createRequestUrl: (baseUrl: string) => string
  createPayload: (input: ProviderPayloadInput) => Record<string, unknown>
  parseSseEvent: (event: string, state: ProviderStreamState) => ProviderStreamDelta[]
}

export function createProviderStreamState(): ProviderStreamState {
  return {
    lastContent: '',
    lastReasoning: '',
    toolCalls: new Map(),
  }
}

export function getProviderAdapter(provider: ProviderId): ProviderAdapter {
  if (provider === 'openai') {
    return openAiResponsesAdapter
  }

  return chatCompletionsAdapter
}
