import type { ChatMessage, MessageAttachment } from '../../types/chat'
import type { NormalizedToolCall } from './toolTypes'
import type { ProviderConversationMessage } from './providerAdapter'

export interface MessageMapping {
  createToolAssistantMessage: (options: {
    content: string
    reasoningContent: string
    toolCalls: NormalizedToolCall[]
  }) => ProviderConversationMessage
  createToolResultMessage: (callId: string, content: string) => ProviderConversationMessage
  toProviderConversationMessages: (messages: ChatMessage[]) => ProviderConversationMessage[]
}

export const messageMapping: MessageMapping = {
  createToolAssistantMessage,
  createToolResultMessage,
  toProviderConversationMessages,
}

export function toProviderConversationMessages(messages: ChatMessage[]): ProviderConversationMessage[] {
  return messages.map(toProviderConversationMessage)
}

export function createToolAssistantMessage(options: {
  content: string
  reasoningContent: string
  toolCalls: NormalizedToolCall[]
}): ProviderConversationMessage {
  return {
    content: options.content,
    reasoningContent: options.reasoningContent || undefined,
    role: 'assistant',
    toolCalls: options.toolCalls.map((call) => ({ ...call })),
  }
}

export function createToolResultMessage(callId: string, content: string): ProviderConversationMessage {
  return { content, role: 'tool', toolCallId: callId }
}

function toProviderConversationMessage(message: ChatMessage): ProviderConversationMessage {
  return {
    attachments: cloneAttachments(message.attachments),
    content: message.content,
    reasoningContent: message.reasoningContent,
    role: message.role,
  }
}

function cloneAttachments(attachments: MessageAttachment[] | undefined): MessageAttachment[] | undefined {
  return attachments?.map((attachment) => ({ ...attachment }))
}
