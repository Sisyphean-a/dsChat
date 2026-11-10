import type { Ref } from 'vue'
import type {
  ActiveProviderSettings,
  MessageAttachment,
  SettingsForm,
} from '../types/chat'
import type { ToolSettings } from '../services/ai/toolTypes'
import { cloneMessageAttachments } from '../utils/chat'
import { prepareRequestContext } from './chatAppRequestPreparation'

export interface SendPreparation {
  activeSettings: ActiveProviderSettings
  attachments: MessageAttachment[]
  content: string
  memorySection: string
  systemPrompt: string
  thinkingLevel: ActiveProviderSettings['reasoningLevel']
  toolSettings: ToolSettings
}

interface PrepareSendRequestOptions {
  draftMessage: Ref<string>
  isSending: Ref<boolean>
  lastError: Ref<string | null>
  openSettings: () => void
  pendingAttachments: Ref<MessageAttachment[]>
  resolveMemorySection?: (query: string) => Promise<string>
  settings: Ref<SettingsForm>
}

export async function prepareSendRequest(
  options: PrepareSendRequestOptions,
): Promise<SendPreparation | null> {
  const content = options.draftMessage.value.trim()
  const attachments = cloneMessageAttachments(options.pendingAttachments.value)
  if ((!content && !attachments.length) || options.isSending.value) {
    return null
  }

  const context = prepareRequestContext({
    attachments,
    lastError: options.lastError,
    openSettings: options.openSettings,
    settings: options.settings,
  })
  if (!context) {
    return null
  }

  return {
    activeSettings: context.activeSettings,
    attachments,
    content,
    memorySection: await resolveMemorySection(options.resolveMemorySection, content),
    systemPrompt: context.systemPrompt,
    thinkingLevel: context.thinkingLevel,
    toolSettings: context.toolSettings,
  }
}

/** Rule: 记忆检索失败不能阻塞发送；失败时按“本轮没有记忆”继续。 */
async function resolveMemorySection(
  resolver: ((query: string) => Promise<string>) | undefined,
  query: string,
): Promise<string> {
  if (!resolver) return ''
  try {
    return await resolver(query)
  } catch {
    return ''
  }
}
