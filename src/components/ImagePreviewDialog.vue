<script setup lang="ts">
import { computed, ref } from 'vue'
import { PhX } from '@phosphor-icons/vue'
import { useModalFocus } from '../composables/useModalFocus'
import type { MessageAttachment } from '../types/chat'

const props = defineProps<{
  attachment: MessageAttachment | null
}>()

const emit = defineEmits<{
  close: []
}>()

const closeButtonRef = ref<HTMLButtonElement | null>(null)
const overlayRef = ref<HTMLElement | null>(null)
const imageDetails = computed(() => {
  if (!props.attachment) {
    return ''
  }

  return `${props.attachment.width} × ${props.attachment.height}`
})

function close(): void {
  emit('close')
}

const { handleModalKeydown } = useModalFocus({
  close,
  container: overlayRef,
  initialFocus: closeButtonRef,
  isOpen: () => props.attachment !== null,
})
</script>

<template>
  <div
    v-if="attachment"
    ref="overlayRef"
    aria-label="图片预览"
    aria-modal="true"
    class="image-preview-overlay"
    role="dialog"
    tabindex="-1"
    @click.self="close"
    @keydown="handleModalKeydown"
  >
    <section class="image-preview-panel">
      <header class="image-preview-toolbar">
        <div class="image-preview-info">
          <p class="image-preview-name" :title="attachment.name">{{ attachment.name }}</p>
          <span class="image-preview-details">{{ imageDetails }}</span>
        </div>
        <button
          ref="closeButtonRef"
          aria-label="关闭图片预览"
          class="image-preview-close"
          title="关闭图片预览"
          type="button"
          @click="close"
        >
          <PhX :size="18" aria-hidden="true" weight="bold" />
        </button>
      </header>
      <div class="image-preview-media">
        <img
          :src="attachment.dataUrl"
          :alt="attachment.name"
          class="image-preview-image"
        />
      </div>
    </section>
  </div>
</template>

<style scoped src="../styles/image-preview-dialog.css"></style>
