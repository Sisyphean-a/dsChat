import type { ActiveProviderSettings, ChatMessage, MessageAttachment, ToolSettings } from '../types/chat'
import {
  providerSupportsImageInput,
  providerSupportsNativeWebSearch,
  providerSupportsToolCalling,
} from '../constants/providerCapabilities'
import type { MessageMapping } from '../services/ai/messageMapping'
import type { ProviderConversationMessage } from '../services/ai/providerAdapter'
import { buildSystemPrompt } from '../services/ai/systemPrompt'
import type { AiTool } from '../services/ai/toolTypes'
import { buildRequestMessages } from './chatAppRetry'

export interface TurnPlanRequest {
  settings: ActiveProviderSettings
  systemPrompt: string
  thinkingLevel: ActiveProviderSettings['reasoningLevel']
  toolSettings: ToolSettings
}

export interface TurnPlan {
  attachments: MessageAttachment[]
  directImageInput: boolean
  messages: ProviderConversationMessage[]
  tools: AiTool[]
  useToolOrchestrator: boolean
}

export type TurnToolResolver = (toolSettings: ToolSettings, attachments: MessageAttachment[]) => AiTool[]

/**
 * Flow: 由本回合消息取出附件 → 解析可用工具 → 决定图片直达还是交给图片工具 → 组装 Provider 消息与系统提示词。
 * Rule: 工具只在本回合附件确定后解析；Provider 不支持本地工具调用时不解析任何工具。
 * Guarantee: 图片去向与工具列表来自同一份判断，系统提示词与请求内容不会互相矛盾。
 */
export function createTurnPlan(options: {
  messageMapping: MessageMapping
  messages: ChatMessage[]
  request: TurnPlanRequest
  resolveTools: TurnToolResolver
}): TurnPlan {
  const requestMessages = buildRequestMessages(options.messages.slice(0, -1))
  const attachments = requestMessages.at(-1)?.attachments ?? []
  const localToolsAvailable = options.request.toolSettings.enabled
    && providerSupportsToolCalling(options.request.settings)
  const tools = localToolsAvailable
    ? options.resolveTools(options.request.toolSettings, attachments)
    : []
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

  if (options.request.toolSettings.enabled
    && !providerSupportsToolCalling(options.request.settings)
    && !providerSupportsNativeWebSearch(options.request.settings)) {
    throw new Error(`${options.request.settings.label} 当前配置暂不支持工具调用。`)
  }

  return {
    attachments,
    directImageInput,
    messages,
    tools,
    useToolOrchestrator: localToolsAvailable && tools.length > 0,
  }
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
