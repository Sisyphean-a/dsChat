import { computed, ref } from 'vue'
import { createChatMessage, updateMessageById } from './chatAppMessages'
import { getSendSettingsError, normalizeSettings } from './chatAppSettings'
import {
  CHAT_IDLE_RESET_MS,
  MODEL_OPTIONS,
  SESSION_DOC_ID,
} from '../constants/app'
import { streamChatCompletion } from '../services/deepseek'
import {
  hasUtools,
  loadConversations,
  loadSession,
  loadSettings,
  saveConversation,
  saveSession,
  saveSettings,
} from '../services/utools'
import type { ChatMessage, ConversationDoc, SessionDoc, SettingsForm } from '../types/chat'
import {
  buildConversationDoc,
  cloneMessages,
  createConversationId,
  sortConversations,
} from '../utils/chat'
import { shouldResetConversation } from '../utils/session'

type SendFailureStage = 'initial-persist' | 'stream' | 'final-persist'

export function useChatApp() {
  const settings = ref<SettingsForm>({ apiKey: '', baseUrl: '', model: '' })
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

  const modelOptions = MODEL_OPTIONS
  const isBrowserMode = computed(() => !hasUtools())

  async function initialize(): Promise<void> {
    settings.value = await loadSettings()
    conversations.value = await loadConversations()
    messages.value = []

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

  function updateSettingsField(field: keyof SettingsForm, value: string): void {
    settings.value = {
      ...settings.value,
      [field]: value,
    }
  }

  async function saveSettingsAction(): Promise<void> {
    isSavingSettings.value = true

    try {
      const normalizedSettings = normalizeSettings(settings.value)
      settings.value = normalizedSettings
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

    activeConversationId.value = id
    messages.value = cloneMessages(target.messages)
  }

  async function sendMessage(): Promise<void> {
    const content = draftMessage.value.trim()
    if (!content || isSending.value) {
      return
    }

    const normalizedSettings = normalizeSettings(settings.value)
    const settingsError = getSendSettingsError(normalizedSettings)
    if (settingsError) {
      lastError.value = settingsError
      openSettings()
      return
    }

    if (!activeConversationId.value) {
      activeConversationId.value = createConversationId()
      messages.value = []
    }

    draftMessage.value = ''
    lastError.value = null
    isSending.value = true

    const userMessage = createChatMessage('user', content)
    const assistantMessage = createChatMessage('assistant', '')
    messages.value = [...messages.value, userMessage, assistantMessage]
    let failureStage: SendFailureStage = 'initial-persist'

    try {
      await persistConversation()
      failureStage = 'stream'

      await streamChatCompletion(messages.value.slice(0, -1), normalizedSettings, (chunk) => {
        messages.value = updateMessageById(messages.value, assistantMessage.id, (message) => {
          message.content += chunk
        })
      })

      messages.value = updateMessageById(messages.value, assistantMessage.id, (message) => {
        message.status = 'done'
      })

      failureStage = 'final-persist'
      await persistConversation()
    } catch (error) {
      await handleSendFailure(error, assistantMessage.id, failureStage === 'stream')
    } finally {
      isSending.value = false
    }
  }

  async function restoreSession(): Promise<void> {
    const session = await loadSession()
    if (!session) {
      return
    }

    if (session.lastOutAt !== null) {
      console.info(`距离上次离开已过：${Date.now() - session.lastOutAt} 毫秒`)
    }

    if (shouldResetConversation(session.lastOutAt, Date.now(), CHAT_IDLE_RESET_MS)) {
      startFreshConversation()
      await persistSession(null)
      return
    }

    if (!session.currentConversationId) {
      return
    }

    const target = conversations.value.find(
      (conversation) => conversation.id === session.currentConversationId,
    )
    if (!target) {
      return
    }

    activeConversationId.value = target.id
    messages.value = cloneMessages(target.messages)
  }

  function registerLifecycleHooks(): void {
    window.utools?.onPluginEnter(async () => {
      await restoreSession()
    })

    window.utools?.onPluginOut(async () => {
      const session: SessionDoc = {
        _id: SESSION_DOC_ID,
        type: 'session',
        currentConversationId: activeConversationId.value,
        lastOutAt: Date.now(),
      }
      await saveSession(session)
    })
  }

  async function persistConversation(): Promise<void> {
    if (!activeConversationId.value || !messages.value.length) {
      await persistSession(activeConversationId.value)
      return
    }

    const existing = conversations.value.find(
      (conversation) => conversation.id === activeConversationId.value,
    )
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

    if (shouldPersistFailureState) {
      try {
        await persistConversation()
      } catch (persistError) {
        const persistMessage = getErrorMessage(persistError, '会话记录写入失败。')
        lastError.value = `请求失败后写入会话记录失败：${persistMessage}`
      }
    }
  }

  function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback
  }

  return {
    activeConversationId,
    closeSettings,
    conversations,
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
    saveSettings: saveSettingsAction,
    selectConversation,
    sendMessage,
    settings,
    startFreshConversation,
    toggleSidebar,
    updateSettingsField,
  }
}
