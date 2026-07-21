import type { ActiveProviderSettings, MessageAttachment } from '../../types/chat'
import { resolveProviderProtocol } from '../../constants/providerCapabilities'
import type { AiToolDefinition, NormalizedToolCall } from './toolTypes'
import { chatCompletionsAdapter } from './providerAdapters/chatCompletionsAdapter'
import { openAiResponsesAdapter } from './providerAdapters/openAiResponsesAdapter'

export interface ProviderConversationMessage {
  attachments?: MessageAttachment[]
  content: string
  reasoningContent?: string
  role: 'assistant' | 'system' | 'tool' | 'user'
  toolCallId?: string
  toolCalls?: NormalizedToolCall[]
}

export interface ProviderRequestInput {
  messages: ProviderConversationMessage[]
  settings: ActiveProviderSettings
  stream: boolean
  thinkingEnabled: boolean
  tools: AiToolDefinition[]
}

export interface ProviderRequest {
  body: Record<string, unknown>
  headers: Record<string, string>
  url: string
}

export interface ProviderStreamState {
  lastContent: string
  lastReasoning: string
  provider: ActiveProviderSettings['provider']
  toolCalls: Map<number, { argumentsJson: string; id: string; name: string }>
}

export type ProviderStreamDelta =
  | { type: 'content'; content: string }
  | { type: 'reasoning'; content: string }
  | { type: 'status'; status: string }
  | { type: 'tool-calls'; calls: NormalizedToolCall[] }
  | { type: 'done' }

export interface ProviderAdapter {
  createRequest: (input: ProviderRequestInput) => ProviderRequest
  createStreamState: (settings: ActiveProviderSettings) => ProviderStreamState
  parseSseEvent: (event: string, state: ProviderStreamState) => ProviderStreamDelta[]
  supportsTools: boolean
}

export type ProviderAdapterRegistry = {
  chatCompletions: ProviderAdapter
  responses: ProviderAdapter
}

export const defaultProviderAdapterRegistry: ProviderAdapterRegistry = {
  chatCompletions: chatCompletionsAdapter,
  responses: openAiResponsesAdapter,
}

export function selectProviderAdapter(
  registry: ProviderAdapterRegistry,
  settings: ActiveProviderSettings,
): ProviderAdapter | null {
  return resolveProviderProtocol(settings) === 'responses'
    ? registry.responses
    : registry.chatCompletions
}
