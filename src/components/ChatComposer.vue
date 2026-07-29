<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  PhBrain,
  PhImageSquare,
  PhPaperPlaneTilt,
  PhStop,
  PhX,
} from '@phosphor-icons/vue'
import ImagePreviewDialog from './ImagePreviewDialog.vue'
import type { MessageAttachment, ThinkingLevel } from '../types/chat'
import type { ThinkingOption } from '../constants/thinking'

const props = withDefaults(defineProps<{
  attachments: MessageAttachment[]
  canSend: boolean
  focusPosition?: 'start' | 'end'
  focusSignal?: number
  isSending: boolean
  modelValue: string
  placeholder?: string
  sendDisabled: boolean
  thinkingLevel?: ThinkingLevel
  thinkingOptions?: ThinkingOption[]
}>(), {
  thinkingLevel: 'off',
  thinkingOptions: () => [],
})

const emit = defineEmits<{
  addImages: [files: File[]]
  removeAttachment: [id: string]
  updateThinkingLevel: [value: ThinkingLevel]
  'update:modelValue': [value: string]
  send: []
  stop: []
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const previewAttachment = ref<MessageAttachment | null>(null)
const hasAttachments = computed(() => props.attachments.length > 0)
const thinkingLevelLabel = computed(() => {
  return props.thinkingOptions.find((option) => option.value === props.thinkingLevel)?.label
    ?? props.thinkingLevel
})
const MIN_TEXTAREA_HEIGHT = 44
const MAX_TEXTAREA_HEIGHT = 200

function handleSubmit(): void {
  if (!props.sendDisabled && props.canSend) {
    emit('send')
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.isComposing || event.keyCode === 229) {
    return
  }

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

async function focusTextarea(): Promise<void> {
  await nextTick()
  const textarea = textareaRef.value
  if (!textarea) {
    return
  }

  textarea.focus()
  const position = props.focusPosition === 'start' ? 0 : textarea.value.length
  textarea.setSelectionRange(position, position)
}

watch(
  () => props.modelValue,
  async () => {
    await nextTick()
    syncTextareaHeight()
  },
)

watch(
  () => props.focusSignal,
  (next, prev) => {
    if (!next || next === prev) {
      return
    }

    void focusTextarea()
  },
)

onMounted(() => {
  syncTextareaHeight()
  if (props.focusSignal) {
    void focusTextarea()
  }
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

function handleThinkingLevelChange(value: string): void {
  const selected = props.thinkingOptions.find((option) => option.value === value)
  if (selected) {
    emit('updateThinkingLevel', selected.value)
  }
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
        :placeholder="props.placeholder ?? '输入消息...'"
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
            :aria-label="`预览 ${attachment.name}`"
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
            :aria-label="`移除 ${attachment.name}`"
            class="attachment-remove"
            type="button"
            title="移除图片"
            @click="removeAttachment(attachment.id)"
          >
            <PhX :size="14" aria-hidden="true" weight="bold" />
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
            aria-label="添加图片"
          >
            <PhImageSquare :size="18" aria-hidden="true" class="composer-toolbar-icon" weight="regular" />
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
            v-if="props.thinkingOptions.length"
            class="thinking-level-control"
            :class="{ disabled: props.sendDisabled }"
          >
            <PhBrain :size="16" aria-hidden="true" class="thinking-level-icon" weight="regular" />
            <span class="thinking-level-label">思考</span>
            <span class="thinking-level-value" aria-hidden="true">{{ thinkingLevelLabel }}</span>
            <svg aria-hidden="true" class="thinking-level-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            <select
              class="thinking-level-select"
              aria-label="选择思考等级"
              :value="props.thinkingLevel"
              :disabled="props.sendDisabled"
              @change="handleThinkingLevelChange(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="option in props.thinkingOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>
        <button
          v-if="props.isSending"
          class="stop-button"
          type="button"
          title="停止生成"
          @click="emit('stop')"
          aria-label="停止生成"
        >
          <PhStop :size="16" aria-hidden="true" weight="fill" />
        </button>
        <button
          v-else
          class="send-button"
          type="submit"
          :disabled="props.sendDisabled || !props.canSend"
          title="发送 (Enter)"
          aria-label="发送"
        >
          <PhPaperPlaneTilt :size="18" aria-hidden="true" weight="fill" />
        </button>
      </div>
    </div>
  </form>

  <ImagePreviewDialog :attachment="previewAttachment" @close="closePreview" />
</template>
<style scoped src="../styles/chat-composer.css"></style>
