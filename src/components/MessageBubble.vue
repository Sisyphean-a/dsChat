<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AssistantMessageContent from './AssistantMessageContent.vue'
import { useBufferedTextStream } from '../composables/useBufferedTextStream'
import type {
  ChatMessage,
  MessageAttachment,
  ProcessTimelineItem,
  ToolTraceRecord,
} from '../types/chat'

const props = defineProps<{
  canRetry?: boolean
  message: ChatMessage
}>()
const emit = defineEmits<{
  retry: []
}>()

const isProcessExpanded = ref(false)
const isAssistantMessage = computed(() => props.message.role === 'assistant')
const isStreamingStatus = computed(() => props.message.status === 'streaming')
const previewAttachment = ref<MessageAttachment | null>(null)

const bubbleClass = computed(() => ({
  bubble: true,
  'is-user': props.message.role === 'user',
  'is-assistant': isAssistantMessage.value,
  'is-error': props.message.status === 'error',
  'is-streaming-status-only': isStreamingStatusOnly.value,
}))

const contentSource = computed(() => props.message.content)
const reasoningSource = computed(() => props.message.reasoningContent ?? '')
const {
  displayedText: displayedContent,
} = useBufferedTextStream({
  isStreaming: isStreamingStatus,
  source: contentSource,
})
const {
  displayedText: displayedReasoningContent,
} = useBufferedTextStream({
  isStreaming: isStreamingStatus,
  source: reasoningSource,
})

const isAnswerRevealActive = computed(() => {
  return false
})

const toolTraces = computed(() => props.message.toolTraces ?? [])
const processTimeline = computed<ProcessTimelineItem[]>(() => {
  if (props.message.processTimeline?.length) {
    return props.message.processTimeline.map((item) => ({ ...item }))
  }

  return buildFallbackTimeline(displayedReasoningContent.value, toolTraces.value)
})
const hasProcessTimeline = computed(() => processTimeline.value.length > 0)
const processLabel = computed(() => {
  const total = processTimeline.value.length
  const failed = processTimeline.value.filter((item) => item.status === 'error').length
  const running = processTimeline.value.filter((item) => item.status === 'running').length
  if (failed > 0) {
    return `过程（${total}，失败 ${failed}）`
  }

  if (running > 0) {
    return `过程（${total}，进行中 ${running}）`
  }

  return `过程（${total}）`
})

const imageAttachments = computed(() => {
  return (props.message.attachments ?? []).filter((item) => item.type === 'image')
})

const streamingStatusText = computed(() => {
  if (props.message.status !== 'streaming') {
    return ''
  }

  return props.message.streamingStatus?.trim() || '正在生成回答...'
})

const retryActionLabel = computed(() => {
  return props.message.status === 'interrupted' ? '重新生成' : '重试'
})

const isStreamingStatusOnly = computed(() => {
  return Boolean(streamingStatusText.value)
    && isAssistantMessage.value
    && !displayedContent.value.trim()
    && !hasProcessTimeline.value
    && imageAttachments.value.length === 0
})

function toggleProcessTimeline(): void {
  if (!hasProcessTimeline.value) return
  isProcessExpanded.value = !isProcessExpanded.value
}

function openImagePreview(attachment: MessageAttachment): void {
  previewAttachment.value = attachment
}

function closeImagePreview(): void {
  previewAttachment.value = null
}

function retryAssistantMessage(): void {
  emit('retry')
}

watch(hasProcessTimeline, (next, prev) => {
  if (next) {
    isProcessExpanded.value = isStreamingStatus.value
    return
  }

  if (prev) {
    isProcessExpanded.value = false
  }
}, { immediate: true })

watch(isStreamingStatus, (next, prev) => {
  if (next) {
    if (hasProcessTimeline.value) {
      isProcessExpanded.value = true
    }
    return
  }

  if (prev) {
    isProcessExpanded.value = false
  }
})

