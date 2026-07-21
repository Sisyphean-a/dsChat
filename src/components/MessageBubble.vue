<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AssistantMessageContent from './AssistantMessageContent.vue'
import CheckIcon from './icons/CheckIcon.vue'
import CopyIcon from './icons/CopyIcon.vue'
import RegenerateIcon from './icons/RegenerateIcon.vue'
import { useBufferedTextStream } from '../composables/useBufferedTextStream'
import { buildFallbackTimeline, shouldCollapsePlainMessage } from '../utils/messageBubble'
import type {
  ChatMessage,
  MessageAttachment,
  ProcessTimelineItem,
} from '../types/chat'

const props = defineProps<{
  canRetry?: boolean
  message: ChatMessage
}>()
const emit = defineEmits<{
  retry: []
}>()

type MessageCopyState = 'idle' | 'success' | 'error'

const COPY_RESET_DELAY_MS = 1400

const isProcessExpanded = ref(false)
const isAssistantMessage = computed(() => props.message.role === 'assistant')
const isUserMessage = computed(() => props.message.role === 'user')
const isStreamingStatus = computed(() => props.message.status === 'streaming')
const previewAttachment = ref<MessageAttachment | null>(null)
const copyState = ref<MessageCopyState>('idle')
const isUserMessageExpanded = ref(false)
let copyResetTimer: number | null = null

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
  const stopped = processTimeline.value.filter((item) => item.status === 'stopped').length
  const running = processTimeline.value.filter((item) => item.status === 'running').length
  if (failed > 0) {
    return `过程（${total}，失败 ${failed}）`
  }

  if (stopped > 0) {
    return `过程（${total}，已停止 ${stopped}）`
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

const canCopyMessage = computed(() => {
  if (!props.message.content.trim()) {
    return false
  }

  if (isAssistantMessage.value) {
    return props.message.status !== 'streaming'
  }

  return true
})

const canRegenerateMessage = computed(() => {
  return Boolean(props.canRetry) && isAssistantMessage.value
})

const shouldShowMessageActions = computed(() => {
  if (isStreamingStatusOnly.value) {
    return false
  }

  return canCopyMessage.value || canRegenerateMessage.value
})

const copyActionLabel = computed(() => {
  if (copyState.value === 'success') {
    return '已复制'
  }

  if (copyState.value === 'error') {
    return '复制失败'
  }

  return '复制'
})

const isStreamingStatusOnly = computed(() => {
  return Boolean(streamingStatusText.value)
    && isAssistantMessage.value
    && !displayedContent.value.trim()
    && !hasProcessTimeline.value
    && imageAttachments.value.length === 0
})

const shouldCollapseUserMessage = computed(() => {
  if (!isUserMessage.value) {
    return false
  }

  return shouldCollapsePlainMessage(props.message.content)
})

const isUserMessageCollapsed = computed(() => {
  return shouldCollapseUserMessage.value && !isUserMessageExpanded.value
})

const collapseActionLabel = computed(() => {
  return isUserMessageExpanded.value ? '收起消息' : '展开消息'
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

function toggleUserMessageCollapse(): void {
  if (!shouldCollapseUserMessage.value) {
    return
  }

  isUserMessageExpanded.value = !isUserMessageExpanded.value
}

async function copyMessage(): Promise<void> {
  const content = props.message.content.trim()
  if (!content) {
    updateCopyState('error')
    return
  }

  try {
    await writeClipboardText(content)
    updateCopyState('success')
  } catch (error) {
    console.error('Copy message failed.', error)
    updateCopyState('error')
  }
}

function updateCopyState(state: MessageCopyState): void {
  copyState.value = state
  if (copyResetTimer !== null) {
    window.clearTimeout(copyResetTimer)
  }

  copyResetTimer = window.setTimeout(() => {
    copyState.value = 'idle'
    copyResetTimer = null
  }, COPY_RESET_DELAY_MS)
}

async function writeClipboardText(content: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard API is not available.')
  }

  await navigator.clipboard.writeText(content)
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

watch(
  () => [props.message.id, props.message.content],
  () => {
    isUserMessageExpanded.value = false
  },
  { immediate: true },
)
</script>

<template>
  <div
    class="message-row"
    :class="{
      'is-user-row': isUserMessage,
      'is-assistant-row': isAssistantMessage,
    }"
    data-testid="message-row"
  >
    <div
      v-if="isUserMessage && shouldShowMessageActions"
      class="message-actions message-actions-inline"
      :class="{
        'is-user-compact-actions': props.message.role === 'user',
      }"
    >
      <button
        v-if="canCopyMessage"
        data-testid="message-copy-button"
        data-button-style="plain"
        class="message-action-button"
        :data-copy-state="copyState"
        type="button"
        :aria-label="copyActionLabel"
        :title="copyActionLabel"
        @click="copyMessage"
      >
        <CheckIcon
          v-if="copyState === 'success'"
          class="message-action-icon"
          data-testid="message-copy-success-icon"
        />
        <CopyIcon v-else class="message-action-icon" />
      </button>
    </div>

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
    <div
      v-if="isUserMessage"
      class="plain-body-shell"
      :class="{
        'has-collapse-toggle': shouldCollapseUserMessage,
        'is-collapsed': isUserMessageCollapsed,
      }"
    >
      <p class="plain-body">{{ props.message.content }}</p>
      <div v-if="isUserMessageCollapsed" class="plain-body-fade" aria-hidden="true"></div>
      <button
        v-if="shouldCollapseUserMessage"
        data-testid="message-collapse-toggle"
        class="message-collapse-toggle"
        data-button-style="plain"
        :class="{ 'is-expanded': isUserMessageExpanded }"
        type="button"
        :aria-label="collapseActionLabel"
        :title="collapseActionLabel"
        @click="toggleUserMessageCollapse"
      >
        <svg class="message-collapse-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
    </div>

    <div
      v-if="shouldShowMessageActions && !isUserMessage"
      class="message-actions"
    >
      <button
        v-if="canCopyMessage"
        data-testid="message-copy-button"
        data-button-style="plain"
        class="message-action-button"
        :data-copy-state="copyState"
        type="button"
        :aria-label="copyActionLabel"
        :title="copyActionLabel"
        @click="copyMessage"
      >
        <CheckIcon
          v-if="copyState === 'success'"
          class="message-action-icon"
          data-testid="message-copy-success-icon"
        />
        <CopyIcon v-else class="message-action-icon" />
      </button>
      <button
        v-if="canRegenerateMessage"
        data-testid="message-regenerate-button"
        data-button-style="plain"
        data-icon-id="ec66f0"
        class="message-action-button"
        type="button"
        :aria-label="retryActionLabel"
        :title="retryActionLabel"
        @click="retryAssistantMessage"
      >
        <RegenerateIcon class="message-action-icon" />
      </button>
    </div>

    <p v-if="streamingStatusText" class="message-stream-status">
      <span class="stream-dot" aria-hidden="true"></span>
      <span>{{ streamingStatusText }}</span>
    </p>
    <div v-else-if="props.message.status === 'interrupted' || props.message.status === 'error'" class="message-meta">
      <span class="message-status">{{ props.message.status === 'interrupted' ? '已中止' : '请求失败' }}</span>
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
  </div>
</template>

<style scoped src="../styles/message-bubble.css"></style>
