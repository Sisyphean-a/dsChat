<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { MessageAttachment } from '../types/chat'

const props = defineProps<{
  attachments: MessageAttachment[]
  canSend: boolean
  isSending: boolean
  modelValue: string
  sendDisabled: boolean
  showThinkingToggle: boolean
  thinkingEnabled: boolean
}>()

const emit = defineEmits<{
  addImages: [files: File[]]
  removeAttachment: [id: string]
  updateThinkingEnabled: [value: boolean]
  'update:modelValue': [value: string]
  send: []
  stop: []
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const previewAttachment = ref<MessageAttachment | null>(null)
const hasAttachments = computed(() => props.attachments.length > 0)
const MIN_TEXTAREA_HEIGHT = 44
const MAX_TEXTAREA_HEIGHT = 200

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
  resizeTextarea(target)
}

function resizeTextarea(target: HTMLTextAreaElement): void {
  if (!target.value.trim()) {
    target.style.overflowY = 'hidden'
    target.style.height = `${MIN_TEXTAREA_HEIGHT}px`
    return
  }

  target.style.height = 'auto'
  const exceedsMaxHeight = target.scrollHeight > MAX_TEXTAREA_HEIGHT
  const newHeight = Math.max(Math.min(target.scrollHeight, MAX_TEXTAREA_HEIGHT), MIN_TEXTAREA_HEIGHT)
  target.style.height = `${newHeight}px`
  target.style.overflowY = exceedsMaxHeight ? 'auto' : 'hidden'
}

function syncTextareaHeight(): void {
  const target = textareaRef.value
  if (!target) {
    return
  }

  resizeTextarea(target)
}

watch(
  () => props.modelValue,
  async () => {
    await nextTick()
    syncTextareaHeight()
  },
)

onMounted(() => {
  syncTextareaHeight()
})

function openImagePicker(): void {
  fileInputRef.value?.click()
}

function restoreUtoolsWindow(): void {
  window.utools?.showMainWindow?.()
}

function handleImageInput(event: Event): void {
  const target = event.target as HTMLInputElement
  const files = target.files ? Array.from(target.files).map(normalizeClipboardFile) : []
  if (files.length) {
    emit('addImages', files)
  }

  target.value = ''
  restoreUtoolsWindow()
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

function handleThinkingChange(event: Event): void {
  emit('updateThinkingEnabled', (event.target as HTMLInputElement).checked)
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
        ref="textareaRef"
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
          <label
            v-if="props.showThinkingToggle"
            class="thinking-toggle"
            :class="{ disabled: props.sendDisabled }"
          >
            <input
              class="thinking-toggle-input"
              type="checkbox"
              :checked="props.thinkingEnabled"
              :disabled="props.sendDisabled"
              @change="handleThinkingChange"
            />
            <span class="thinking-toggle-track" aria-hidden="true">
              <span class="thinking-toggle-thumb"></span>
            </span>
            <span class="thinking-toggle-text">思考</span>
          </label>
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
<style scoped src="../styles/chat-composer.css"></style>