function buildFallbackTimeline(
  reasoningContent: string,
  traces: ToolTraceRecord[],
): ProcessTimelineItem[] {
  const items: ProcessTimelineItem[] = []
  if (reasoningContent.trim()) {
    items.push({
      id: 'fallback-reasoning',
      type: 'reasoning',
      round: 1,
      status: 'done',
      text: summarizeReasoning(reasoningContent),
    })
  }

  for (const trace of traces) {
    items.push({
      id: `fallback-tool-${trace.id}`,
      type: 'tool',
      round: trace.round,
      status: mapToolTraceStatus(trace.status),
      durationMs: trace.durationMs,
      text: describeToolTraceFallback(trace.toolName, trace.status, trace.errorMessage),
    })
  }

  return items
}

function mapToolTraceStatus(status: string): ProcessTimelineItem['status'] {
  if (status === 'failed') return 'error'
  if (status === 'running' || status === 'planned') return 'running'
  return 'done'
}

function describeToolTraceFallback(toolName: string, status: string, errorMessage?: string): string {
  if (status === 'failed') {
    return `${resolveToolDisplayName(toolName)}失败：${errorMessage?.trim() || '未知错误'}`
  }

  if (status === 'running' || status === 'planned') {
    return `正在执行${resolveToolDisplayName(toolName)}`
  }

  return `${resolveToolDisplayName(toolName)}已完成`
}

function resolveToolDisplayName(toolName: string): string {
  if (toolName === 'tavily_search') {
    return '联网检索'
  }

  if (toolName === 'get_current_time') {
    return '时间查询'
  }

  return `工具 ${toolName}`
}

function summarizeReasoning(content: string): string {
  const normalized = content
    .split('\n')
    .map((line) => line.trim().replace(/^[-*]\s+/, ''))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalized) {
    return ''
  }

  return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized
}
</script>

<template>
  <article :class="bubbleClass" :data-message-id="props.message.id">
    <p class="message-role">
      {{ props.message.role === 'user' ? '你' : 'DeepSeek' }}
    </p>

    <section v-if="hasProcessTimeline" class="process-block" :class="{ expanded: isProcessExpanded }">
      <button class="process-toggle" type="button" @click="toggleProcessTimeline">
        <span>{{ processLabel }}</span>
        <svg class="process-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      <div class="process-panel" :class="{ expanded: isProcessExpanded }">
        <ul class="process-list">
          <li v-for="item in processTimeline" :key="item.id" class="process-item" :class="[`is-${item.type}`, `is-${item.status}`]">
            <p class="process-text">{{ item.text }}</p>
          </li>
        </ul>
      </div>
    </section>

    <AssistantMessageContent
      v-if="isAssistantMessage && displayedContent.trim()"
      class="markdown-body"
      :content="displayedContent"
      :reveal-active="isAnswerRevealActive"
    />
    <div v-if="imageAttachments.length" class="message-images">
      <button
        v-for="attachment in imageAttachments"
        :key="attachment.id"
        class="message-image-button"
        type="button"
        @click="openImagePreview(attachment)"
      >
        <img
          class="message-image-thumb"
          :src="attachment.dataUrl"
          :alt="attachment.name"
        />
      </button>
    </div>
    <p v-if="props.message.role === 'user'" class="plain-body">{{ props.message.content }}</p>

    <p v-if="streamingStatusText" class="message-stream-status">
      <span class="stream-dot" aria-hidden="true"></span>
      <span>{{ streamingStatusText }}</span>
    </p>
    <div v-else-if="props.message.status === 'interrupted' || props.message.status === 'error'" class="message-meta">
      <span class="message-status">{{ props.message.status === 'interrupted' ? '已中止' : '请求失败' }}</span>
      <button
        v-if="props.canRetry"
        data-testid="message-retry-button"
        class="message-retry-button"
        type="button"
        @click="retryAssistantMessage"
      >
        {{ retryActionLabel }}
      </button>
    </div>

    <div
      v-if="previewAttachment"
      class="preview-overlay"
      @click.self="closeImagePreview"
    >
      <div class="preview-panel">
        <img
          class="preview-image"
          :src="previewAttachment.dataUrl"
          :alt="previewAttachment.name"
        />
        <button class="preview-close" type="button" @click="closeImagePreview">关闭</button>
      </div>
    </div>
  </article>
</template>

<style scoped src="../styles/message-bubble.css"></style>
