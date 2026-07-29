import type { Ref } from 'vue'
import type {
  ActiveProviderSettings,
  MessageAttachment,
  SettingsForm,
  ToolSettings,
} from '../types/chat'
import { cloneMessageAttachments } from '../utils/chat'
import { prepareRequestContext } from './chatAppRequestPreparation'

export interface SendPreparation {
  activeSettings: ActiveProviderSettings
  attachments: MessageAttachment[]
  content: string
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
  settings: Ref<SettingsForm>
}

export function prepareSendRequest(options: PrepareSendRequestOptions): SendPreparation | null {
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
    systemPrompt: context.systemPrompt,
    thinkingLevel: context.thinkingLevel,
    toolSettings: context.toolSettings,
  }
}
