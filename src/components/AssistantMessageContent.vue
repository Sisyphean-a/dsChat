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
  await highlightCodeBlocks(containerRef.value)
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
  gap: 14px;
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
.markdown-segment :deep(blockquote:last-child),
.markdown-segment :deep(pre:last-child),
.markdown-segment :deep(table:last-child) {
  margin-bottom: 0;
}

.markdown-segment :deep(p),
.markdown-segment :deep(ul),
.markdown-segment :deep(ol),
.markdown-segment :deep(blockquote),
.markdown-segment :deep(pre),
.markdown-segment :deep(table) {
  margin: 0.45rem 0 0.55rem;
}

.markdown-segment :deep(pre) {
  overflow: auto;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--code-bg);
  border: 1px solid var(--code-border);
  font-size: 0.85rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.code-segment :deep(pre) {
  margin: 0.2rem 0;
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

.markdown-segment :deep(blockquote) {
  padding-left: 12px;
  border-left: 3px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  color: var(--text-muted);
}

</style>
