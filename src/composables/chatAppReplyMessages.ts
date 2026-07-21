import type { Ref } from 'vue'
import type { ChatMessage } from '../types/chat'
import type { ReplyStreamEvent } from '../services/ai/toolOrchestrator'
import { getErrorMessage } from './chatAppErrors'
import { finalizeStreamingMessages, updateMessageById } from './chatAppMessages'

export interface ReplyMessageState {
  lastError: Ref<string | null>
  messages: Ref<ChatMessage[]>
  persistConversation: () => Promise<void>
}

export function applyReplyEvent(state: ReplyMessageState, assistantId: string, event: ReplyStreamEvent): void {
  updateAssistant(state, assistantId, (message) => {
    if (event.type === 'content') message.content += event.content
    if (event.type === 'reasoning') message.reasoningContent = `${message.reasoningContent ?? ''}${event.content}`
    if (event.type === 'status') message.streamingStatus = event.status
    if (event.type === 'tool-trace') message.toolTraces = mergeById(message.toolTraces ?? [], event.trace)
    if (event.type === 'timeline') message.processTimeline = mergeById(message.processTimeline ?? [], event.item)
  })
}

export function finishReply(state: ReplyMessageState, assistantId: string): void {
  updateAssistant(state, assistantId, (message) => {
    message.status = 'done'
    message.streamingStatus = undefined
  })
}

export function resetReply(state: ReplyMessageState, assistantId: string): void {
  updateAssistant(state, assistantId, (message) => {
    message.content = ''
    message.processTimeline = undefined
    message.reasoningContent = undefined
    message.status = 'streaming'
    message.streamingStatus = '正在生成回答...'
    message.toolTraces = undefined
  })
  state.lastError.value = null
}

export function failReply(state: ReplyMessageState, assistantId: string, error: string): void {
  updateAssistant(state, assistantId, (assistant) => {
    assistant.content = assistant.content || `请求失败：${error}`
    assistant.status = 'error'
    assistant.streamingStatus = undefined
  })
  state.lastError.value = error
}

export async function finishStoppedReply(state: ReplyMessageState, fallback: string): Promise<void> {
  const restored = finalizeStreamingMessages(state.messages.value, fallback)
  state.messages.value = restored.messages
  await persistTerminalReply(state, '会话记录写入失败。')
}

export async function persistTerminalReply(state: ReplyMessageState, fallback: string): Promise<void> {
  try {
    await state.persistConversation()
  } catch (error) {
    state.lastError.value = getErrorMessage(error, fallback)
  }
}

function updateAssistant(
  state: ReplyMessageState,
  id: string,
  mutate: (message: ChatMessage) => void,
): void {
  state.messages.value = updateMessageById(state.messages.value, id, mutate)
}

function mergeById<T extends { id: string }>(items: T[], next: T): T[] {
  const index = items.findIndex((item) => item.id === next.id)
  if (index < 0) return [...items, { ...next }]
  const result = [...items]
  result[index] = { ...next }
  return result
}
