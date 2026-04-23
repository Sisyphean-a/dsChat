<script setup lang="ts">

const props = defineProps<{
  isSending: boolean
  modelValue: string
  sendDisabled: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: []
  stop: []
}>()

function handleSubmit(): void {
  if (!props.sendDisabled && props.modelValue.trim() !== '') {
    emit('send')
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (!props.sendDisabled && props.modelValue.trim() !== '') {
      emit('send')
    }
  }
}

function adjustHeight(event: Event) {
  const target = event.target as HTMLTextAreaElement
  target.style.height = 'auto'
  const newHeight = Math.min(target.scrollHeight, 200)
  target.style.height = `${newHeight}px`
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
      />
      
      <div class="composer-controls">
        <div class="composer-actions">
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
          :disabled="props.sendDisabled || !props.modelValue.trim()"
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
</style>
