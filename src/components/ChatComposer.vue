<script setup lang="ts">

const props = defineProps<{
  disabled: boolean
  modelName: string
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: []
}>()

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (!props.disabled && props.modelValue.trim() !== '') {
      emit('send')
    }
  }
}
</script>

<template>
  <form class="composer-form" @submit.prevent="emit('send')">
    <div class="input-wrapper" :class="{ 'is-disabled': props.disabled }">
      <textarea
        :disabled="props.disabled"
        :value="props.modelValue"
        placeholder="给 DeepSeek 发送消息..."
        rows="1"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        @keydown="onKeydown"
      />
      
      <div class="composer-controls">
        <span class="model-badge" title="当前模型">{{ props.modelName }}</span>
        <button 
          class="send-button" 
          type="submit" 
          :disabled="props.disabled || !props.modelValue.trim()"
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
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: border-color 200ms, box-shadow 200ms;
}

.input-wrapper:focus-within {
  border-color: var(--accent);
  box-shadow: 0 4px 12px rgba(16, 163, 127, 0.1);
}

.input-wrapper.is-disabled {
  background: var(--bg-hover);
}

textarea {
  width: 100%;
  min-height: 48px;
  max-height: 200px;
  padding: 14px 16px;
  resize: vertical;
  line-height: 1.5;
  color: var(--text);
  font-size: 0.95rem;
}

textarea::placeholder {
  color: var(--text-muted);
}

.composer-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
}

.model-badge {
  font-size: 0.75rem;
  color: var(--text-muted);
  background: var(--bg-hover);
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  user-select: none;
}

.send-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #fff;
  transition: opacity 150ms, transform 150ms;
}

.send-button:not(:disabled):hover {
  transform: translateY(-1px);
}

.send-button:disabled {
  background: var(--bg-active);
  color: var(--text-muted);
  cursor: not-allowed;
  opacity: 0.7;
}
</style>
