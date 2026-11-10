import { computed, ref, watch } from 'vue'
import { createUsageStatisticsStore, type UsageStatistics } from '../services/usageStatistics'
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
  loadRemoteConversations,
  loadSession,
  loadSettings,
  saveConversation,
  saveSession,
  saveSettings as saveSettingsDoc,
} from '../services/utools'
import { saveLocalDoc } from '../services/localDocStorage'
import {
  EMPTY_RECOVERY_STATE,
  mergeRecoveredConversations,
  type ConversationRecoveryState,
} from '../services/conversationRecovery'
import type {
  ChatMessage,
  ConversationDoc,
  MessageAttachment,
  SettingsForm,
  ThinkingLevel,
} from '../types/chat'
import { shouldResetConversation } from '../utils/session'
import { cloneMessages, sortConversations } from '../utils/chat'
import { resolveComposerCommand } from '../utils/composerCommands'
import { formatAskDsDraft } from '../utils/askDsPayload'
import { preparePendingImages } from './chatAppAttachments'
import { finalizeStreamingMessages } from './chatAppMessages'
import { createChatAppConversationPersistence } from './chatAppConversationPersistence'
import { getErrorMessage } from './chatAppErrors'
import { providerSupportsImageInput } from '../constants/providerCapabilities'
import { getThinkingOptions } from '../constants/thinking'
import { createChatAppProduction } from './chatAppProduction'
import { createChatAppSettingsActions } from './chatAppSettingsActions'
import { createUtoolsHostLifecycle } from './utoolsHostLifecycle'
import {
  getActiveProviderSettings,
  getActiveModelSelectionOptions,
  normalizeSettings,
} from './chatAppSettings'
import { resolveRetryableAssistantReply } from './chatAppRetry'
import { createProviderCompletion } from '../services/ai/providerCompletion'
import { fetchHttpAdapter } from '../services/ai/httpAdapter'
import { defaultProviderAdapterRegistry } from '../services/ai/providerAdapter'
import { createMemoryStore } from './useMemory'

