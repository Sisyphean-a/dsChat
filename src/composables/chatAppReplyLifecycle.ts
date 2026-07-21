import type { Ref } from 'vue'
import type { ActiveProviderSettings, ChatMessage, MessageAttachment, SettingsForm, ToolSettings } from '../types/chat'
import { providerSupportsNativeWebSearch, providerSupportsToolCalling } from '../constants/providerCapabilities'
import type { MessageMapping } from '../services/ai/messageMapping'
import type { ProviderConversationMessage } from '../services/ai/providerAdapter'
import { ProviderStreamStoppedError, type ProviderStream } from '../services/ai/providerStream'
import type { ReplyStreamEvent, ToolOrchestrator } from '../services/ai/toolOrchestrator'
import { createConversationId } from '../utils/chat'
import { getErrorMessage } from './chatAppErrors'
import { createChatMessage } from './chatAppMessages'
import {
  applyReplyEvent,
  failReply,
  finishReply,
  finishStoppedReply,
  persistTerminalReply,
  resetReply,
  type ReplyMessageState,
} from './chatAppReplyMessages'
import { buildRequestMessages, prepareRetryRequest } from './chatAppRetry'
import { prepareSendRequest, type SendPreparation } from './chatAppSendHelpers'

interface ReplyLifecycleOptions {
  activeConversationId: Ref<string | null>
  draftMessage: Ref<string>
  getAbortController: () => AbortController | null
  getThinkingEnabled: (provider: ActiveProviderSettings['provider']) => boolean
  interruptedResponseMessage: string
  isSending: Ref<boolean>
  lastError: Ref<string | null>
  messageMapping: MessageMapping
  messages: Ref<ChatMessage[]>
  notifyNewConversation: (conversationId: string, firstMessageContent: string, settings: ActiveProviderSettings) => void
  openSettings: () => void
  pendingAttachments: Ref<MessageAttachment[]>
  persistConversation: () => Promise<void>
  providerStream: ProviderStream
  setAbortController: (controller: AbortController | null) => void
  settings: Ref<SettingsForm>
  stoppedResponseMessage: string
  toolOrchestrator: ToolOrchestrator
}

export interface ReplyLifecycle {
  interrupt: (fallback?: string) => Promise<void>
  retry: () => Promise<void>
  send: () => Promise<void>
  stop: () => Promise<void>
}

interface LifecycleState extends ReplyMessageState {
  activeReply: Promise<void> | null
  options: ReplyLifecycleOptions
  stopFallback: string
}

interface ReplyRequest {
  assistantId: string
  settings: ActiveProviderSettings
  thinkingEnabled: boolean
  toolSettings: ToolSettings
}

interface ReplyStart {
  controller: AbortController
  isNew: boolean
  snapshot: ReplyRequest
}

export function createReplyLifecycle(options: ReplyLifecycleOptions): ReplyLifecycle {
  const state: LifecycleState = {
    activeReply: null,
    lastError: options.lastError,
    messages: options.messages,
    options,
    persistConversation: options.persistConversation,
    stopFallback: options.interruptedResponseMessage,
  }
  return {
    interrupt: (fallback) => interruptReply(state, fallback),
    retry: () => runActive(state, () => retryReply(state)),
    send: () => runActive(state, () => sendReply(state)),
    stop: () => interruptReply(state, options.stoppedResponseMessage),
  }
}

async function sendReply(state: LifecycleState): Promise<void> {
  const prepared = prepareSendRequest({
    draftMessage: state.options.draftMessage,
    getThinkingEnabled: state.options.getThinkingEnabled,
    isSending: state.options.isSending,
    lastError: state.options.lastError,
    openSettings: state.options.openSettings,
    pendingAttachments: state.options.pendingAttachments,
    settings: state.options.settings,
  })
  if (!prepared) return

  const start = startNewReply(state, prepared)
  if (!await persistInitialReply(state, start.snapshot.assistantId)) return
  if (start.controller.signal.aborted) return finishStoppedBeforeStream(state)
  if (start.isNew) notifyNewConversation(state, prepared.content, start.snapshot.settings)
  await consumeReply(state, start.snapshot, start.controller)
}

async function retryReply(state: LifecycleState): Promise<void> {
  const prepared = prepareRetryRequest({
    getThinkingEnabled: state.options.getThinkingEnabled,
    isSending: state.options.isSending,
    lastError: state.options.lastError,
    messages: state.options.messages,
    openSettings: state.options.openSettings,
    settings: state.options.settings,
  })
  if (!prepared) return

  resetReply(state, prepared.assistantId)
  state.options.isSending.value = true
  const start = createReplyStart(prepared.assistantId, prepared)
  state.options.setAbortController(start.controller)
  if (!await persistInitialReply(state, prepared.assistantId)) return
  if (start.controller.signal.aborted) return finishStoppedBeforeStream(state)
  await consumeReply(state, start.snapshot, start.controller)
}

