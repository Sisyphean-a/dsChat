import { computed, ref } from 'vue'
import {
  CHAT_IDLE_RESET_MS,
  DEFAULT_SETTINGS,
  INTERRUPTED_RESPONSE_MESSAGE,
  SESSION_DOC_ID,
  STOPPED_RESPONSE_MESSAGE,
} from '../constants/app'
import { requestConversationTitle } from '../services/conversationTitle'
import { streamChatCompletion } from '../services/chatCompletion'
import { applyTheme } from '../services/theme'
import {
  deleteConversation as deleteConversationDoc,
  hasUtools,
  loadConversations,
  loadSession,
  loadSettings,
  saveConversation,
  saveSession,
  saveSettings as saveSettingsDoc,
} from '../services/utools'
import type {
  ChatMessage,
  ConversationDoc,
  ProviderSettings,
  SettingsForm,
} from '../types/chat'
import { shouldResetConversation } from '../utils/session'
import { cloneMessages } from '../utils/chat'
import { finalizeStreamingMessages } from './chatAppMessages'
import { createChatAppConversationPersistence } from './chatAppConversationPersistence'
import { getErrorMessage } from './chatAppErrors'
import { createChatAppSendActions } from './chatAppSendActions'
import { createChatAppSettingsActions } from './chatAppSettingsActions'
import {
  getActiveProviderSettings,
  getActiveModelSelectionOptions,
} from './chatAppSettings'

export function useChatApp() {
  const settings = ref<SettingsForm>(structuredClone(DEFAULT_SETTINGS))
  const conversations = ref<ConversationDoc[]>([])
  const activeConversationId = ref<string | null>(null)
  const messages = ref<ChatMessage[]>([])
  const draftMessage = ref('')
  const isSettingsOpen = ref(false)
  const isSidebarCollapsed = ref(true)
  const isSending = ref(false)
  const isSavingSettings = ref(false)
  const lastError = ref<string | null>(null)
  const environmentNotice = ref<string | null>(null)
  const isBrowserMode = computed(() => !hasUtools())
  const activeChatConfig = computed(() => getActiveProviderSettings(settings.value))
  const modelOptions = computed(() => getActiveModelSelectionOptions(settings.value))

  let activeAbortController: AbortController | null = null
  let lifecycleRegistered = false

  const settingsActions = createChatAppSettingsActions({
    applyTheme,
    isSavingSettings,
    isSettingsOpen,
    isSidebarCollapsed,
    lastError,
    saveSettings: saveSettingsDoc,
    settings,
  })

  const conversationPersistence = createChatAppConversationPersistence({
    activeConversationId,
    conversations,
    messages,
    saveConversation,
    saveSession,
  })

  const sendActions = createChatAppSendActions({
    activeConversationId,
    applyGeneratedConversationTitle: conversationPersistence.applyGeneratedConversationTitle,
    draftMessage,
    getAbortController: () => activeAbortController,
    interruptedResponseMessage: INTERRUPTED_RESPONSE_MESSAGE,
    isSending,
    lastError,
    messages,
    openSettings: settingsActions.openSettings,
    persistConversation: conversationPersistence.persistConversation,
    requestConversationTitle,
    setAbortController: (controller) => {
      activeAbortController = controller
    },
    settings,
    stoppedResponseMessage: STOPPED_RESPONSE_MESSAGE,
    streamChatCompletion,
  })

  async function initialize(): Promise<void> {
    settings.value = await loadSettings()
    applyTheme(settings.value.theme)
    conversations.value = await loadConversations()
    messages.value = []
    isSending.value = false

    if (isBrowserMode.value) {
      environmentNotice.value = '当前为浏览器预览模式：界面可用，但只有在 uTools 中才会使用本地数据库持久化。'
      return
    }

    registerLifecycleHooks()
    await restoreSession()
  }

  function startFreshConversation(): void {
    if (isSending.value) {
      return
    }

    activeConversationId.value = null
    messages.value = []
    lastError.value = null
  }

  function selectConversation(id: string): void {
    if (isSending.value) {
      return
    }

    const target = conversations.value.find((conversation) => conversation.id === id)
    if (!target) {
      return
    }

    void activateConversation(target)
  }

  async function deleteConversation(id: string): Promise<void> {
    if (isSending.value) {
      return
    }

    const target = conversations.value.find((conversation) => conversation.id === id)
    if (!target) {
      return
    }

    await deleteConversationDoc(target)
    conversations.value = conversations.value.filter((conversation) => conversation.id !== id)

    if (activeConversationId.value !== id) {
      return
    }

    activeConversationId.value = null
    messages.value = []
    await conversationPersistence.persistSession(null)
  }

  async function restoreSession(): Promise<void> {
    const session = await loadSession()
    if (!session) {
      return
    }

    if (shouldResetConversation(session.lastOutAt, Date.now(), CHAT_IDLE_RESET_MS)) {
      startFreshConversation()
      await conversationPersistence.persistSession(null)
      return
    }

    if (!session.currentConversationId) {
      return
    }

    const target = conversations.value.find((conversation) => conversation.id === session.currentConversationId)
    if (!target) {
      return
    }

    await activateConversation(target)
  }

  function registerLifecycleHooks(): void {
    if (lifecycleRegistered) {
      return
    }

    lifecycleRegistered = true
    window.utools?.onPluginEnter(async () => {
      await restoreSession()
    })

    window.utools?.onPluginOut(async () => {
      await sendActions.interruptActiveSend(INTERRUPTED_RESPONSE_MESSAGE)
      await saveSession({
        _id: SESSION_DOC_ID,
        type: 'session',
        currentConversationId: activeConversationId.value,
        lastOutAt: Date.now(),
      })
    })
  }

  async function activateConversation(conversation: ConversationDoc): Promise<void> {
    activeConversationId.value = conversation.id
    const restored = finalizeStreamingMessages(conversation.messages, INTERRUPTED_RESPONSE_MESSAGE)
    messages.value = cloneMessages(restored.messages)

    if (!restored.changed) {
      return
    }

    try {
      await conversationPersistence.persistConversation()
    } catch (error) {
      lastError.value = getErrorMessage(error, '会话记录修复失败。')
    }
  }

  function updateDeepseekField(
    field: keyof ProviderSettings,
    value: ProviderSettings[keyof ProviderSettings],
  ): void {
    settingsActions.updateDeepseekField(field, value)
  }

  function saveSettingsAction(): Promise<void> {
    return settingsActions.saveSettingsAction()
  }

  return {
    activeChatConfig,
    activeConversationId,
    addCustomModel: settingsActions.addCustomModel,
    closeSettings: settingsActions.closeSettings,
    conversations,
    deleteConversation,
    draftMessage,
    environmentNotice,
    initialize,
    isBrowserMode,
    isSavingSettings,
    isSending,
    isSettingsOpen,
    isSidebarCollapsed,
    lastError,
    messages,
    modelOptions,
    openSettings: settingsActions.openSettings,
    removeCustomModel: settingsActions.removeCustomModel,
    saveSettings: saveSettingsAction,
    selectActiveConfig: settingsActions.selectActiveConfig,
    selectActiveModel: settingsActions.selectActiveModel,
    selectConversation,
    sendMessage: sendActions.sendMessage,
    settings,
    stopGenerating: sendActions.stopGenerating,
    startFreshConversation,
    toggleSidebar: settingsActions.toggleSidebar,
    updateCustomModelField: settingsActions.updateCustomModelField,
    updateDeepseekField,
    updateTheme: settingsActions.updateTheme,
  }
}
