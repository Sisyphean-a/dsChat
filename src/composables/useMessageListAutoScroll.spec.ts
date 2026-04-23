import { nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '../types/chat'
import { useMessageListAutoScroll } from './useMessageListAutoScroll'

describe('useMessageListAutoScroll', () => {
  let resizeObserverCallback: ResizeObserverCallback | null = null

  beforeEach(() => {
    resizeObserverCallback = null
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback
      }

      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('releases auto-follow for current stream on slight upward user scroll', async () => {
    const activeConversationId = ref<string | null>('c1')
    const messages = ref<ChatMessage[]>(createStreamingMessages('a'))
    const autoScroll = useMessageListAutoScroll({
      activeConversationId,
      messages,
    })

    const list = createMessageListElement({
      clientHeight: 500,
      scrollHeight: 2000,
      scrollTop: 1500,
    })
    autoScroll.messageListRef.value = list
    await flushWatchers()

    list.scrollTop = 1499
    autoScroll.handleMessageListScroll()

    setScrollHeight(list, 2100)
    messages.value = createStreamingMessages('ab')
    await flushWatchers()

    expect(list.scrollTop).toBe(1499)
  })

  it('restores auto-follow when user scrolls back near bottom', async () => {
    const activeConversationId = ref<string | null>('c1')
    const messages = ref<ChatMessage[]>(createStreamingMessages('a'))
    const autoScroll = useMessageListAutoScroll({
      activeConversationId,
      messages,
    })

    const list = createMessageListElement({
      clientHeight: 500,
      scrollHeight: 2000,
      scrollTop: 1500,
    })
    autoScroll.messageListRef.value = list
    await flushWatchers()

    list.scrollTop = 1499
    autoScroll.handleMessageListScroll()

    list.scrollTop = 2000
    autoScroll.handleMessageListScroll()

    setScrollHeight(list, 2200)
    messages.value = createStreamingMessages('abc')
    await flushWatchers()

    expect(list.scrollTop).toBe(2200)
  })

  it('still releases auto-follow after resume even when a programmatic scroll event happened first', async () => {
    const activeConversationId = ref<string | null>('c1')
    const messages = ref<ChatMessage[]>(createStreamingMessages('a'))
    const autoScroll = useMessageListAutoScroll({
      activeConversationId,
      messages,
    })

    const list = createMessageListElement({
      clientHeight: 500,
      scrollHeight: 2000,
      scrollTop: 1500,
    })
    autoScroll.messageListRef.value = list
    await flushWatchers()

    list.scrollTop = 1400
    autoScroll.handleMessageListScroll()

    setScrollHeight(list, 2100)
    messages.value = createStreamingMessages('ab')
    await flushWatchers()
    expect(list.scrollTop).toBe(1400)

    list.scrollTop = 2000
    autoScroll.handleMessageListScroll()

    setScrollHeight(list, 2200)
    messages.value = createStreamingMessages('abc')
    await flushWatchers()
    expect(list.scrollTop).toBe(2200)

    autoScroll.handleMessageListScroll()
    list.scrollTop = 2199
    autoScroll.handleMessageListScroll()

    setScrollHeight(list, 2300)
    messages.value = createStreamingMessages('abcd')
    await flushWatchers()

    expect(list.scrollTop).toBe(2199)
  })

  it('releases immediately on wheel-up intent even after a recent auto-follow', async () => {
    const activeConversationId = ref<string | null>('c1')
    const messages = ref<ChatMessage[]>(createStreamingMessages('a'))
    const autoScroll = useMessageListAutoScroll({
      activeConversationId,
      messages,
    })

    const list = createMessageListElement({
      clientHeight: 500,
      scrollHeight: 2000,
      scrollTop: 1500,
    })
    autoScroll.messageListRef.value = list
    await flushWatchers()

    list.scrollTop = 2000
    autoScroll.handleMessageListScroll()

    setScrollHeight(list, 2200)
    messages.value = createStreamingMessages('ab')
    await flushWatchers()
    expect(list.scrollTop).toBe(2200)

    autoScroll.handleMessageListWheel(createWheelEvent(-120))
    list.scrollTop = 2190
    autoScroll.handleMessageListScroll()

    setScrollHeight(list, 2300)
    messages.value = createStreamingMessages('abc')
    await flushWatchers()

    expect(list.scrollTop).toBe(2190)
  })

  it('keeps deterministic behavior across multiple up-down cycles in one stream', async () => {
    const activeConversationId = ref<string | null>('c1')
    const messages = ref<ChatMessage[]>(createStreamingMessages('a'))
    const autoScroll = useMessageListAutoScroll({
      activeConversationId,
      messages,
    })

    const list = createMessageListElement({
      clientHeight: 500,
      scrollHeight: 2000,
      scrollTop: 1500,
    })
    autoScroll.messageListRef.value = list
    await flushWatchers()

    autoScroll.handleMessageListWheel(createWheelEvent(-120))
    list.scrollTop = 1490
    autoScroll.handleMessageListScroll()

    setScrollHeight(list, 2100)
    messages.value = createStreamingMessages('ab')
    await flushWatchers()
    expect(list.scrollTop).toBe(1490)

    list.scrollTop = 1600
    autoScroll.handleMessageListScroll()
    list.scrollTop = 2000
    autoScroll.handleMessageListScroll()

    setScrollHeight(list, 2200)
    messages.value = createStreamingMessages('abc')
    await flushWatchers()
    expect(list.scrollTop).toBe(2200)

    autoScroll.handleMessageListWheel(createWheelEvent(-120))
    list.scrollTop = 2190
    autoScroll.handleMessageListScroll()

    setScrollHeight(list, 2300)
    messages.value = createStreamingMessages('abcd')
    await flushWatchers()
    expect(list.scrollTop).toBe(2190)
  })

  it('does not unlock auto-follow on slight downward jitter after user scroll-up lock', async () => {
    const activeConversationId = ref<string | null>('c1')
    const messages = ref<ChatMessage[]>(createStreamingMessages('a'))
    const autoScroll = useMessageListAutoScroll({
      activeConversationId,
      messages,
    })

    const list = createMessageListElement({
      clientHeight: 500,
      scrollHeight: 2000,
      scrollTop: 1500,
    })
    autoScroll.messageListRef.value = list
    await flushWatchers()

    autoScroll.handleMessageListWheel(createWheelEvent(-120))
    list.scrollTop = 1490
    autoScroll.handleMessageListScroll()

    setScrollHeight(list, 2100)
    messages.value = createStreamingMessages('ab')
    await flushWatchers()
    expect(list.scrollTop).toBe(1490)

    list.scrollTop = 1493
    autoScroll.handleMessageListScroll()

    setScrollHeight(list, 2200)
    messages.value = createStreamingMessages('abc')
    await flushWatchers()
    expect(list.scrollTop).toBe(1493)

    list.scrollTop = 1700
    autoScroll.handleMessageListScroll()

    setScrollHeight(list, 2300)
    messages.value = createStreamingMessages('abcd')
    await flushWatchers()
    expect(list.scrollTop).toBe(2300)
  })

  it('preserves the locked viewport offset when message height grows after the user scrolls up', async () => {
    const activeConversationId = ref<string | null>('c1')
    const messages = ref<ChatMessage[]>(createStreamingMessages('a'))
    const autoScroll = useMessageListAutoScroll({
      activeConversationId,
      messages,
    })

    const anchorRect = { top: 140, bottom: 220 }
    const list = createMessageListElement({
      clientHeight: 500,
      scrollHeight: 2000,
      scrollTop: 1500,
      children: [
        createMessageItem('assistant', anchorRect),
      ],
      rect: { top: 100, bottom: 600 },
    })
    autoScroll.messageListRef.value = list
    await flushWatchers()

    autoScroll.handleMessageListWheel(createWheelEvent(-120))
    list.scrollTop = 1490
    autoScroll.handleMessageListScroll()

    anchorRect.top += 120
    anchorRect.bottom += 120
    resizeObserverCallback?.([], {} as ResizeObserver)
    await flushWatchers()

    expect(list.scrollTop).toBe(1610)
  })

  it('keeps auto-follow pinned to bottom when message height grows after delayed markdown layout changes', async () => {
    const activeConversationId = ref<string | null>('c1')
    const messages = ref<ChatMessage[]>(createStreamingMessages('a'))
    const autoScroll = useMessageListAutoScroll({
      activeConversationId,
      messages,
    })

    const list = createMessageListElement({
      clientHeight: 500,
      scrollHeight: 2000,
      scrollTop: 2000,
    })
    autoScroll.messageListRef.value = list
    await flushWatchers()

    setScrollHeight(list, 2180)
    resizeObserverCallback?.([], {} as ResizeObserver)
    await flushWatchers()

    expect(list.scrollTop).toBe(2180)
  })
})

function createStreamingMessages(content: string): ChatMessage[] {
  return [
    {
      id: 'user',
      role: 'user',
      content: 'hi',
      createdAt: 1,
      status: 'done',
    },
    {
      id: 'assistant',
      role: 'assistant',
      content,
      createdAt: 2,
      status: 'streaming',
    },
  ]
}

function createMessageListElement(options: {
  clientHeight: number
  scrollHeight: number
  scrollTop: number
  children?: HTMLElement[]
  rect?: { top: number; bottom: number }
}): HTMLElement {
  return {
    children: options.children ?? [],
    clientHeight: options.clientHeight,
    getBoundingClientRect: () => ({
      top: options.rect?.top ?? 0,
      bottom: options.rect?.bottom ?? options.clientHeight,
    }),
    scrollHeight: options.scrollHeight,
    scrollTop: options.scrollTop,
  } as unknown as HTMLElement
}

function createMessageItem(messageId: string, rect: { top: number; bottom: number }): HTMLElement {
  return {
    dataset: {
      messageId,
    },
    getBoundingClientRect: () => ({
      top: rect.top,
      bottom: rect.bottom,
    }),
  } as unknown as HTMLElement
}

function setScrollHeight(element: HTMLElement, value: number): void {
  ;(element as { scrollHeight: number }).scrollHeight = value
}

function createWheelEvent(deltaY: number): WheelEvent {
  return {
    deltaY,
  } as WheelEvent
}

async function flushWatchers(): Promise<void> {
  await nextTick()
  await nextTick()
}
