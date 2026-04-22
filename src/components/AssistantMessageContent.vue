<script setup lang="ts">
import { computed, getCurrentScope, nextTick, onScopeDispose, ref, watch } from 'vue'
import { highlightCodeBlocks } from '../services/markdown'
import { buildMarkdownRenderSegments } from '../services/streamingMarkdownSegments'

const props = defineProps<{
  content: string
  variant?: 'answer' | 'reasoning'
}>()

const containerRef = ref<HTMLElement | null>(null)
const variantClass = computed(() => props.variant === 'reasoning' ? 'is-reasoning' : 'is-answer')
const segments = computed(() => buildMarkdownRenderSegments(props.content))

watch(() => segments.value.map((segment) => `${segment.id}:${segment.kind}:${segment.source.length}`).join('|'), () => {
  void applyHighlight()
}, { immediate: true })

async function applyHighlight(): Promise<void> {
  if (!containerRef.value) {
    return
  }

  await nextTick()
  highlightCodeBlocks(containerRef.value)
}

if (getCurrentScope()) {
  onScopeDispose(() => {
    containerRef.value = null
  })
}
</script>

<template>
  <div ref="containerRef" class="message-rich-content" :class="variantClass">
    <template v-for="segment in segments" :key="segment.id">
      <div
        v-if="segment.kind === 'prose'"
        class="markdown-segment prose-segment"
        v-html="segment.html"
      />
      <div
        v-else
        class="markdown-segment code-segment"
        v-html="segment.html"
      />
    </template>
  </div>
</template>

<style scoped>
.message-rich-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.markdown-segment {
  position: relative;
}

.markdown-segment :deep(*) {
  line-height: 1.6;
  font-size: 0.95rem;
}

.message-rich-content.is-reasoning .markdown-segment :deep(*) {
  line-height: 1.55;
  font-size: 0.85rem;
}

.markdown-segment :deep(p:first-child),
.markdown-segment :deep(ul:first-child),
.markdown-segment :deep(ol:first-child),
.markdown-segment :deep(blockquote:first-child) {
  margin-top: 0;
}

.markdown-segment :deep(p:last-child),
.markdown-segment :deep(ul:last-child),
.markdown-segment :deep(ol:last-child),
.markdown-segment :deep(blockquote:last-child) {
  margin-bottom: 0;
}

.markdown-segment :deep(pre) {
  overflow: auto;
  padding: 12px;
  border-radius: 10px;
  background: var(--code-bg);
  border: 1px solid var(--code-border);
  font-size: 0.85rem;
  margin: 0;
}

.markdown-segment :deep(table) {
  width: 100%;
  border-collapse: collapse;
}

.markdown-segment :deep(th),
.markdown-segment :deep(td) {
  padding: 6px 10px;
  border: 1px solid var(--border);
}

.markdown-segment :deep(code:not(pre code)) {
  padding: 0.15rem 0.35rem;
  border-radius: 6px;
  background: var(--code-inline-bg);
  color: var(--code-text);
}

</style>
