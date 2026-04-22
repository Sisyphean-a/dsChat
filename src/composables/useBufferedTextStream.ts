import { computed, getCurrentScope, onScopeDispose, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'

const DEFAULT_SEGMENT_DURATION_MS = 96
const MIN_SEGMENT_DURATION_MS = 32
const MAX_SEGMENT_DURATION_MS = 180
const INTERVAL_SMOOTHING_FACTOR = 0.45

interface UseBufferedTextStreamOptions {
  isStreaming: ComputedRef<boolean> | Ref<boolean>
  source: ComputedRef<string> | Ref<string>
}

interface PendingSegment {
  durationMs: number
  shownLength: number
  startedAt: number | null
  text: string
}

export function useBufferedTextStream(options: UseBufferedTextStreamOptions) {
  const { isStreaming, source } = options
  const displayedText = ref(source.value)
  let frameId: number | null = null
  let committedText = source.value
  let trackedSource = source.value
  let pendingSegments: PendingSegment[] = []
  let lastAppendAtMs: number | null = null
  let smoothedIntervalMs = DEFAULT_SEGMENT_DURATION_MS

  const isSettled = computed(() => displayedText.value === source.value)

  function scheduleFrame(): void {
    if (frameId !== null || isSettled.value) {
      return
    }

    frameId = window.requestAnimationFrame(flushFrame)
  }

  function flushFrame(): void {
    frameId = null
    const nowMs = Date.now()

    const currentSegment = pendingSegments[0]
    if (!currentSegment) {
      displayedText.value = committedText
      return
    }

    if (currentSegment.startedAt === null) {
      currentSegment.startedAt = nowMs
    }

    const elapsedMs = Math.max(0, nowMs - currentSegment.startedAt)
    const nextShownLength = resolveShownLength(currentSegment, elapsedMs)
    if (nextShownLength !== currentSegment.shownLength) {
      currentSegment.shownLength = nextShownLength
      displayedText.value = `${committedText}${currentSegment.text.slice(0, currentSegment.shownLength)}`
    }

    if (currentSegment.shownLength >= currentSegment.text.length) {
      committedText += currentSegment.text
      pendingSegments = pendingSegments.slice(1)
      displayedText.value = committedText
      if (pendingSegments[0]) {
        pendingSegments[0].startedAt = null
      }
    }

    scheduleFrame()
  }

  watch(source, (next) => {
    if (!next.startsWith(trackedSource) || next.length < trackedSource.length) {
      resetTo(next)
      trackedSource = next
      return
    }

    const appended = next.slice(trackedSource.length)
    trackedSource = next
    if (!appended) {
      if (!isStreaming.value) {
        flushRemainingImmediately()
      }
      return
    }

    if (!isStreaming.value) {
      committedText = next
      displayedText.value = next
      pendingSegments = []
      lastAppendAtMs = null
      return
    }

    pendingSegments.push(createPendingSegment(appended))
    if (pendingSegments.length === 1) {
      displayedText.value = committedText
    }
    scheduleFrame()
  }, { immediate: true })

  watch(isStreaming, (next) => {
    if (!next) {
      flushRemainingImmediately()
      return
    }

    if (displayedText.value.length > source.value.length) {
      resetTo(source.value)
      trackedSource = source.value
    }
  })

  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    })
  }

  return {
    displayedText,
    isSettled,
  }

  function createPendingSegment(text: string): PendingSegment {
    const nowMs = Date.now()
    const intervalMs = lastAppendAtMs === null
      ? smoothedIntervalMs
      : nowMs - lastAppendAtMs
    smoothedIntervalMs = lastAppendAtMs === null
      ? smoothedIntervalMs
      : smoothInterval(smoothedIntervalMs, intervalMs)
    lastAppendAtMs = nowMs

    return {
      durationMs: estimateSegmentDuration(text.length, smoothedIntervalMs),
      shownLength: 0,
      startedAt: null,
      text,
    }
  }

  function flushRemainingImmediately(): void {
    pendingSegments = []
    committedText = source.value
    displayedText.value = source.value
    lastAppendAtMs = null
  }

  function resetTo(next: string): void {
    pendingSegments = []
    committedText = next
    displayedText.value = next
    lastAppendAtMs = null
    smoothedIntervalMs = DEFAULT_SEGMENT_DURATION_MS
    if (frameId !== null) {
      window.cancelAnimationFrame(frameId)
      frameId = null
    }
  }
}

function resolveShownLength(segment: PendingSegment, elapsedMs: number): number {
  if (!segment.text.length) {
    return 0
  }

  if (segment.shownLength === 0) {
    return 1
  }

  if (elapsedMs >= segment.durationMs) {
    return segment.text.length
  }

  const progress = elapsedMs / segment.durationMs
  return Math.max(
    segment.shownLength,
    Math.min(
      segment.text.length,
      Math.ceil(progress * segment.text.length),
    ),
  )
}

function estimateSegmentDuration(segmentLength: number, smoothedIntervalMs: number): number {
  const lengthBoundMs = clamp(segmentLength * 18, MIN_SEGMENT_DURATION_MS, MAX_SEGMENT_DURATION_MS)
  const cadenceBoundMs = clamp(smoothedIntervalMs * 0.85, MIN_SEGMENT_DURATION_MS, MAX_SEGMENT_DURATION_MS)
  return Math.min(lengthBoundMs, cadenceBoundMs)
}

function smoothInterval(previousMs: number, nextMs: number): number {
  return previousMs + (nextMs - previousMs) * INTERVAL_SMOOTHING_FACTOR
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
