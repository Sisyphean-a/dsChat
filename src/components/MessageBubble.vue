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
  max-width: min(85%, 720px);
  padding: 10px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  animation: reveal 200ms ease;
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
  display: none; /* Hide the explicit DeepSeek / 你 label to save space, let the alignment speak */
}

.message-status {
  display: inline-block;
  margin-top: 6px;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.plain-body {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.6;
  font-size: 0.95rem;
}

.markdown-body :deep(*) {
  line-height: 1.6;
  font-size: 0.95rem;
}

.markdown-body :deep(p:first-child) {
  margin-top: 0;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(pre) {
  overflow: auto;
  padding: 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-hover);
  font-size: 0.85rem;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 6px 10px;
  border: 1px solid var(--border);
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
