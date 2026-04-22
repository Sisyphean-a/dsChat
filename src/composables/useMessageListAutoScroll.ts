import { computed, nextTick, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { ChatMessage } from '../types/chat'

const AUTO_SCROLL_UNLOCK_BOTTOM_GAP_PX = 2

interface UseMessageListAutoScrollOptions {
  activeConversationId: Ref<string | null>
  messages: Ref<ChatMessage[]>
}

export function useMessageListAutoScroll(options: UseMessageListAutoScrollOptions) {
  const { activeConversationId, messages } = options
  const messageListRef = ref<HTMLElement | null>(null)
  const previousScrollTop = ref<number | null>(null)
  const releasedForStreamingMessageId = ref<string | null>(null)

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

  function isAtBottom(element: HTMLElement): boolean {
    return element.scrollHeight - element.scrollTop - element.clientHeight <= AUTO_SCROLL_UNLOCK_BOTTOM_GAP_PX
  }

  function lockCurrentStreamingAutoFollow(): void {
    if (!currentStreamingMessageId.value) {
      return
    }

    releasedForStreamingMessageId.value = currentStreamingMessageId.value
  }

  function unlockCurrentStreamingAutoFollow(): void {
    if (releasedForStreamingMessageId.value !== currentStreamingMessageId.value) {
      return
    }

    releasedForStreamingMessageId.value = null
  }

  function handleMessageListWheel(event: WheelEvent): void {
    if (!messageListRef.value || !currentStreamingMessageId.value) {
      return
    }

    if (event.deltaY < 0) {
      lockCurrentStreamingAutoFollow()
    }
  }

  function handleMessageListScroll(): void {
    if (!messageListRef.value) {
      return
    }

    const currentTop = messageListRef.value.scrollTop
    const previousTop = previousScrollTop.value
    previousScrollTop.value = currentTop

    if (!currentStreamingMessageId.value || previousTop === null) {
      return
    }

    if (currentTop < previousTop) {
      lockCurrentStreamingAutoFollow()
      return
    }

    if (currentTop > previousTop && isAtBottom(messageListRef.value)) {
      unlockCurrentStreamingAutoFollow()
    }
  }

  async function scrollToBottom(force = false): Promise<void> {
    await nextTick()
    if (!messageListRef.value) {
      return
    }

    if (!force && releasedForStreamingMessageId.value === currentStreamingMessageId.value) {
      return
    }

    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    previousScrollTop.value = messageListRef.value.scrollTop
  }

  watch(currentStreamingMessageId, (next, prev) => {
    if (next && next !== prev) {
      releasedForStreamingMessageId.value = null
    }
  })

  watch(activeConversationId, () => {
    releasedForStreamingMessageId.value = null
    previousScrollTop.value = messageListRef.value?.scrollTop ?? null
    void scrollToBottom(true)
  })

  watch(() => messageListRef.value, (element) => {
    previousScrollTop.value = element?.scrollTop ?? null
    releasedForStreamingMessageId.value = null
  })

  watch(messageScrollSnapshot, () => {
    void scrollToBottom()
  }, { flush: 'post' })

  return {
    handleMessageListScroll,
    handleMessageListWheel,
    messageListRef,
    scrollToBottom,
  }
}
