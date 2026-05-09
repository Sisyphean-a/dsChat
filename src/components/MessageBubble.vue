<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AssistantMessageContent from './AssistantMessageContent.vue'
import { useBufferedTextStream } from '../composables/useBufferedTextStream'
import type { ChatMessage, MessageAttachment } from '../types/chat'

const props = defineProps<{
  canRetry?: boolean
  message: ChatMessage
}>()
const emit = defineEmits<{
  retry: []
}>()

const isReasoningExpanded = ref(false)
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
const isReasoningRevealActive = computed(() => {
  return false
})

const hasReasoning = computed(() => Boolean(displayedReasoningContent.value.trim()))
const inReasoningStage = computed(() => {
  return isAssistantMessage.value
    && isStreamingStatus.value
    && !displayedContent.value.trim()
    && hasReasoning.value
})

const reasoningLabel = computed(() => {
  return inReasoningStage.value ? '思考中...' : '思考过程'
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
    && !displayedReasoningContent.value.trim()
    && imageAttachments.value.length === 0
})

function toggleReasoning(): void {
  if (!hasReasoning.value) return
  isReasoningExpanded.value = !isReasoningExpanded.value
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

watch(inReasoningStage, (next, prev) => {
  if (next) {
    isReasoningExpanded.value = true
    return
  }

  if (prev && hasReasoning.value) {
    isReasoningExpanded.value = false
  }
}, { immediate: true })
</script>

<template>
  <article :class="bubbleClass" :data-message-id="props.message.id">
    <p class="message-role">
      {{ props.message.role === 'user' ? '你' : 'DeepSeek' }}
    </p>

    <section v-if="hasReasoning" class="reasoning-block" :class="{ expanded: isReasoningExpanded }">
      <button class="reasoning-toggle" type="button" @click="toggleReasoning">
        <span>{{ reasoningLabel }}</span>
        <svg class="reasoning-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      <div class="reasoning-panel" :class="{ expanded: isReasoningExpanded }">
        <div class="reasoning-inner">
          <AssistantMessageContent
            v-if="displayedReasoningContent.trim()"
            class="reasoning-body"
            :content="displayedReasoningContent"
            :reveal-active="isReasoningRevealActive"
            variant="reasoning"
          />
        </div>
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
