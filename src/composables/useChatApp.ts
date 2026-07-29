import { computed, ref } from 'vue'
import {
  DEFAULT_SETTINGS,
  INTERRUPTED_RESPONSE_MESSAGE,
  SESSION_DOC_ID,
  STOPPED_RESPONSE_MESSAGE,
} from '../constants/app'
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
import type { PluginEnterPayload } from '../types/utools'
import type {
  ChatMessage,
  ConversationDoc,
  MessageAttachment,
  ProviderSettings,
  ProviderCapabilities,
  SettingsForm,
  ThinkingLevel,
} from '../types/chat'
import { shouldResetConversation } from '../utils/session'
import { cloneMessages } from '../utils/chat'
import { resolveComposerCommand } from '../utils/composerCommands'
import { preparePendingImages } from './chatAppAttachments'
import { finalizeStreamingMessages } from './chatAppMessages'
import { createChatAppConversationPersistence } from './chatAppConversationPersistence'
import { getErrorMessage } from './chatAppErrors'
import { providerSupportsImageInput } from '../constants/providerCapabilities'
import { getThinkingOptions } from '../constants/thinking'
import { createChatAppProduction } from './chatAppProduction'
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
  const settingsSaveError = ref<string | null>(null)
  const environmentNotice = ref<string | null>(null)
  const pluginEnterSignal = ref(0)
  const composerFocusPosition = ref<'start' | 'end'>('end')
  const initialized = ref(false)
  const isBrowserMode = computed(() => !hasUtools())
  const activeChatConfig = computed(() => getActiveProviderSettings(settings.value))
  const modelOptions = computed(() => getActiveModelSelectionOptions(settings.value))
  const canSendMessage = computed(() => {
    return Boolean(draftMessage.value.trim()) || pendingAttachments.value.length > 0
  })
  const isProviderSwitchLocked = computed(() => {
    return isSending.value || messages.value.length > 0
  })
  const thinkingOptions = computed(() => {
    return getThinkingOptions(activeChatConfig.value.provider, activeChatConfig.value)
  })
  const thinkingLevel = computed(() => activeChatConfig.value.reasoningLevel)
  const retryableAssistantMessageId = computed(() => {
    return resolveRetryableAssistantReply(messages.value)?.assistantId ?? null
  })

  let lifecycleRegistered = false
  let initialPluginEnterPayload: PluginEnterPayload | null = null

  const settingsActions = createChatAppSettingsActions({
    applyAppearance,
    isSavingSettings,
    isSettingsOpen,
    isSidebarCollapsed,
    lastError,
    settingsSaveError,
    saveSettings: saveSettingsDoc,
    settings,
  })

  const conversationPersistence = createChatAppConversationPersistence({
    getActiveConfigId: () => settings.value.activeConfigId,
    activeConversationId,
    conversations,
    deleteConversationDoc,
    messages,
    saveConversation,
    saveSession,
  })

  const replyLifecycle = createChatAppProduction({
    activeConversationId,
    conversationPersistence,
    conversations,
    draftMessage,
    interruptedResponseMessage: INTERRUPTED_RESPONSE_MESSAGE,
    isSending,
    lastError,
    messages,
    openSettings: settingsActions.openSettings,
    pendingAttachments,
    settings,
    stoppedResponseMessage: STOPPED_RESPONSE_MESSAGE,
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
      initialized.value = true
      return
    }

    registerLifecycleHooks()
    await restoreSession()
    const initialPayload = initialPluginEnterPayload
    initialPluginEnterPayload = null
    initialized.value = true
    composerFocusPosition.value = applyAskDsPayload(initialPayload) ? 'start' : 'end'
  }

  async function sendMessage(): Promise<void> {
    const command = pendingAttachments.value.length
      ? null
      : resolveComposerCommand(draftMessage.value)
    if (command?.type === 'new-conversation') {
      draftMessage.value = ''
      startFreshConversation()
      return
    }

    await replyLifecycle.send()
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

  function selectActiveConfig(configId: string): void {
    if (isProviderSwitchLocked.value) {
      return
    }

    settingsActions.selectActiveConfig(configId)
    const nextSettings = getActiveProviderSettings(settings.value)
    if (pendingAttachments.value.length > 0 && !providerSupportsImageInput(nextSettings)) {
      pendingAttachments.value = []
    }
  }

  function updateActiveThinkingLevel(level: ThinkingLevel): void {
    settingsActions.updateActiveThinkingLevel(level)
    void persistPreferenceChange()
  }

  async function deleteConversation(id: string): Promise<void> {
    if (isSending.value && activeConversationId.value === id) {
      await replyLifecycle.stop()
    }

    await conversationPersistence.deleteConversation(id)
  }

  async function restoreSession(): Promise<void> {
    const session = await loadSession()
    if (!session) {
      return
    }

    if (shouldResetConversation(
      session.lastOutAt,
      Date.now(),
      settings.value.utoolsSessionIdleTimeoutMinutes * 60_000,
    )) {
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
    window.utools?.onPluginEnter(async (payload) => {
      if (!initialized.value) {
        initialPluginEnterPayload = payload
        return
      }

      try {
        await restoreSession()
        composerFocusPosition.value = applyAskDsPayload(payload) ? 'start' : 'end'
      } finally {
        pluginEnterSignal.value += 1
      }
    })

    window.utools?.onPluginOut(async () => {
      await replyLifecycle.interrupt(INTERRUPTED_RESPONSE_MESSAGE)
      await saveSession({
        _id: SESSION_DOC_ID,
        type: 'session',
        currentConversationId: activeConversationId.value,
        lastOutAt: Date.now(),
      })
    })
  }

  function applyAskDsPayload(payload: PluginEnterPayload | null): boolean {
    if (payload?.code !== 'ask-ds' || typeof payload.payload !== 'string' || !payload.payload.trim()) {
      return false
    }

    draftMessage.value = `\n\`\`\`\n${payload.payload}\n\`\`\``
    return true
  }

  async function activateConversation(conversation: ConversationDoc): Promise<void> {
    const conversationConfigId = resolveConversationConfigId(conversation)
    if (conversationConfigId && settings.value.activeConfigId !== conversationConfigId) {
      settingsActions.selectActiveConfig(conversationConfigId)
    }

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

  function updateDeepseekCapability(
    field: keyof ProviderCapabilities,
    value: ProviderCapabilities[keyof ProviderCapabilities],
  ): void {
    settingsActions.updateDeepseekCapability(field, value)
  }

  function updateCustomModelCapability(
    id: string,
    field: keyof ProviderCapabilities,
    value: ProviderCapabilities[keyof ProviderCapabilities],
  ): void {
    settingsActions.updateCustomModelCapability(id, field, value)
  }

  function saveSettingsAction(): Promise<void> {
    return settingsActions.saveSettingsAction()
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

  function resolveConversationConfigId(conversation: ConversationDoc): string | null {
    const configId = conversation.configId?.trim()
    if (!configId) {
      return null
    }

    if (configId === 'deepseek') {
      return configId
    }

    return settings.value.customModels.some((item) => item.id === configId) ? configId : null
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
    composerFocusPosition,
    conversations,
    deleteConversation,
    draftMessage,
    environmentNotice,
    initialize,
    isBrowserMode,
    isSavingSettings,
    isSending,
    isProviderSwitchLocked,
    isSettingsOpen,
    isSidebarCollapsed,
    lastError,
    messages,
    modelOptions,
    openSettings: settingsActions.openSettings,
    pendingAttachments,
    pluginEnterSignal,
    retryLastAssistantMessage: replyLifecycle.retry,
    retryableAssistantMessageId,
    thinkingLevel,
    thinkingOptions,
    renameCustomModelOption: settingsActions.renameCustomModelOption,
    removeCustomModel: settingsActions.removeCustomModel,
    removeCustomModelOption: settingsActions.removeCustomModelOption,
    removeCustomTool: settingsActions.removeCustomTool,
    removePendingAttachment,
    saveSettings: saveSettingsAction,
    settingsSaveError,
    selectActiveConfig,
    selectActiveModel: settingsActions.selectActiveModel,
    selectConversation,
    sendMessage,
    settings,
    stopGenerating: replyLifecycle.stop,
    startFreshConversation,
    toggleSidebar: settingsActions.toggleSidebar,
    updateCustomModelField: settingsActions.updateCustomModelField,
    updateCustomModelCapability,
    updateCustomToolField: settingsActions.updateCustomToolField,
    updateDeepseekField,
    updateDeepseekCapability,
    updateActiveThinkingLevel,
    updateBuiltinToolEnabled: settingsActions.updateBuiltinToolEnabled,
    updateBuiltinToolTavilyApiKey: settingsActions.updateBuiltinToolTavilyApiKey,
    updateBuiltinToolTavilyBaseUrl: settingsActions.updateBuiltinToolTavilyBaseUrl,
    updateFontSize: settingsActions.updateFontSize,
    updateSystemPrompt: settingsActions.updateSystemPrompt,
    updateTheme: settingsActions.updateTheme,
    updateToolEnabled: settingsActions.updateToolEnabled,
    updateUtoolsSessionIdleTimeoutMinutes: settingsActions.updateUtoolsSessionIdleTimeoutMinutes,
    updateUtoolsUploadMode: settingsActions.updateUtoolsUploadMode,
  }
}
