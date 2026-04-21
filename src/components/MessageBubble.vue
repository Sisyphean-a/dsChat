<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { highlightCodeBlocks, renderMarkdown } from '../services/markdown'
import type { ChatMessage } from '../types/chat'

const props = defineProps<{
  message: ChatMessage
}>()

const containerRef = ref<HTMLElement | null>(null)
const isReasoningExpanded = ref(false)

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

const renderedReasoningHtml = computed(() => {
  if (props.message.role !== 'assistant' || !props.message.reasoningContent) {
    return ''
  }

  return renderMarkdown(props.message.reasoningContent)
})

const hasReasoning = computed(() => renderedReasoningHtml.value.length > 0)
const inReasoningStage = computed(() => {
  return props.message.role === 'assistant'
    && props.message.status === 'streaming'
    && !props.message.content.trim()
    && hasReasoning.value
})

const reasoningLabel = computed(() => {
  return inReasoningStage.value ? '思考中...' : '思考过程'
})

async function applyHighlight(): Promise<void> {
  if (!containerRef.value || props.message.role !== 'assistant') {
    return
  }

  await nextTick()
  highlightCodeBlocks(containerRef.value)
}

function toggleReasoning(): void {
  if (!hasReasoning.value) return
  isReasoningExpanded.value = !isReasoningExpanded.value
}

onMounted(() => {
  void applyHighlight()
})

watch(() => [props.message.content, props.message.reasoningContent], () => {
  void applyHighlight()
})

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
  <article ref="containerRef" :class="bubbleClass">
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
          <div class="reasoning-body" v-html="renderedReasoningHtml" />
        </div>
      </div>
    </section>

    <div v-if="props.message.role === 'assistant' && props.message.content" class="markdown-body" v-html="renderedHtml" />
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

.markdown-body :deep(*) {
  line-height: 1.6;
  font-size: 0.95rem;
}

.reasoning-body :deep(*) {
  line-height: 1.55;
  font-size: 0.85rem;
}

.markdown-body :deep(p:first-child),
.reasoning-body :deep(p:first-child) {
  margin-top: 0;
}

.markdown-body :deep(p:last-child),
.reasoning-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(pre),
.reasoning-body :deep(pre) {
  overflow: auto;
  padding: 12px;
  border-radius: 10px;
  background: var(--code-bg);
  border: 1px solid var(--code-border);
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

.markdown-body :deep(code:not(pre code)),
.reasoning-body :deep(code:not(pre code)) {
  padding: 0.15rem 0.35rem;
  border-radius: 6px;
  background: var(--code-inline-bg);
  color: var(--code-text);
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
