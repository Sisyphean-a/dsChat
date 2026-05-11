import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { buildDefaultSettings } from '../constants/providers'
import type { ChatMessage } from '../types/chat'
import { createChatAppSendActions } from './chatAppSendActions'

describe('createChatAppSendActions', () => {
  it('retries the latest failed assistant reply without appending another user message', async () => {
    const streamChatCompletion = vi.fn(async (_messages, _settings, onDelta) => {
      onDelta({ content: '重试成功。' })
      return '重试成功。'
    })
    const persistConversation = vi.fn(async () => undefined)
    const state = createState([
      createUserMessage('u-1', '上一个问题'),
      createAssistantMessage('a-1', '请求失败：Failed to fetch', 'error'),
    ])
    const actions = createChatAppSendActions({
      activeConversationId: state.activeConversationId,
      applyGeneratedConversationTitle: vi.fn(async () => undefined),
      draftMessage: ref(''),
      getAbortController: () => state.abortController.value,
      getThinkingEnabled: () => true,
      interruptedResponseMessage: '本次响应已中断，请重新发送。',
      isSending: state.isSending,
      lastError: state.lastError,
      messages: state.messages,
      openSettings: vi.fn(),
      pendingAttachments: ref([]),
      persistConversation,
      requestConversationTitle: vi.fn(async () => '标题'),
      setAbortController: (controller) => {
        state.abortController.value = controller
      },
      settings: ref(createSettings()),
      stoppedResponseMessage: '已停止生成。',
      streamChatCompletion,
    })

    await actions.retryLastAssistantMessage()

    expect(streamChatCompletion).toHaveBeenCalledWith(
      [expect.objectContaining({
        id: 'u-1',
        content: '上一个问题',
        role: 'user',
      })],
      expect.objectContaining({
        provider: 'deepseek',
      }),
      expect.any(Function),
      expect.any(AbortSignal),
      { thinkingEnabled: true },
    )
    expect(state.messages.value).toHaveLength(2)
    expect(state.messages.value[0]?.id).toBe('u-1')
    expect(state.messages.value[1]).toMatchObject({
      id: 'a-1',
      content: '重试成功。',
      status: 'done',
    })
    expect(state.lastError.value).toBeNull()
    expect(persistConversation).toHaveBeenCalledTimes(2)
  })

  it('ignores retry when the latest message is not an assistant reply', async () => {
    const streamChatCompletion = vi.fn(async () => '不会触发')
    const state = createState([
      createUserMessage('u-1', '普通消息'),
      createAssistantMessage('a-1', '正常回复', 'done'),
      createUserMessage('u-2', '后续追问'),
    ])
    const actions = createChatAppSendActions({
      activeConversationId: state.activeConversationId,
      applyGeneratedConversationTitle: vi.fn(async () => undefined),
      draftMessage: ref(''),
      getAbortController: () => state.abortController.value,
      getThinkingEnabled: () => true,
      interruptedResponseMessage: '本次响应已中断，请重新发送。',
      isSending: state.isSending,
      lastError: state.lastError,
      messages: state.messages,
      openSettings: vi.fn(),
      pendingAttachments: ref([]),
      persistConversation: vi.fn(async () => undefined),
      requestConversationTitle: vi.fn(async () => '标题'),
      setAbortController: (controller) => {
        state.abortController.value = controller
      },
      settings: ref(createSettings()),
      stoppedResponseMessage: '已停止生成。',
      streamChatCompletion,
    })

    await actions.retryLastAssistantMessage()

    expect(streamChatCompletion).not.toHaveBeenCalled()
    expect(state.messages.value[2]).toMatchObject({
      id: 'u-2',
      content: '后续追问',
      status: 'done',
      role: 'user',
    })
  })
})

function createState(messages: ChatMessage[]) {
  return {
    abortController: ref<AbortController | null>(null),
    activeConversationId: ref('conversation-1'),
    isSending: ref(false),
    lastError: ref<string | null>('Failed to fetch'),
    messages: ref(messages),
  }
}

function createSettings() {
  const settings = buildDefaultSettings()
  return {
    ...settings,
    deepseek: {
      ...settings.deepseek,
      apiKey: 'sk-test',
    },
  }
}

function createUserMessage(id: string, content: string): ChatMessage {
  return {
    id,
    content,
    createdAt: 1,
    role: 'user',
    status: 'done',
  }
}

function createAssistantMessage(
  id: string,
  content: string,
  status: ChatMessage['status'],
): ChatMessage {
  return {
    id,
    content,
    createdAt: 2,
    role: 'assistant',
    status,
  }
}
