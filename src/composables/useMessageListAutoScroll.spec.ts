import { nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../types/chat'
import { useMessageListAutoScroll } from './useMessageListAutoScroll'

describe('useMessageListAutoScroll', () => {
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
}): HTMLElement {
  return {
    clientHeight: options.clientHeight,
    scrollHeight: options.scrollHeight,
    scrollTop: options.scrollTop,
  } as HTMLElement
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
