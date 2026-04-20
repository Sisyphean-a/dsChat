<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { highlightCodeBlocks, renderMarkdown } from '../services/markdown'
import type { ChatMessage } from '../types/chat'

const props = defineProps<{
  message: ChatMessage
}>()

const containerRef = ref<HTMLElement | null>(null)

const bubbleClass = computed(() => ({
  bubble: true,
  'is-user': props.message.role === 'user',
  'is-assistant': props.message.role === 'assistant',
  'is-error': props.message.status === 'error',
}))

const renderedHtml = computed(() => {
  if (props.message.role === 'user') {
    return ''
  }

  return renderMarkdown(props.message.content)
})

async function applyHighlight(): Promise<void> {
  if (!containerRef.value || props.message.role !== 'assistant') {
    return
  }

  await nextTick()
  highlightCodeBlocks(containerRef.value)
}

onMounted(() => {
  void applyHighlight()
})

watch(() => props.message.content, () => {
  void applyHighlight()
})
</script>

<template>
  <article :class="bubbleClass">
    <p class="message-role">
      {{ props.message.role === 'user' ? '你' : 'DeepSeek' }}
    </p>

    <div
      v-if="props.message.role === 'assistant'"
      ref="containerRef"
      class="markdown-body"
      v-html="renderedHtml"
    />

    <p v-else class="plain-body">{{ props.message.content }}</p>

    <span v-if="props.message.status === 'streaming'" class="message-status">生成中...</span>
    <span v-else-if="props.message.status === 'error'" class="message-status">请求失败</span>
  </article>
</template>

<style scoped>
.bubble {
  max-width: min(82%, 720px);
  padding: 18px 20px;
  border-radius: 24px;
  border: 1px solid var(--border);
  animation: reveal 200ms ease;
}

.bubble.is-user {
  align-self: flex-end;
  background: linear-gradient(180deg, #1a6c64, #0b4841);
  color: #f3f7f6;
  border-bottom-right-radius: 8px;
}

.bubble.is-assistant,
.bubble.is-error {
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.84);
  border-bottom-left-radius: 8px;
}

.bubble.is-error {
  border-color: rgba(143, 53, 53, 0.24);
}

.message-role,
.message-status {
  margin: 0 0 10px;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.message-role {
  opacity: 0.72;
}

.message-status {
  display: inline-block;
  margin-top: 12px;
  color: var(--text-muted);
}

.plain-body {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.8;
}

.markdown-body :deep(*) {
  line-height: 1.72;
}

.markdown-body :deep(p:first-child) {
  margin-top: 0;
}

.markdown-body :deep(pre) {
  overflow: auto;
  padding: 14px;
  border-radius: 16px;
  background: #1d2428;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 10px 12px;
  border: 1px solid rgba(43, 53, 56, 0.12);
}

@keyframes reveal {
  from {
    opacity: 0;
    transform: translateY(6px);
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
