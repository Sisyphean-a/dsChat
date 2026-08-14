import type { Ref } from 'vue'
import type { ChatMessage, ConversationDoc, MessageAttachment, SettingsForm } from '../types/chat'
import { createConversationTitleRequester } from '../services/conversationTitle'
import { createProviderCompletion } from '../services/ai/providerCompletion'
import { fetchHttpAdapter } from '../services/ai/httpAdapter'
import { defaultProviderAdapterRegistry } from '../services/ai/providerAdapter'
import { messageMapping } from '../services/ai/messageMapping'
import { createProviderStream } from '../services/ai/providerStream'
import { createToolOrchestrator } from '../services/ai/toolOrchestrator'
import { getEnabledTools } from '../services/tools/toolRegistry'
import { createConversationTitleManager, type ChatAppConversationPersistenceActions } from './chatAppConversationPersistence'
import { createReplyLifecycle, type ReplyLifecycle } from './chatAppReplyLifecycle'

interface ChatAppProductionOptions {
  activeConversationId: Ref<string | null>
  conversationPersistence: ChatAppConversationPersistenceActions
  conversations: Ref<ConversationDoc[]>
  draftMessage: Ref<string>
  interruptedResponseMessage: string
  isSending: Ref<boolean>
  lastError: Ref<string | null>
  messages: Ref<ChatMessage[]>
  openSettings: () => void
  pendingAttachments: Ref<MessageAttachment[]>
  settings: Ref<SettingsForm>
  stoppedResponseMessage: string
}

export function createChatAppProduction(options: ChatAppProductionOptions): ReplyLifecycle {
  const providerStream = createProviderStream({
    httpAdapter: fetchHttpAdapter,
    providerAdapters: defaultProviderAdapterRegistry,
  })
  const completion = createProviderCompletion({
    httpAdapter: fetchHttpAdapter,
    providerAdapters: defaultProviderAdapterRegistry,
  })
  const titleRequester = createConversationTitleRequester(completion)
  const toolOrchestrator = createToolOrchestrator({
    getEnabledTools,
    messageMapping,
    providerStream,
  })
  const titleManager = createConversationTitleManager({
    conversations: options.conversations,
    lastError: options.lastError,
    persistence: options.conversationPersistence,
    requestTitle: titleRequester.request,
  })
  let activeAbortController: AbortController | null = null

  return createReplyLifecycle({
    activeConversationId: options.activeConversationId,
    draftMessage: options.draftMessage,
    getAbortController: () => activeAbortController,
    interruptedResponseMessage: options.interruptedResponseMessage,
    isSending: options.isSending,
    lastError: options.lastError,
    messages: options.messages,
    messageMapping,
    notifyNewConversation(conversationId, firstMessageContent, settings, hasAttachments) {
      titleManager.generate({ conversationId, firstMessageContent, hasAttachments, settings })
    },
    openSettings: options.openSettings,
    pendingAttachments: options.pendingAttachments,
    persistConversation: options.conversationPersistence.persistConversation,
    providerStream,
    setAbortController(controller) {
      activeAbortController = controller
    },
    settings: options.settings,
    stoppedResponseMessage: options.stoppedResponseMessage,
    toolOrchestrator,
  })

}
