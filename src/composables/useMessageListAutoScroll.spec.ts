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

async function flushWatchers(): Promise<void> {
  await nextTick()
  await nextTick()
}
