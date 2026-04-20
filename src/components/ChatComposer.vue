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
    emit('send')
  }
}
</script>

<template>
  <form class="composer" @submit.prevent="emit('send')">
    <div class="composer-meta">
      <span>当前模型：{{ props.modelName }}</span>
      <span>{{ props.disabled ? '回复生成中' : '按 Enter 发送，Shift + Enter 换行' }}</span>
    </div>
    <div class="composer-row">
      <textarea
        :disabled="props.disabled"
        :value="props.modelValue"
        placeholder="问点需要真正解决的问题。"
        rows="4"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        @keydown="onKeydown"
      />
      <button class="send-button" type="submit" :disabled="props.disabled">
        发送
      </button>
    </div>
  </form>
</template>

<style scoped>
.composer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border-radius: 22px;
  background: var(--panel-strong);
  border: 1px solid var(--border);
}

.composer-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.82rem;
  color: var(--text-muted);
}

.composer-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112px;
  gap: 12px;
}

textarea {
  width: 100%;
  resize: none;
  padding: 16px 18px;
  border-radius: 16px;
  background: #ffffff;
  line-height: 1.7;
  color: var(--text);
}

textarea::placeholder {
  color: #8a969b;
}

.send-button {
  border-radius: 18px;
  background: linear-gradient(180deg, var(--accent), var(--accent-strong));
  color: #eff7f4;
  font-size: 0.96rem;
}

.send-button:disabled,
textarea:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

@media (max-width: 640px) {
  .composer-meta,
  .composer-row {
    grid-template-columns: 1fr;
  }
}
</style>
