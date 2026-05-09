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
import { applyAppearance } from '../services/theme'
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
  MessageAttachment,
  ProviderId,
  ProviderSettings,
  SettingsForm,
} from '../types/chat'
import { shouldResetConversation } from '../utils/session'
import { cloneMessages } from '../utils/chat'
import { preparePendingImages } from './chatAppAttachments'
import { finalizeStreamingMessages } from './chatAppMessages'
import { createChatAppConversationPersistence } from './chatAppConversationPersistence'
import { getErrorMessage } from './chatAppErrors'
import {
  resolveThinkingEnabled as getThinkingEnabledForProvider,
  resolveThinkingProvider,
  shouldShowThinkingToggle,
} from './chatAppThinking'
import { createChatAppSendActions } from './chatAppSendActions'
import { createChatAppSettingsActions } from './chatAppSettingsActions'
import {
  getActiveProviderSettings,
  getActiveModelSelectionOptions,
  normalizeSettings,
} from './chatAppSettings'
import { resolveRetryableAssistantReply } from './chatAppRetry'

export function useChatApp() {
  const settings = ref<SettingsForm>(structuredClone(DEFAULT_SETTINGS))
  const conversations = ref<ConversationDoc[]>([])
  const activeConversationId = ref<string | null>(null)
  const messages = ref<ChatMessage[]>([])
  const draftMessage = ref('')
  const pendingAttachments = ref<MessageAttachment[]>([])
  const isSettingsOpen = ref(false)
  const isSidebarCollapsed = ref(true)
  const isSending = ref(false)
  const isSavingSettings = ref(false)
  const lastError = ref<string | null>(null)
  const environmentNotice = ref<string | null>(null)
  const isBrowserMode = computed(() => !hasUtools())
  const activeChatConfig = computed(() => getActiveProviderSettings(settings.value))
  const modelOptions = computed(() => getActiveModelSelectionOptions(settings.value))
  const canSendMessage = computed(() => {
    return Boolean(draftMessage.value.trim()) || pendingAttachments.value.length > 0
  })
  const showThinkingToggle = computed(() => {
    return shouldShowThinkingToggle(
      activeChatConfig.value.provider,
      activeChatConfig.value.model,
    )
  })
  const thinkingEnabled = computed(() => {
    return resolveThinkingEnabled(activeChatConfig.value.provider)
  })
  const retryableAssistantMessageId = computed(() => {
    return resolveRetryableAssistantReply(messages.value)?.assistantId ?? null
  })

  let activeAbortController: AbortController | null = null
  let lifecycleRegistered = false

  const settingsActions = createChatAppSettingsActions({
    applyAppearance,
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
    deleteConversationDoc,
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
    pendingAttachments,
    persistConversation: conversationPersistence.persistConversation,
      requestConversationTitle,
      getThinkingEnabled: (provider) => getThinkingEnabledForProvider(settings.value, provider),
      setAbortController: (controller) => {
        activeAbortController = controller
      },
    settings,
    stoppedResponseMessage: STOPPED_RESPONSE_MESSAGE,
    streamChatCompletion,
  })

  async function initialize(): Promise<void> {
    settings.value = await loadSettings()
    applyAppearance({
      fontSize: settings.value.fontSize,
      theme: settings.value.theme,
    })
    conversations.value = await loadConversations()
    messages.value = []
    pendingAttachments.value = []
    isSending.value = false

    if (isBrowserMode.value) {
      // environmentNotice.value = '当前为浏览器预览模式：使用浏览器本地存储保存设置与对话，不接入 uTools 数据库。'
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
    pendingAttachments.value = []
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

    pendingAttachments.value = []
    void activateConversation(target)
  }

  async function addPendingImages(files: File[]): Promise<void> {
    const prepared = await preparePendingImages({
      files,
      pendingAttachments: pendingAttachments.value,
    })
    pendingAttachments.value = prepared.nextAttachments
    lastError.value = prepared.error
  }

  function removePendingAttachment(id: string): void {
    pendingAttachments.value = pendingAttachments.value.filter((item) => item.id !== id)
  }

  function updateActiveThinkingEnabled(enabled: boolean): void {
    const provider = activeChatConfig.value.provider
    const target = resolveThinkingProvider(provider)
    if (!target) {
      return
    }

    settingsActions.updateProviderThinking(target, enabled)
    void persistPreferenceChange()
  }

  async function deleteConversation(id: string): Promise<void> {
    if (isSending.value && activeConversationId.value === id) {
      await sendActions.stopGenerating()
    }

    await conversationPersistence.deleteConversation(id)
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
    field: Exclude<keyof ProviderSettings, 'modelOptions'>,
    value: ProviderSettings[Exclude<keyof ProviderSettings, 'modelOptions'>],
  ): void {
    settingsActions.updateDeepseekField(field, value)
  }

  function saveSettingsAction(): Promise<void> {
    return settingsActions.saveSettingsAction()
  }

  function resolveThinkingEnabled(provider: ProviderId): boolean {
    return getThinkingEnabledForProvider(settings.value, provider)
  }

  async function persistPreferenceChange(): Promise<void> {
    try {
      const normalizedSettings = getNormalizedSettings()
      settings.value = normalizedSettings
      await saveSettingsDoc(normalizedSettings)
      lastError.value = null
    } catch (error) {
      lastError.value = getErrorMessage(error, '设置保存失败。')
    }
  }

  function getNormalizedSettings(): SettingsForm {
    return normalizeSettings(settings.value)
  }

  return {
    activeChatConfig,
    activeConversationId,
    addCustomModel: settingsActions.addCustomModel,
    addCustomModelOption: settingsActions.addCustomModelOption,
    addCustomTool: settingsActions.addCustomTool,
    addPendingImages,
    canSendMessage,
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
    pendingAttachments,
    retryLastAssistantMessage: sendActions.retryLastAssistantMessage,
    retryableAssistantMessageId,
    showThinkingToggle,
    thinkingEnabled,
    renameCustomModelOption: settingsActions.renameCustomModelOption,
    removeCustomModel: settingsActions.removeCustomModel,
    removeCustomModelOption: settingsActions.removeCustomModelOption,
    removeCustomTool: settingsActions.removeCustomTool,
    removePendingAttachment,
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
    updateCustomToolField: settingsActions.updateCustomToolField,
    updateDeepseekField,
    updateActiveThinkingEnabled,
    updateBuiltinToolEnabled: settingsActions.updateBuiltinToolEnabled,
    updateBuiltinToolTavilyApiKey: settingsActions.updateBuiltinToolTavilyApiKey,
    updateFontSize: settingsActions.updateFontSize,
    updateTheme: settingsActions.updateTheme,
    updateToolEnabled: settingsActions.updateToolEnabled,
    updateUtoolsUploadMode: settingsActions.updateUtoolsUploadMode,
  }
}
