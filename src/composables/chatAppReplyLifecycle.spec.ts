import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { buildDefaultSettings } from '../constants/providers'
import type { ChatMessage, MessageAttachment } from '../types/chat'
import { messageMapping } from '../services/ai/messageMapping'
import { createReplyLifecycle } from './chatAppReplyLifecycle'

describe('ReplyLifecycle', () => {
  it('updates the reply from an ordered fake stream and persists only initial and final states', async () => {
    const state = createState()
    const lifecycle = createReplyLifecycle({
      ...state,
      getAbortController: () => state.controller.value,
      messageMapping,
      notifyNewConversation: vi.fn(),
      openSettings: vi.fn(),
      providerStream: {
        async *stream() {
          yield { type: 'status' as const, status: '正在生成回答...' }
          yield { type: 'reasoning' as const, content: '先思考' }
          yield { type: 'content' as const, content: '再回答' }
        },
      },
      setAbortController: (controller) => { state.controller.value = controller },
      toolOrchestrator: { async *stream() { throw new Error('unexpected tool stream') } },
    })
    state.draftMessage.value = '你好'

    await lifecycle.send()

    expect(state.messages.value[1]).toMatchObject({
      content: '再回答', reasoningContent: '先思考', status: 'done',
    })
    expect(state.persistConversation).toHaveBeenCalledTimes(2)
  })

  it('prepends the configured system prompt to provider messages', async () => {
    const state = createState()
    state.settings.value.systemPrompt = '言简意赅，避免大段回复'
    const providerStream = {
      stream: vi.fn(async function* () {
        yield { type: 'content' as const, content: '好的' }
      }),
    }
    const lifecycle = createReplyLifecycle({
      ...state,
      getAbortController: () => state.controller.value,
      messageMapping,
      notifyNewConversation: vi.fn(),
      openSettings: vi.fn(),
      providerStream,
      setAbortController: (controller) => { state.controller.value = controller },
      toolOrchestrator: { async *stream() { throw new Error('unexpected tool stream') } },
    })
    state.draftMessage.value = '你好'

    await lifecycle.send()

    expect(providerStream.stream).toHaveBeenCalledWith(expect.objectContaining({
      messages: [
        { content: '言简意赅，避免大段回复', role: 'system' },
        { content: '你好', role: 'user' },
      ],
      thinkingLevel: 'high',
    }))
  })

  it('snapshots the system prompt when a reply starts', async () => {
    const state = createState()
    state.settings.value.systemPrompt = '第一次规则'
    let releaseStream: () => void = () => undefined
    let streamStarted = false
    const providerStream = {
      stream: vi.fn(async function* () {
        await new Promise<void>((resolve) => {
          streamStarted = true
          releaseStream = resolve
        })
        yield { type: 'content' as const, content: '好的' }
      }),
    }
    const lifecycle = createReplyLifecycle({
      ...state,
      getAbortController: () => state.controller.value,
      messageMapping,
      notifyNewConversation: vi.fn(),
      openSettings: vi.fn(),
      providerStream,
      setAbortController: (controller) => { state.controller.value = controller },
      toolOrchestrator: { async *stream() { throw new Error('unexpected tool stream') } },
    })
    state.draftMessage.value = '你好'

    const sending = lifecycle.send()
    await vi.waitFor(() => expect(streamStarted).toBe(true))
    state.settings.value.systemPrompt = '第二次规则'
    state.settings.value.deepseek.reasoningLevel = 'max'
    releaseStream()
    await sending

    expect(providerStream.stream).toHaveBeenCalledWith(expect.objectContaining({
      messages: [
        { content: '第一次规则', role: 'system' },
        { content: '你好', role: 'user' },
      ],
      thinkingLevel: 'high',
    }))
  })

  it('uses the configured system prompt for retries', async () => {
    const state = createState()
    state.activeConversationId.value = 'conversation-1'
    state.messages.value = [
      { content: '你好', createdAt: 1, id: 'user-1', role: 'user', status: 'done' },
      { content: '旧回复', createdAt: 2, id: 'assistant-1', role: 'assistant', status: 'done' },
    ]
    state.settings.value.systemPrompt = '言简意赅，避免大段回复'
    const providerStream = {
      stream: vi.fn(async function* () {
        yield { type: 'content' as const, content: '新的回复' }
      }),
    }
    const lifecycle = createReplyLifecycle({
      ...state,
      getAbortController: () => state.controller.value,
      messageMapping,
      notifyNewConversation: vi.fn(),
      openSettings: vi.fn(),
      providerStream,
      setAbortController: (controller) => { state.controller.value = controller },
      toolOrchestrator: { async *stream() { throw new Error('unexpected tool stream') } },
    })

    await lifecycle.retry()

    expect(providerStream.stream).toHaveBeenCalledWith(expect.objectContaining({
      messages: [
        { content: '言简意赅，避免大段回复', role: 'system' },
        { content: '你好', role: 'user' },
      ],
    }))
  })

  it('passes the system prompt into tool orchestration', async () => {
    const state = createState()
    state.settings.value.systemPrompt = '言简意赅，避免大段回复'
    state.settings.value.toolSettings.enabled = true
    const toolOrchestrator = {
      stream: vi.fn(async function* () {
        yield { type: 'content' as const, content: '已完成' }
      }),
    }
    const lifecycle = createReplyLifecycle({
      ...state,
      getAbortController: () => state.controller.value,
      messageMapping,
      notifyNewConversation: vi.fn(),
      openSettings: vi.fn(),
      providerStream: { async *stream() { throw new Error('unexpected provider stream') } },
      setAbortController: (controller) => { state.controller.value = controller },
      toolOrchestrator,
    })
    state.draftMessage.value = '你好'

    await lifecycle.send()

    expect(toolOrchestrator.stream).toHaveBeenCalledWith(expect.objectContaining({
      messages: [
        { content: '言简意赅，避免大段回复', role: 'system' },
        { content: '你好', role: 'user' },
      ],
    }))
  })

  it('does not request Provider data when initial persistence fails', async () => {
    const state = createState()
    state.persistConversation.mockRejectedValueOnce(new Error('存储失败'))
    const providerStream = { stream: vi.fn() }
    const lifecycle = createReplyLifecycle({
      ...state,
      getAbortController: () => state.controller.value,
      messageMapping,
      notifyNewConversation: vi.fn(),
      openSettings: vi.fn(),
      providerStream,
      setAbortController: (controller) => { state.controller.value = controller },
      toolOrchestrator: { async *stream() { throw new Error('unexpected tool stream') } },
    })
    state.draftMessage.value = '你好'

    await lifecycle.send()

    expect(providerStream.stream).not.toHaveBeenCalled()
    expect(state.messages.value[1]).toMatchObject({ content: '请求失败：存储失败', status: 'error' })
  })

  it('does not request Provider data after stop during initial persistence', async () => {
    const state = createState()
    let releasePersistence: () => void = () => undefined
    state.persistConversation.mockImplementationOnce(() => new Promise<undefined>((resolve) => {
      releasePersistence = () => resolve(undefined)
    }))
    const providerStream = { stream: vi.fn() }
    const lifecycle = createReplyLifecycle({
      ...state,
      getAbortController: () => state.controller.value,
      messageMapping,
      notifyNewConversation: vi.fn(),
      openSettings: vi.fn(),
      providerStream,
      setAbortController: (controller) => { state.controller.value = controller },
      toolOrchestrator: { async *stream() { throw new Error('unexpected tool stream') } },
    })
    state.draftMessage.value = '你好'

    const sending = lifecycle.send()
    await vi.waitFor(() => expect(state.controller.value).not.toBeNull())
    const stopping = lifecycle.stop()
    releasePersistence()
    await Promise.all([sending, stopping])

    expect(providerStream.stream).not.toHaveBeenCalled()
    expect(state.messages.value[1]).toMatchObject({ status: 'interrupted' })
  })
})

function createState() {
  const settings = buildDefaultSettings()
  return {
    activeConversationId: ref<string | null>(null),
    controller: ref<AbortController | null>(null),
    draftMessage: ref(''),
    interruptedResponseMessage: '本次响应已中断，请重新发送。',
    isSending: ref(false),
    lastError: ref<string | null>(null),
    messages: ref<ChatMessage[]>([]),
    pendingAttachments: ref<MessageAttachment[]>([]),
    persistConversation: vi.fn(async () => undefined),
    settings: ref({ ...settings, deepseek: { ...settings.deepseek, apiKey: 'sk-test' } }),
    stoppedResponseMessage: '已停止生成。',
  }
}
