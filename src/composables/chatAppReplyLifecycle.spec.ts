import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { buildDefaultSettings } from '../constants/providers'
import { messageMapping } from '../services/ai/messageMapping'
import { createReplyLifecycle } from './chatAppReplyLifecycle'

describe('ReplyLifecycle', () => {
  it('updates the reply from an ordered fake stream and persists only initial and final states', async () => {
    const state = createState()
    const lifecycle = createReplyLifecycle({
      ...state,
      getAbortController: () => state.controller.value,
      getThinkingEnabled: () => true,
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

  it('does not request Provider data when initial persistence fails', async () => {
    const state = createState()
    state.persistConversation.mockRejectedValueOnce(new Error('存储失败'))
    const providerStream = { stream: vi.fn() }
    const lifecycle = createReplyLifecycle({
      ...state,
      getAbortController: () => state.controller.value,
      getThinkingEnabled: () => true,
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
      getThinkingEnabled: () => true,
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
    messages: ref([]),
    pendingAttachments: ref([]),
    persistConversation: vi.fn(async () => undefined),
    settings: ref({ ...settings, deepseek: { ...settings.deepseek, apiKey: 'sk-test' } }),
    stoppedResponseMessage: '已停止生成。',
  }
}
