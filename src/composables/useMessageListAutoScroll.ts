import { computed, getCurrentScope, nextTick, onScopeDispose, ref, watch } from 'vue'
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
  const lockedAnchorMessageId = ref<string | null>(null)
  const lockedAnchorOffsetTop = ref<number | null>(null)
  const isProgrammaticAdjustment = ref(false)
  const resizeObserver = createResizeObserver(() => {
    if (releasedForStreamingMessageId.value === currentStreamingMessageId.value) {
      syncLockedScrollPosition()
      return
    }

    syncAutoFollowScrollPosition()
  })

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
    if (!currentStreamingMessageId.value || !messageListRef.value) {
      return
    }

    releasedForStreamingMessageId.value = currentStreamingMessageId.value
    captureAnchorSnapshot()
  }

  function unlockCurrentStreamingAutoFollow(): void {
    if (releasedForStreamingMessageId.value !== currentStreamingMessageId.value) {
      return
    }

    releasedForStreamingMessageId.value = null
    resetAnchorSnapshot()
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

    if (isProgrammaticAdjustment.value) {
      return
    }

    if (!currentStreamingMessageId.value || previousTop === null) {
      return
    }

    if (currentTop < previousTop) {
      lockCurrentStreamingAutoFollow()
      return
    }

    if (currentTop > previousTop && isAtBottom(messageListRef.value)) {
      unlockCurrentStreamingAutoFollow()
      return
    }

    if (releasedForStreamingMessageId.value === currentStreamingMessageId.value) {
      captureAnchorSnapshot()
    }
  }

  async function scrollToBottom(force = false): Promise<void> {
    await nextTick()
    if (!messageListRef.value) {
      return
    }

    if (!force && releasedForStreamingMessageId.value === currentStreamingMessageId.value) {
      syncLockedScrollPosition()
      return
    }

    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    previousScrollTop.value = messageListRef.value.scrollTop
    resetAnchorSnapshot()
  }

  watch(currentStreamingMessageId, (next, prev) => {
    if (next && next !== prev) {
      releasedForStreamingMessageId.value = null
      resetAnchorSnapshot()
    }
  })

  watch(activeConversationId, () => {
    releasedForStreamingMessageId.value = null
    previousScrollTop.value = messageListRef.value?.scrollTop ?? null
    resetAnchorSnapshot()
    void scrollToBottom(true)
  })

  watch(() => messageListRef.value, (element) => {
    previousScrollTop.value = element?.scrollTop ?? null
    releasedForStreamingMessageId.value = null
    resetAnchorSnapshot()
    observeMessageItems()
  })

  watch(messageScrollSnapshot, () => {
    void scrollToBottom()
    void observeMessageItems()
  }, { flush: 'post' })

  if (getCurrentScope()) {
    onScopeDispose(() => {
      resizeObserver?.disconnect()
    })
  }

  return {
    handleMessageListScroll,
    handleMessageListWheel,
    messageListRef,
    scrollToBottom,
  }

  function syncLockedScrollPosition(): void {
    const element = messageListRef.value
    if (!element || releasedForStreamingMessageId.value !== currentStreamingMessageId.value) {
      return
    }

    const anchorElement = findLockedAnchorElement(element, lockedAnchorMessageId.value)
    if (!anchorElement || lockedAnchorOffsetTop.value === null) {
      return
    }

    const containerRect = resolveRect(element)
    const anchorRect = resolveRect(anchorElement)
    if (!containerRect || !anchorRect) {
      return
    }

    const delta = anchorRect.top - containerRect.top - lockedAnchorOffsetTop.value
    if (!delta) {
      return
    }

    applyProgrammaticScrollTop(element.scrollTop + delta)
  }

  function syncAutoFollowScrollPosition(): void {
    const element = messageListRef.value
    if (!element || !currentStreamingMessageId.value) {
      return
    }

    applyProgrammaticScrollTop(element.scrollHeight)
  }

  async function observeMessageItems(): Promise<void> {
    await nextTick()
    resizeObserver?.disconnect()
    if (!messageListRef.value || !resizeObserver) {
      return
    }

    const items = Array.from((messageListRef.value as HTMLElement & { children?: HTMLCollection }).children ?? [])
    for (const item of items) {
      resizeObserver.observe(item)
    }
  }

  function captureAnchorSnapshot(): void {
    const element = messageListRef.value
    if (!element) {
      return
    }

    const anchorElement = resolveVisibleAnchorElement(element)
    if (!anchorElement) {
      resetAnchorSnapshot()
      return
    }

    const containerRect = resolveRect(element)
    const anchorRect = resolveRect(anchorElement)
    const messageId = resolveMessageId(anchorElement)
    if (!containerRect || !anchorRect || !messageId) {
      resetAnchorSnapshot()
      return
    }

    lockedAnchorMessageId.value = messageId
    lockedAnchorOffsetTop.value = anchorRect.top - containerRect.top
  }

  function resetAnchorSnapshot(): void {
    lockedAnchorMessageId.value = null
    lockedAnchorOffsetTop.value = null
  }

  function applyProgrammaticScrollTop(nextScrollTop: number): void {
    const element = messageListRef.value
    if (!element) {
      return
    }

    isProgrammaticAdjustment.value = true
    element.scrollTop = nextScrollTop
    previousScrollTop.value = element.scrollTop
    queueMicrotask(() => {
      isProgrammaticAdjustment.value = false
    })
  }
}

function createResizeObserver(callback: () => void): ResizeObserver | null {
  if (typeof ResizeObserver === 'undefined') {
    return null
  }

  return new ResizeObserver(() => {
    callback()
  })
}

function findLockedAnchorElement(container: HTMLElement, messageId: string | null): HTMLElement | null {
  if (!messageId) {
    return null
  }

  const children = Array.from((container as HTMLElement & { children?: HTMLCollection }).children ?? [])
  return children.find((item) => {
    return resolveMessageId(item) === messageId
  }) as HTMLElement | null
}

function resolveVisibleAnchorElement(container: HTMLElement): HTMLElement | null {
  const containerRect = resolveRect(container)
  if (!containerRect) {
    return null
  }

  const children = Array.from((container as HTMLElement & { children?: HTMLCollection }).children ?? []) as HTMLElement[]
  return children.find((item) => {
    const rect = resolveRect(item)
    return Boolean(rect && rect.bottom > containerRect.top)
  }) ?? null
}

function resolveRect(element: Element): DOMRect | null {
  if (typeof (element as HTMLElement).getBoundingClientRect !== 'function') {
    return null
  }

  return (element as HTMLElement).getBoundingClientRect()
}

function resolveMessageId(element: Element): string | null {
  return (element as HTMLElement).dataset?.messageId ?? null
}