function startNewReply(state: LifecycleState, prepared: SendPreparation): ReplyStart {
  const isNew = !state.options.activeConversationId.value
  if (isNew) {
    state.options.activeConversationId.value = createConversationId()
    state.options.messages.value = []
  }
  const user = createChatMessage('user', prepared.content, prepared.attachments)
  const assistant = createChatMessage('assistant', '')
  state.options.messages.value = [...state.options.messages.value, user, assistant]
  state.options.draftMessage.value = ''
  state.options.pendingAttachments.value = []
  state.options.lastError.value = null
  state.options.isSending.value = true

  const start = createReplyStart(assistant.id, prepared)
  state.options.setAbortController(start.controller)
  return { ...start, isNew }
}

function createReplyStart(
  assistantId: string,
  prepared: Pick<SendPreparation, 'activeSettings' | 'thinkingEnabled' | 'toolSettings'>,
): ReplyStart {
  return {
    controller: new AbortController(),
    isNew: false,
    snapshot: {
      assistantId,
      settings: structuredClone(prepared.activeSettings),
      thinkingEnabled: prepared.thinkingEnabled,
      toolSettings: structuredClone(prepared.toolSettings),
    },
  }
}

async function persistInitialReply(state: LifecycleState, assistantId: string): Promise<boolean> {
  try {
    await state.options.persistConversation()
    return true
  } catch (error) {
    failReply(state, assistantId, getErrorMessage(error, '会话记录写入失败。'))
    cleanupReply(state)
    return false
  }
}

function notifyNewConversation(
  state: LifecycleState,
  content: string,
  settings: ActiveProviderSettings,
): void {
  state.options.notifyNewConversation(state.options.activeConversationId.value as string, content, settings)
}

async function interruptReply(state: LifecycleState, fallback?: string): Promise<void> {
  if (!state.options.isSending.value) return
  state.stopFallback = fallback ?? state.options.interruptedResponseMessage
  state.options.getAbortController()?.abort()
  await state.activeReply
}

function runActive(state: LifecycleState, operation: () => Promise<void>): Promise<void> {
  const task = operation()
  state.activeReply = task
  return task.finally(() => {
    if (state.activeReply === task) state.activeReply = null
  })
}

async function consumeReply(
  state: LifecycleState,
  request: ReplyRequest,
  controller: AbortController,
): Promise<void> {
  try {
    for await (const event of chooseReplyStream(state, request, controller.signal)) {
      applyReplyEvent(state, request.assistantId, event)
    }
    finishReply(state, request.assistantId)
    await persistTerminalReply(state, '会话记录写入失败。')
  } catch (error) {
    await handleReplyError(state, request.assistantId, controller, error)
  } finally {
    cleanupReply(state)
  }
}

function chooseReplyStream(
  state: LifecycleState,
  request: ReplyRequest,
  signal: AbortSignal,
): AsyncIterable<ReplyStreamEvent> {
  const messages = state.options.messageMapping.toProviderConversationMessages(
    buildRequestMessages(state.options.messages.value.slice(0, -1)),
  )
  if (request.toolSettings.enabled && providerSupportsToolCalling(request.settings)) {
    return state.options.toolOrchestrator.stream({ ...request, messages, signal })
  }
  if (request.toolSettings.enabled && !providerSupportsNativeWebSearch(request.settings)) {
    throw new Error(`${request.settings.label} 当前配置暂不支持工具调用。`)
  }
  return streamDirectReply(state.options.providerStream, { ...request, messages, signal })
}

async function* streamDirectReply(
  providerStream: ProviderStream,
  request: ReplyRequest & { messages: ProviderConversationMessage[]; signal: AbortSignal },
): AsyncGenerator<ReplyStreamEvent> {
  for await (const event of providerStream.stream({ ...request, tools: [] })) yield event
}

async function handleReplyError(
  state: LifecycleState,
  assistantId: string,
  controller: AbortController,
  error: unknown,
): Promise<void> {
  if (controller.signal.aborted || error instanceof ProviderStreamStoppedError) {
    await finishStoppedReply(state, state.stopFallback)
    return
  }
  failReply(state, assistantId, getErrorMessage(error, '请求失败'))
  await persistTerminalReply(state, '请求失败后写入会话记录失败。')
}

async function finishStoppedBeforeStream(state: LifecycleState): Promise<void> {
  await finishStoppedReply(state, state.stopFallback)
  cleanupReply(state)
}

function cleanupReply(state: LifecycleState): void {
  state.options.isSending.value = false
  state.options.setAbortController(null)
  state.stopFallback = state.options.interruptedResponseMessage
}
