<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AssistantMessageContent from './AssistantMessageContent.vue'
import { useBufferedTextStream } from '../composables/useBufferedTextStream'
import type { ChatMessage, MessageAttachment } from '../types/chat'

const props = defineProps<{
  message: ChatMessage
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
    <span v-else-if="props.message.status === 'interrupted'" class="message-status">已中止</span>
    <span v-else-if="props.message.status === 'error'" class="message-status">请求失败</span>

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

<style scoped>
.bubble {
  max-width: min(85%, 720px);
  padding: 12px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  animation: reveal 200ms ease;
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.03);
  contain: layout paint;
}

.bubble.is-user {
  align-self: flex-end;
  background: var(--bg-hover);
  color: var(--text);
  border-bottom-right-radius: 2px;
}

.bubble.is-assistant,
.bubble.is-error {
  align-self: flex-start;
  background: var(--bg);
  border-bottom-left-radius: 2px;
}

.bubble.is-error {
  border-color: rgba(239, 68, 68, 0.4);
}

.message-role {
  display: none;
}

.message-status {
  display: inline-block;
  margin-top: 6px;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.message-stream-status {
  margin: 8px 0 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  line-height: 1.25;
  color: var(--text-muted);
}

.bubble.is-streaming-status-only .message-stream-status {
  margin-top: 0;
}

.stream-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 72%, var(--text-muted));
  animation: stream-pulse 1.15s ease-in-out infinite;
}

.reasoning-block {
  margin-bottom: 10px;
  border: 1px solid rgba(16, 163, 127, 0.12);
  border-radius: 10px;
  background: rgba(16, 163, 127, 0.04);
}

.reasoning-toggle {
  width: 100%;
  padding: 9px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-muted);
}

.reasoning-arrow {
  transition: transform 180ms ease;
}

.reasoning-block.expanded .reasoning-arrow {
  transform: rotate(180deg);
}

.reasoning-panel {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transform: translateY(-2px);
  transition: grid-template-rows 180ms ease, opacity 180ms ease, transform 180ms ease;
}

.reasoning-panel.expanded {
  grid-template-rows: 1fr;
  opacity: 1;
  transform: translateY(0);
}

.reasoning-inner {
  overflow: hidden;
}

.reasoning-body {
  padding: 0 10px 10px;
  color: var(--text-muted);
  will-change: opacity, transform;
}

.plain-body {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.6;
  font-size: 0.95rem;
}

.message-images {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  overflow-x: auto;
}

.message-image-button {
  width: 72px;
  height: 72px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border);
  flex: none;
}

.message-image-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  background: rgba(0, 0, 0, 0.45);
  display: grid;
  place-items: center;
  padding: 20px;
}

.preview-panel {
  max-width: min(680px, 100%);
  max-height: calc(100vh - 80px);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview-image {
  max-width: 100%;
  max-height: calc(100vh - 180px);
  object-fit: contain;
  border-radius: 8px;
}

.preview-close {
  align-self: flex-end;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-soft);
  color: var(--text);
  font-size: 0.78rem;
}

@keyframes reveal {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes stream-pulse {
  0% {
    opacity: 0.35;
    transform: scale(0.82);
  }
  50% {
    opacity: 0.95;
    transform: scale(1);
  }
  100% {
    opacity: 0.35;
    transform: scale(0.82);
  }
}

@media (max-width: 640px) {
  .bubble {
    max-width: 100%;
  }
}
</style>
