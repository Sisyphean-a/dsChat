import { computed, nextTick, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { ChatMessage } from '../types/chat'

const AUTO_SCROLL_BOTTOM_GAP_PX = 48
const PROGRAMMATIC_SCROLL_EVENT_SKIP_COUNT = 2
interface UseMessageListAutoScrollOptions {
  activeConversationId: Ref<string | null>
  messages: Ref<ChatMessage[]>
}

export function useMessageListAutoScroll(options: UseMessageListAutoScrollOptions) {
  const { activeConversationId, messages } = options
  const messageListRef = ref<HTMLElement | null>(null)
  const releasedScrollMessageId = ref<string | null>(null)
  const previousScrollTop = ref<number | null>(null)
  const skippedProgrammaticScrollEvents = ref(0)

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
    return element.scrollHeight - element.scrollTop - element.clientHeight < AUTO_SCROLL_BOTTOM_GAP_PX
  }

  function handleMessageListScroll(): void {
    if (!messageListRef.value) {
      return
    }

    const currentTop = messageListRef.value.scrollTop
    const previousTop = previousScrollTop.value
    previousScrollTop.value = currentTop

    if (skippedProgrammaticScrollEvents.value > 0) {
      skippedProgrammaticScrollEvents.value -= 1
      return
    }

    if (!currentStreamingMessageId.value || previousTop === null) {
      return
    }

    if (currentTop < previousTop) {
      releasedScrollMessageId.value = currentStreamingMessageId.value
      return
    }

    if (isNearBottom(messageListRef.value)) {
      releasedScrollMessageId.value = null
    }
  }

  async function scrollToBottom(force = false): Promise<void> {
    await nextTick()
    if (!messageListRef.value) {
      return
    }

    if (!force && releasedScrollMessageId.value === currentStreamingMessageId.value) {
      return
    }

    skippedProgrammaticScrollEvents.value = PROGRAMMATIC_SCROLL_EVENT_SKIP_COUNT
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    previousScrollTop.value = messageListRef.value.scrollTop
  }

  watch(currentStreamingMessageId, (next, prev) => {
    if (next && next !== prev) {
      releasedScrollMessageId.value = null
    }
  })

  watch(activeConversationId, () => {
    releasedScrollMessageId.value = null
    previousScrollTop.value = messageListRef.value?.scrollTop ?? null
    void scrollToBottom(true)
  })

  watch(() => messageListRef.value, (element) => {
    previousScrollTop.value = element?.scrollTop ?? null
    skippedProgrammaticScrollEvents.value = 0
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
