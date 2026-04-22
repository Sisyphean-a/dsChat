<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AssistantMessageContent from './AssistantMessageContent.vue'
import { useBufferedTextStream } from '../composables/useBufferedTextStream'
import type { ChatMessage } from '../types/chat'

const props = defineProps<{
  message: ChatMessage
}>()

const isReasoningExpanded = ref(false)
const isAssistantMessage = computed(() => props.message.role === 'assistant')
const isStreamingStatus = computed(() => props.message.status === 'streaming')

const bubbleClass = computed(() => ({
  bubble: true,
  'is-user': props.message.role === 'user',
  'is-assistant': isAssistantMessage.value,
  'is-error': props.message.status === 'error',
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

function toggleReasoning(): void {
  if (!hasReasoning.value) return
  isReasoningExpanded.value = !isReasoningExpanded.value
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
    <p v-if="props.message.role === 'user'" class="plain-body">{{ props.message.content }}</p>

    <span v-if="props.message.status === 'streaming'" class="message-status">生成中...</span>
    <span v-else-if="props.message.status === 'interrupted'" class="message-status">已中止</span>
    <span v-else-if="props.message.status === 'error'" class="message-status">请求失败</span>
  </article>
</template>

<style scoped>
.bubble {
  max-width: min(85%, 720px);
  padding: 10px 14px;
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

.reasoning-block {
  margin-bottom: 8px;
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

@media (max-width: 640px) {
  .bubble {
    max-width: 100%;
  }
}
</style>
