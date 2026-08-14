import type { ActiveProviderSettings, ChatMessage, MessageAttachment, ToolSettings } from '../types/chat'
import {
  providerSupportsImageInput,
  providerSupportsNativeWebSearch,
  providerSupportsToolCalling,
} from '../constants/providerCapabilities'
import type { MessageMapping } from '../services/ai/messageMapping'
import type { ProviderConversationMessage } from '../services/ai/providerAdapter'
import { buildSystemPrompt } from '../services/ai/systemPrompt'
import { getEnabledToolsForAttachments, type ToolOrchestrator } from '../services/ai/toolOrchestrator'
import type { AiTool } from '../services/ai/toolTypes'
import { buildRequestMessages } from './chatAppRetry'

export interface ReplyPlanRequest {
  settings: ActiveProviderSettings
  systemPrompt: string
  thinkingLevel: ActiveProviderSettings['reasoningLevel']
  toolSettings: ToolSettings
}

export interface ReplyRequestPlan {
  attachments: MessageAttachment[]
  messages: ProviderConversationMessage[]
  tools: AiTool['definition'][]
  useToolOrchestrator: boolean
}

export function buildReplyRequestPlan(options: {
  messageMapping: MessageMapping
  messages: ChatMessage[]
  request: ReplyPlanRequest
  toolOrchestrator: Pick<ToolOrchestrator, 'getEnabledTools'>
}): ReplyRequestPlan {
  const requestMessages = buildRequestMessages(options.messages.slice(0, -1))
  const attachments = requestMessages.at(-1)?.attachments ?? []
  const tools = resolveRequestTools(options.request, options.toolOrchestrator, attachments)
  const directImageInput = providerSupportsImageInput(options.request.settings)
    && !tools.some((tool) => tool.requiresImageAttachment)
  const providerMessages = options.messageMapping.toProviderConversationMessages(requestMessages)
  const messages = prependSystemPrompt(
    stripUnsupportedImageAttachments(providerMessages, directImageInput),
    buildSystemPrompt({
      attachments,
      customPrompt: options.request.systemPrompt,
      directImageInput,
      imageToolAvailable: tools.some((tool) => tool.requiresImageAttachment),
      nativeWebSearch: providerSupportsNativeWebSearch(options.request.settings),
      tools: tools.map((tool) => tool.definition),
    }),
  )
  const useToolOrchestrator = options.request.toolSettings.enabled
    && providerSupportsToolCalling(options.request.settings)
    && (tools.length > 0 || !options.toolOrchestrator.getEnabledTools)

  if (options.request.toolSettings.enabled
    && !providerSupportsToolCalling(options.request.settings)
    && !providerSupportsNativeWebSearch(options.request.settings)) {
    throw new Error(`${options.request.settings.label} 当前配置暂不支持工具调用。`)
  }

  return {
    attachments,
    messages,
    tools: tools.map((tool) => tool.definition),
    useToolOrchestrator,
  }
}

function resolveRequestTools(
  request: ReplyPlanRequest,
  toolOrchestrator: Pick<ToolOrchestrator, 'getEnabledTools'>,
  attachments: MessageAttachment[],
): AiTool[] {
  if (!request.toolSettings.enabled
    || !providerSupportsToolCalling(request.settings)
    || !toolOrchestrator.getEnabledTools) {
    return []
  }

  return getEnabledToolsForAttachments(
    toolOrchestrator.getEnabledTools,
    request.toolSettings,
    attachments,
  )
}

function stripUnsupportedImageAttachments(
  messages: ProviderConversationMessage[],
  supportsImageInput: boolean,
): ProviderConversationMessage[] {
  if (supportsImageInput) {
    return messages
  }

  return messages.map((message) => ({
    ...message,
    attachments: undefined,
  }))
}

function prependSystemPrompt(
  messages: ProviderConversationMessage[],
  systemPrompt: string,
): ProviderConversationMessage[] {
  if (!systemPrompt.trim()) {
    return messages
  }

  return [{ content: systemPrompt, role: 'system' }, ...messages]
}
