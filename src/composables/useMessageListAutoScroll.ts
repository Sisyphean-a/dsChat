import { computed, nextTick, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { ChatMessage } from '../types/chat'

interface UseMessageListAutoScrollOptions {
  activeConversationId: Ref<string | null>
  messages: Ref<ChatMessage[]>
}

export function useMessageListAutoScroll(options: UseMessageListAutoScrollOptions) {
  const { activeConversationId, messages } = options
  const messageListRef = ref<HTMLElement | null>(null)
  const releasedScrollMessageId = ref<string | null>(null)

  const currentStreamingMessageId = computed(() => {
    for (let index = messages.value.length - 1; index >= 0; index -= 1) {
      const message = messages.value[index]
      if (message?.status === 'streaming') {
        return message.id
      }
    }

    return null
  })

  const messageScrollSnapshot = computed(() => {
    const last = messages.value.at(-1)
    return [
      activeConversationId.value ?? 'empty',
      messages.value.length,
      last?.id ?? 'none',
      last?.status ?? 'none',
      last?.content.length ?? 0,
      last?.reasoningContent?.length ?? 0,
    ].join(':')
  })

  function isNearBottom(element: HTMLElement): boolean {
    return element.scrollHeight - element.scrollTop - element.clientHeight < 48
  }

  function handleMessageListScroll(): void {
    if (!messageListRef.value || !currentStreamingMessageId.value) {
      return
    }

    releasedScrollMessageId.value = isNearBottom(messageListRef.value)
      ? null
      : currentStreamingMessageId.value
  }

  async function scrollToBottom(force = false): Promise<void> {
    await nextTick()
    if (!messageListRef.value) {
      return
    }

    if (!force && releasedScrollMessageId.value === currentStreamingMessageId.value) {
      return
    }

    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
  }

  watch(currentStreamingMessageId, (next, prev) => {
    if (next && next !== prev) {
      releasedScrollMessageId.value = null
    }
  })

  watch(activeConversationId, () => {
    releasedScrollMessageId.value = null
    void scrollToBottom(true)
  })

  watch(messageScrollSnapshot, () => {
    void scrollToBottom()
  }, { flush: 'post' })

  return {
    handleMessageListScroll,
    messageListRef,
    scrollToBottom,
  }
}
