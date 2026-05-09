<script setup lang="ts">
import { computed, getCurrentScope, nextTick, onScopeDispose, ref, watch } from 'vue'
import { highlightCodeBlocks } from '../services/markdown'
import { openExternalLink } from '../services/linkNavigation'
import { buildMarkdownRenderSegments } from '../services/streamingMarkdownSegments'

const props = defineProps<{
  content: string
  variant?: 'answer' | 'reasoning'
}>()

const FLOW_SPACE_COMPACT_PX = 12
const FLOW_SPACE_BLOCK_PX = 14
const FLOW_SPACE_DIVIDER_PX = 16
const FLOW_SPACE_SECTION_PX = 18

const containerRef = ref<HTMLElement | null>(null)
const contentRhythmStyle: Record<string, string> = Object.freeze({
  gap: '0px',
  '--message-flow-space-compact': `${FLOW_SPACE_COMPACT_PX}px`,
  '--message-flow-space-block': `${FLOW_SPACE_BLOCK_PX}px`,
  '--message-flow-space-divider': `${FLOW_SPACE_DIVIDER_PX}px`,
  '--message-flow-space-section': `${FLOW_SPACE_SECTION_PX}px`,
})
const variantClass = computed(() => props.variant === 'reasoning' ? 'is-reasoning' : 'is-answer')
const segments = computed(() => buildMarkdownRenderSegments(props.content))
watch(() => segments.value.map((segment) => `${segment.id}:${segment.kind}:${segment.source.length}`).join('|'), () => {
  void applyHighlight()
}, { immediate: true })

async function applyHighlight(): Promise<void> {
  await nextTick()
  if (!containerRef.value) {
    return
  }

  await highlightCodeBlocks(containerRef.value)
}

function handleContentClick(event: MouseEvent): void {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  const link = target.closest('a[href]') as HTMLAnchorElement | null
  if (!link || !containerRef.value?.contains(link)) {
    return
  }

  const href = link.getAttribute('href') ?? ''
  event.preventDefault()
  openExternalLink(href)
}

if (getCurrentScope()) {
  onScopeDispose(() => {
    containerRef.value = null
  })
}
</script>

<template>
  <div ref="containerRef" class="message-rich-content" :class="variantClass" :style="contentRhythmStyle" @click="handleContentClick">
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
}

.markdown-segment {
  position: relative;
}

.markdown-segment + .markdown-segment {
  margin-top: var(--message-flow-space-compact);
}

.prose-segment + .code-segment,
.code-segment + .prose-segment,
.code-segment + .code-segment {
  margin-top: var(--message-flow-space-block);
}

.markdown-segment :deep(*) {
  line-height: 1.6;
  font-size: 0.95rem;
}

.message-rich-content.is-reasoning .markdown-segment :deep(*) {
  line-height: 1.55;
  font-size: 0.85rem;
}

.markdown-segment :deep(h1),
.markdown-segment :deep(h2),
.markdown-segment :deep(h3),
.markdown-segment :deep(h4),
.markdown-segment :deep(p),
.markdown-segment :deep(ul),
.markdown-segment :deep(ol),
.markdown-segment :deep(blockquote),
.markdown-segment :deep(pre),
.markdown-segment :deep(table),
.markdown-segment :deep(hr) {
  margin: 0;
}

.markdown-segment > :deep(* + *) {
  margin-top: var(--message-flow-space-compact);
}

.markdown-segment > :deep(* + h1),
.markdown-segment > :deep(* + h2),
.markdown-segment > :deep(* + h3),
.markdown-segment > :deep(* + h4) {
  margin-top: var(--message-flow-space-section);
}

.markdown-segment > :deep(* + hr) {
  margin-top: var(--message-flow-space-divider);
}

.markdown-segment > :deep(h1 + *),
.markdown-segment > :deep(h2 + *),
.markdown-segment > :deep(h3 + *),
.markdown-segment > :deep(h4 + *) {
  margin-top: var(--message-flow-space-compact);
}

.markdown-segment > :deep(* + pre),
.markdown-segment > :deep(* + blockquote),
.markdown-segment > :deep(* + table),
.markdown-segment > :deep(pre + *),
.markdown-segment > :deep(blockquote + *),
.markdown-segment > :deep(table + *) {
  margin-top: var(--message-flow-space-block);
}

.markdown-segment > :deep(hr + *) {
  margin-top: var(--message-flow-space-divider);
}

.markdown-segment :deep(pre) {
  position: relative;
  overflow: auto;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--code-bg);
  border: 1px solid var(--code-border);
  font-size: 0.85rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.markdown-segment :deep(ul),
.markdown-segment :deep(ol) {
  padding-inline-start: 1.4rem;
}

.markdown-segment :deep(li + li) {
  margin-top: 0.25rem;
}

.markdown-segment :deep(blockquote > * + *) {
  margin-top: var(--message-flow-space-compact);
}

.markdown-segment :deep(.code-copy-button) {
  position: absolute;
  z-index: 2;
  top: 8px;
  right: 8px;
  height: 20px;
  min-width: 34px;
  padding: 0 6px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, var(--text-muted));
  border-radius: 6px;
  background: color-mix(in srgb, var(--bg-soft) 72%, var(--bg));
  color: var(--text-muted);
  font-size: 0.68rem;
  font-weight: 500;
  line-height: 1;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-1px);
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease, opacity 150ms ease, transform 150ms ease;
}

.markdown-segment :deep(pre:hover .code-copy-button),
.markdown-segment :deep(pre:focus-within .code-copy-button),
.markdown-segment :deep(.code-copy-button:focus-visible),
.markdown-segment :deep(.code-copy-button[data-copy-state='success']),
.markdown-segment :deep(.code-copy-button[data-copy-state='error']) {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.markdown-segment :deep(.code-copy-button:hover) {
  color: color-mix(in srgb, var(--text) 92%, var(--text-muted));
  border-color: color-mix(in srgb, var(--accent) 28%, var(--border));
  background: color-mix(in srgb, var(--accent-soft) 48%, var(--bg));
}

.markdown-segment :deep(.code-copy-button:focus-visible) {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-soft) 75%, transparent);
}

.markdown-segment :deep(.code-copy-button[data-copy-state='success']) {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  background: color-mix(in srgb, var(--accent-soft) 88%, var(--bg));
  color: color-mix(in srgb, var(--accent-strong) 75%, var(--text));
}

.markdown-segment :deep(.code-copy-button[data-copy-state='error']) {
  border-color: color-mix(in srgb, var(--danger) 40%, var(--border));
  background: color-mix(in srgb, var(--danger) 10%, var(--bg));
  color: var(--danger);
}

.markdown-segment :deep(.code-copy-status) {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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

.markdown-segment :deep(a) {
  color: var(--accent);
  color: color-mix(in srgb, var(--accent) 78%, var(--text));
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-thickness: 1.2px;
  transition: color 140ms ease, text-decoration-thickness 140ms ease;
}

.markdown-segment :deep(a:hover) {
  color: var(--accent-strong);
  color: color-mix(in srgb, var(--accent-strong) 68%, var(--text));
  text-decoration-thickness: 1.8px;
}

.markdown-segment :deep(a:focus-visible) {
  outline: 2px solid color-mix(in srgb, var(--accent-soft) 72%, transparent);
  outline-offset: 2px;
  border-radius: 4px;
}

.markdown-segment :deep(blockquote) {
  padding-left: 12px;
  border-left: 3px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  color: var(--text-muted);
}

.markdown-segment :deep(hr) {
  border: 0;
  border-top: 1px solid color-mix(in srgb, var(--border) 94%, var(--text-muted));
}

</style>
