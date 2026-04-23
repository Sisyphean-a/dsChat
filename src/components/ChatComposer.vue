<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MessageAttachment } from '../types/chat'

const props = defineProps<{
  attachments: MessageAttachment[]
  canSend: boolean
  isSending: boolean
  modelValue: string
  sendDisabled: boolean
}>()

const emit = defineEmits<{
  addImages: [files: File[]]
  removeAttachment: [id: string]
  'update:modelValue': [value: string]
  send: []
  stop: []
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const previewAttachment = ref<MessageAttachment | null>(null)
const hasAttachments = computed(() => props.attachments.length > 0)

function handleSubmit(): void {
  if (!props.sendDisabled && props.canSend) {
    emit('send')
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (!props.sendDisabled && props.canSend) {
      emit('send')
    }
  }
}

function adjustHeight(event: Event): void {
  const target = event.target as HTMLTextAreaElement
  target.style.height = 'auto'
  const newHeight = Math.min(target.scrollHeight, 200)
  target.style.height = `${newHeight}px`
}

function openImagePicker(): void {
  fileInputRef.value?.click()
}

function handleImageInput(event: Event): void {
  const target = event.target as HTMLInputElement
  const files = target.files ? Array.from(target.files).map(normalizeClipboardFile) : []
  if (files.length) {
    emit('addImages', files)
  }

  target.value = ''
}

function handlePaste(event: ClipboardEvent): void {
  const items = event.clipboardData?.items
  if (!items?.length) {
    return
  }

  const imageFiles: File[] = []
  for (const item of items) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) {
      continue
    }

    const file = item.getAsFile()
    if (!file) {
      continue
    }

    imageFiles.push(normalizeClipboardFile(file))
  }

  if (!imageFiles.length) {
    return
  }

  event.preventDefault()
  emit('addImages', imageFiles)
}

function removeAttachment(id: string): void {
  emit('removeAttachment', id)
}

function openPreview(attachment: MessageAttachment): void {
  previewAttachment.value = attachment
}

function closePreview(): void {
  previewAttachment.value = null
}

function normalizeClipboardFile(file: File): File {
  if (file.name.trim()) {
    return file
  }

  const extension = mimeTypeToExtension(file.type)
  return new File([file], `clipboard-${Date.now()}.${extension}`, {
    type: file.type || 'image/png',
    lastModified: Date.now(),
  })
}

function mimeTypeToExtension(mimeType: string): string {
  if (!mimeType.startsWith('image/')) {
    return 'png'
  }

  const extension = mimeType.slice('image/'.length).trim()
  return extension || 'png'
}
</script>

<template>
  <form class="composer-form" @submit.prevent="handleSubmit">
    <div class="input-wrapper">
      <textarea
        :value="props.modelValue"
        placeholder="给 DeepSeek 发送消息..."
        rows="1"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value); adjustHeight($event)"
        @keydown="onKeydown"
        @paste="handlePaste"
      />

      <div v-if="hasAttachments" class="attachment-strip">
        <div
          v-for="attachment in props.attachments"
          :key="attachment.id"
          class="attachment-item"
        >
          <button
            class="attachment-preview-button"
            type="button"
            @click="openPreview(attachment)"
          >
            <img
              :src="attachment.dataUrl"
              :alt="attachment.name"
              class="attachment-thumb"
            />
          </button>
          <button
            class="attachment-remove"
            type="button"
            title="移除图片"
            @click="removeAttachment(attachment.id)"
          >
            ×
          </button>
        </div>
      </div>

      <div class="composer-controls">
        <div class="composer-actions">
          <button
            class="image-button"
            type="button"
            :disabled="props.sendDisabled"
            title="添加图片"
            @click="openImagePicker"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"></rect>
              <circle cx="9" cy="9" r="2"></circle>
              <path d="M21 15l-5-5L5 21"></path>
            </svg>
          </button>
          <input
            ref="fileInputRef"
            class="hidden-file-input"
            accept="image/*"
            multiple
            type="file"
            @change="handleImageInput"
          />
          <slot name="actions"></slot>
        </div>
        <button
          v-if="props.isSending"
          class="stop-button"
          type="button"
          title="停止生成"
          @click="emit('stop')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2"></rect>
          </svg>
        </button>
        <button
          v-else
          class="send-button"
          type="submit"
          :disabled="props.sendDisabled || !props.canSend"
          title="发送 (Enter)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  </form>

  <div
    v-if="previewAttachment"
    class="preview-overlay"
    @click.self="closePreview"
  >
    <div class="preview-panel">
      <img
        :src="previewAttachment.dataUrl"
        :alt="previewAttachment.name"
        class="preview-image"
      />
      <button class="preview-close" type="button" @click="closePreview">关闭</button>
    </div>
  </div>
</template>

<style scoped>
.composer-form {
  position: relative;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.input-wrapper {
  display: flex;
  flex-direction: column;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--panel-shadow);
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.input-wrapper:focus-within {
  border-color: var(--accent);
  box-shadow: 0 10px 24px rgba(16, 163, 127, 0.12);
  transform: translateY(-1px);
}

textarea {
  width: 100%;
  min-height: 42px;
  max-height: 200px;
  padding: 12px 14px 8px;
  resize: none;
  line-height: 1.5;
  color: var(--text);
  font-size: 0.93rem;
}

textarea::placeholder {
  color: var(--text-muted);
}

.composer-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 4px 10px 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.03);
}

.composer-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.image-button {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  border: 1px solid var(--border);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-soft);
}

.image-button:hover:not(:disabled) {
  color: var(--text);
  background: var(--bg-hover);
}

.image-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hidden-file-input {
  display: none;
}

.attachment-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px 8px;
  overflow-x: auto;
}

.attachment-item {
  position: relative;
  flex: none;
}

.attachment-preview-button {
  border-radius: 10px;
  border: 1px solid var(--border);
  overflow: hidden;
  width: 52px;
  height: 52px;
  display: block;
}

.attachment-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.attachment-remove {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  color: #fff;
  background: rgba(15, 23, 42, 0.72);
  font-size: 0.7rem;
  line-height: 1;
}



.send-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #fff;
  transition: opacity 150ms, transform 150ms;
}

.stop-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: rgba(239, 68, 68, 0.12);
  color: var(--danger);
  transition: background 150ms, transform 150ms, color 150ms;
}

.send-button:not(:disabled):hover {
  transform: translateY(-1px);
}

.stop-button:hover {
  background: rgba(239, 68, 68, 0.18);
  transform: translateY(-1px);
}

.send-button:disabled {
  background: var(--bg-active);
  color: var(--text-muted);
  cursor: not-allowed;
  opacity: 0.7;
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
</style>
