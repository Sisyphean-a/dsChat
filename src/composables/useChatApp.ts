import { computed, ref } from 'vue'
import { createAddedModelDraft } from '../constants/providers'
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
  saveSettings,
} from '../services/utools'
import type {
  ActiveProviderSettings,
  AddableProviderId,
  ChatMessage,
  ConversationDoc,
  ProviderSettings,
  SessionDoc,
  SettingsForm,
  ThemeMode,
} from '../types/chat'
import { shouldResetConversation } from '../utils/session'
import { buildConversationDoc, cloneMessages, createConversationId, sortConversations } from '../utils/chat'
import { createChatMessage, finalizeStreamingMessages, updateMessageById } from './chatAppMessages'
import {
  getActiveProviderSettings,
  getActiveModelSelectionOptions,
  getSendSettingsError,
  normalizeSettings,
} from './chatAppSettings'

type SendFailureStage = 'initial-persist' | 'stream' | 'final-persist'
type CustomModelField = keyof ProviderSettings | 'name'

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

  function openSettings(): void {
    isSettingsOpen.value = true
  }

  function closeSettings(): void {
    isSettingsOpen.value = false
  }

  function toggleSidebar(): void {
    isSidebarCollapsed.value = !isSidebarCollapsed.value
  }

  function selectActiveConfig(configId: string): void {
    settings.value = {
      ...settings.value,
      activeConfigId: configId,
    }
  }

  function updateDeepseekField(
    field: keyof ProviderSettings,
    value: ProviderSettings[keyof ProviderSettings],
  ): void {
    settings.value = {
      ...settings.value,
      deepseek: {
        ...settings.value.deepseek,
        [field]: value,
      },
    }
  }

  function selectActiveModel(model: string): void {
    if (settings.value.activeConfigId === 'deepseek') {
      updateDeepseekField('model', model)
      return
    }

    updateCustomModelField(settings.value.activeConfigId, 'model', model)
  }

  function addCustomModel(provider: AddableProviderId): void {
    const nextModel = createAddedModelDraft(provider, settings.value.customModels)
    settings.value = {
      ...settings.value,
      customModels: [...settings.value.customModels, nextModel],
    }
  }

  function removeCustomModel(id: string): void {
    const customModels = settings.value.customModels.filter((item) => item.id !== id)
    settings.value = {
      ...settings.value,
      activeConfigId: settings.value.activeConfigId === id ? 'deepseek' : settings.value.activeConfigId,
      customModels,
    }
  }

  function updateCustomModelField(
    id: string,
    field: CustomModelField,
    value: string | number,
  ): void {
    settings.value = {
      ...settings.value,
      customModels: settings.value.customModels.map((item) => {
        if (item.id !== id) {
          return item
        }

        return {
          ...item,
          [field]: value,
        }
      }),
    }
  }

  function updateTheme(theme: ThemeMode): void {
    const nextSettings = {
      ...settings.value,
      theme,
    }
    settings.value = nextSettings
    applyTheme(normalizeSettings(nextSettings).theme)
  }

  async function saveSettingsAction(): Promise<void> {
    isSavingSettings.value = true

    try {
      const normalizedSettings = normalizeSettings(settings.value)
      settings.value = normalizedSettings
      applyTheme(normalizedSettings.theme)
      await saveSettings(normalizedSettings)
      isSettingsOpen.value = false
      lastError.value = null
    } catch (error) {
      lastError.value = getErrorMessage(error, '设置保存失败。')
    } finally {
      isSavingSettings.value = false
    }
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
    await persistSession(null)
  }

  async function sendMessage(): Promise<void> {
    const content = draftMessage.value.trim()
    if (!content || isSending.value) {
      return
    }

    const normalizedSettings = normalizeSettings(settings.value)
    const activeSettings = getActiveProviderSettings(normalizedSettings)
    const settingsError = getSendSettingsError(normalizedSettings)
    if (settingsError) {
      lastError.value = settingsError
      openSettings()
      return
    }

    const isNewConversation = !activeConversationId.value
    if (!activeConversationId.value) {
      activeConversationId.value = createConversationId()
      messages.value = []
    }

    const currentConversationId = activeConversationId.value as string
    draftMessage.value = ''
    lastError.value = null
    isSending.value = true

    const abortController = new AbortController()
    activeAbortController = abortController

    const userMessage = createChatMessage('user', content)
    const assistantMessage = createChatMessage('assistant', '')
    messages.value = [...messages.value, userMessage, assistantMessage]

    let failureStage: SendFailureStage = 'initial-persist'

    try {
      await persistConversation()
      if (isNewConversation) {
        generateConversationTitle(currentConversationId, content, activeSettings).catch(console.error)
      }

      failureStage = 'stream'
      await streamChatCompletion(
        messages.value.slice(0, -1),
        activeSettings,
        (delta) => {
          messages.value = updateMessageById(messages.value, assistantMessage.id, (message) => {
            if (delta.reasoningContent) {
              message.reasoningContent = `${message.reasoningContent ?? ''}${delta.reasoningContent}`
            }

            if (delta.content) {
              message.content += delta.content
            }
          })
        },
        abortController.signal,
      )

      messages.value = updateMessageById(messages.value, assistantMessage.id, (message) => {
        message.status = 'done'
      })
      failureStage = 'final-persist'
      await persistConversation()
    } catch (error) {
      if (isAbortError(error)) {
        await handleInterruptedReply(assistantMessage.id)
        return
      }

      await handleSendFailure(error, assistantMessage.id, failureStage === 'stream')
    } finally {
      isSending.value = false
      activeAbortController = null
    }
  }

  async function restoreSession(): Promise<void> {
    const session = await loadSession()
    if (!session) {
      return
    }

    if (shouldResetConversation(session.lastOutAt, Date.now(), CHAT_IDLE_RESET_MS)) {
      startFreshConversation()
      await persistSession(null)
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
      await interruptActiveSend(INTERRUPTED_RESPONSE_MESSAGE)
      const session: SessionDoc = {
        _id: SESSION_DOC_ID,
        type: 'session',
        currentConversationId: activeConversationId.value,
        lastOutAt: Date.now(),
      }
      await saveSession(session)
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
      await persistConversation()
    } catch (error) {
      lastError.value = getErrorMessage(error, '会话记录修复失败。')
    }
  }

  async function persistConversation(): Promise<void> {
    if (!activeConversationId.value || !messages.value.length) {
      await persistSession(activeConversationId.value)
      return
    }

    const existing = conversations.value.find((conversation) => conversation.id === activeConversationId.value)
    const saved = await saveConversation(
      buildConversationDoc(activeConversationId.value, cloneMessages(messages.value), existing),
    )

    conversations.value = sortConversations([
      saved,
      ...conversations.value.filter((conversation) => conversation.id !== saved.id),
    ])

    await persistSession(saved.id)
  }

  async function persistSession(conversationId: string | null): Promise<void> {
    const session: SessionDoc = {
      _id: SESSION_DOC_ID,
      type: 'session',
      currentConversationId: conversationId,
      lastOutAt: null,
    }

    await saveSession(session)
  }

  async function interruptActiveSend(fallback = INTERRUPTED_RESPONSE_MESSAGE): Promise<void> {
    if (!isSending.value) {
      return
    }

    const restored = finalizeStreamingMessages(messages.value, fallback)
    messages.value = restored.messages
    activeAbortController?.abort()

    if (!restored.changed) {
      return
    }

    try {
      await persistConversation()
    } catch (error) {
      lastError.value = getErrorMessage(error, '会话记录写入失败。')
    }
  }

  async function handleInterruptedReply(assistantMessageId: string): Promise<void> {
    const target = messages.value.find((message) => message.id === assistantMessageId)
    if (!target || target.status === 'interrupted') {
      return
    }

    messages.value = updateMessageById(messages.value, assistantMessageId, (draft) => {
      draft.content = draft.content.trim() ? draft.content : INTERRUPTED_RESPONSE_MESSAGE
      draft.status = 'interrupted'
    })

    await persistConversation()
  }

  async function handleSendFailure(
    error: unknown,
    assistantMessageId: string,
    shouldPersistFailureState: boolean,
  ): Promise<void> {
    const message = getErrorMessage(error, '请求失败')
    messages.value = updateMessageById(messages.value, assistantMessageId, (draft) => {
      draft.content = draft.content || `请求失败：${message}`
      draft.status = 'error'
    })
    lastError.value = message

    if (!shouldPersistFailureState) {
      return
    }

    try {
      await persistConversation()
    } catch (persistError) {
      const persistMessage = getErrorMessage(persistError, '会话记录写入失败。')
      lastError.value = `请求失败后写入会话记录失败：${persistMessage}`
    }
  }

  async function generateConversationTitle(
    conversationId: string,
    firstMessageContent: string,
    settingsSnapshot: ActiveProviderSettings,
  ): Promise<void> {
    try {
      if (isBrowserMode.value) {
        return
      }

      const newTitle = await requestConversationTitle(settingsSnapshot, firstMessageContent)
      const index = conversations.value.findIndex((conversation) => conversation.id === conversationId)
      if (index === -1) {
        return
      }

      conversations.value[index].title = newTitle
      await saveConversation(conversations.value[index])
      conversations.value = [...conversations.value]
    } catch (error) {
      console.warn('Failed to generate automatic title:', error)
    }
  }

  async function stopGenerating(): Promise<void> {
    await interruptActiveSend(STOPPED_RESPONSE_MESSAGE)
  }

  return {
    activeChatConfig,
    activeConversationId,
    addCustomModel,
    closeSettings,
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
    openSettings,
    removeCustomModel,
    saveSettings: saveSettingsAction,
    selectActiveConfig,
    selectActiveModel,
    selectConversation,
    sendMessage,
    settings,
    stopGenerating,
    startFreshConversation,
    toggleSidebar,
    updateCustomModelField,
    updateDeepseekField,
    updateTheme,
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'name' in error
    && error.name === 'AbortError'
}