export function useChatApp() {
  const settings = ref<SettingsForm>(structuredClone(DEFAULT_SETTINGS))
  const usageStatistics = ref<UsageStatistics | null>(null)
  const usageStatisticsError = ref<string | null>(null)
  const usageStore = createUsageStatisticsStore({
    onChange: value => { usageStatistics.value = value },
  })
  function reportUsageError(error: unknown): void {
    usageStatisticsError.value = getErrorMessage(error, '使用统计保存失败。')
  }
  const conversations = ref<ConversationDoc[]>([])
  const recoveryStatus = ref<ConversationRecoveryState>({ ...EMPTY_RECOVERY_STATE })
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
  const memory = createMemoryStore({
    settings,
    conversations,
    completion: createProviderCompletion({
      httpAdapter: fetchHttpAdapter,
      providerAdapters: defaultProviderAdapterRegistry,
    }),
    resolveActiveSettings: () => getActiveProviderSettings(settings.value),
  })
  watch(() => settings.value.memory.enabled, () => memory.applySettings())
  const pendingMemoryTurns = computed(() => {
    const conversationId = activeConversationId.value
    if (!conversationId) return 0
    const conversation = conversations.value.find((item) => item.id === conversationId)
    if (!conversation) return 0
    const observedId = memory.observed.value[conversationId]
    const index = observedId
      ? conversation.messages.findIndex((message) => message.id === observedId)
      : -1
    return conversation.messages.slice(index + 1).filter((message) => message.role === 'user').length
  })
  async function observeMemoryNow(): Promise<void> {
    const conversationId = activeConversationId.value
    if (!conversationId) return
    await memory.observeTurn(conversationId, { force: true })
  }

  const replyLifecycle = createChatAppProduction({
    onProviderUsage(provider, usage) {
      void usageStore.recordProvider(provider, usage).catch(reportUsageError)
    },
    onToolCall(name) {
      void usageStore.recordTool(name).catch(reportUsageError)
    },
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
    resolveMemorySection: (query) => memory.buildPromptSection(query),
    onTurnCompleted: (conversationId) => {
      void memory.observeTurn(conversationId)
    },
    settings,
    stoppedResponseMessage: STOPPED_RESPONSE_MESSAGE,
  })

  const hostLifecycle = createUtoolsHostLifecycle({
    isReady: () => initialized.value,
    async onEnter(payload) {
      await restoreSession()
      const draft = formatAskDsDraft(payload)
      if (draft !== null) {
        draftMessage.value = draft
      }
      composerFocusPosition.value = draft === null ? 'end' : 'start'
    },
    async onOut() {
      await replyLifecycle.interrupt(INTERRUPTED_RESPONSE_MESSAGE)
      await saveSession({
        _id: SESSION_DOC_ID,
        type: 'session',
        currentConversationId: activeConversationId.value,
        lastOutAt: Date.now(),
      })
    },
  })

  async function initialize(): Promise<void> {
    await usageStore.initialize().catch(reportUsageError)
    settings.value = await loadSettings()
    applyAppearance({
      fontSize: settings.value.fontSize,
      theme: settings.value.theme,
    })
    conversations.value = await loadConversations()
    void scanHistory().catch(() => {})
    messages.value = []
    pendingAttachments.value = []
    isSending.value = false
    await memory.initialize().catch(() => {})
    memory.applySettings()

    if (isBrowserMode.value) {
      // environmentNotice.value = '当前为浏览器预览模式：使用浏览器本地存储保存设置与对话，不接入 uTools 数据库。'
      initialized.value = true
      return
    }

    hostLifecycle.register()
    await restoreSession()
    initialized.value = true
    await hostLifecycle.flushPendingEnter()
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

  function clearLastError(): void {
    lastError.value = null
  }

  function startFreshConversation(): void {
    if (isSending.value) {
      return
    }

    activeConversationId.value = null
    messages.value = []
    pendingAttachments.value = []
    clearLastError()
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

  async function scanHistory(): Promise<void> {
    if (!hasUtools()) return
    recoveryStatus.value = { ...recoveryStatus.value, scanning: true, error: null }
    try {
      const remote = await loadRemoteConversations()
      const result = mergeRecoveredConversations(conversations.value, remote)
      recoveryStatus.value = {
        ...recoveryStatus.value,
        scanning: false,
        availableConversations: result.recoveredConversations,
        availableMessages: result.recoveredMessages,
      }
    } catch (error) {
      recoveryStatus.value = {
        ...recoveryStatus.value,
        scanning: false,
        error: getErrorMessage(error, '检查历史记录失败。'),
      }
    }
  }

  async function recoverHistory(): Promise<void> {
    if (!hasUtools()) return
    recoveryStatus.value = { ...recoveryStatus.value, scanning: true, error: null }
    try {
      const remote = await loadRemoteConversations()
      const result = mergeRecoveredConversations(conversations.value, remote)
      const previousSizes = new Map(conversations.value.map((item) => [item.id, item.messages.length]))
      for (const conversation of result.conversations) {
        const previousSize = previousSizes.get(conversation.id)
        if (previousSize === undefined || previousSize < conversation.messages.length) {
          await saveLocalDoc(conversation)
        }
      }
      conversations.value = sortConversations(result.conversations)
      recoveryStatus.value = {
        scanning: false,
        availableConversations: 0,
        availableMessages: 0,
        recoveredConversations: result.recoveredConversations,
        recoveredMessages: result.recoveredMessages,
        error: null,
      }
    } catch (error) {
      recoveryStatus.value = {
        ...recoveryStatus.value,
        scanning: false,
        error: getErrorMessage(error, '恢复历史记录失败。'),
      }
    }
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
    addPendingImages,
    applySettingsEdit: settingsActions.applySettingsEdit,
    canSendMessage,
    clearLastError,
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
    memory,
    modelOptions,
    openSettings: settingsActions.openSettings,
    pendingAttachments,
    pendingMemoryTurns,
    observeMemoryNow,
    pluginEnterSignal: hostLifecycle.enterSignal,
    recoverHistory,
    recoveryStatus,
    retryLastAssistantMessage: replyLifecycle.retry,
    retryableAssistantMessageId,
    thinkingLevel,
    thinkingOptions,
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
    updateActiveThinkingLevel,
    usageStatistics,
    usageStatisticsError,
  }
}
