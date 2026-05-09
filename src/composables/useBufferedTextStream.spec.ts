import { nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBufferedTextStream } from './useBufferedTextStream'

describe('useBufferedTextStream', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      return globalThis.setTimeout(() => callback(performance.now()), 16)
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      globalThis.clearTimeout(id)
    })
    vi.stubGlobal('window', globalThis)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('reveals streaming text over multiple animation frames', async () => {
    const source = ref('')
    const isStreaming = ref(true)
    const stream = useBufferedTextStream({
      isStreaming,
      source,
    })

    source.value = '这是一个分块到达的流式响应。'
    await nextTick()

    vi.advanceTimersByTime(16)
    await nextTick()
    expect(stream.displayedText.value.length).toBeGreaterThan(0)
    expect(stream.displayedText.value.length).toBeLessThan(source.value.length)

    vi.runAllTimers()
    await nextTick()
    expect(stream.displayedText.value).toBe(source.value)
  })

  it('flushes the trailing buffered text faster after streaming ends', async () => {
    const source = ref('')
    const isStreaming = ref(true)
    const stream = useBufferedTextStream({
      isStreaming,
      source,
    })

    source.value = '1234567890'
    await nextTick()
    vi.advanceTimersByTime(16)
    await nextTick()

    const partial = stream.displayedText.value.length
    expect(partial).toBeGreaterThan(0)
    expect(partial).toBeLessThan(source.value.length)

    isStreaming.value = false
    await nextTick()
    vi.advanceTimersByTime(16)
    await nextTick()

    expect(stream.displayedText.value).toBe(source.value)
  })

  it('resets immediately when the source shrinks', async () => {
    const source = ref('完整内容')
    const isStreaming = ref(false)
    const stream = useBufferedTextStream({
      isStreaming,
      source,
    })

    await nextTick()
    source.value = '已重置'
    await nextTick()
    vi.runAllTimers()
    await nextTick()
    expect(stream.displayedText.value).toBe('已重置')

    source.value = ''
    await nextTick()
    expect(stream.displayedText.value).toBe('')
  })
})
