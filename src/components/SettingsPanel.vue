<script setup lang="ts">
import type { SettingsForm } from '../types/chat'

const props = defineProps<{
  isBrowserMode: boolean
  open: boolean
  saving: boolean
  settings: SettingsForm
}>()

const emit = defineEmits<{
  close: []
  save: []
  updateField: [field: keyof SettingsForm, value: string]
}>()
</script>

<template>
  <div v-if="props.open" class="settings-overlay" @click.self="emit('close')">
    <section class="settings-panel">
      <div class="settings-header">
        <div>
          <h2>设置</h2>
        </div>
        <button class="close-button" type="button" @click="emit('close')">
          关闭
        </button>
      </div>

      <p v-if="props.isBrowserMode" class="hint">
        当前不在 uTools 环境，保存后仅在本次页面生命周期内可见。
      </p>

      <label class="field">
        <span>API Key</span>
        <input
          :value="props.settings.apiKey"
          placeholder="sk-..."
          type="password"
          @input="emit('updateField', 'apiKey', ($event.target as HTMLInputElement).value)"
        />
      </label>

      <label class="field">
        <span>Base URL</span>
        <input
          :value="props.settings.baseUrl"
          placeholder="https://api.deepseek.com"
          type="text"
          @input="emit('updateField', 'baseUrl', ($event.target as HTMLInputElement).value)"
        />
      </label>



      <button class="save-button" type="button" :disabled="props.saving" @click="emit('save')">
        {{ props.saving ? '保存中...' : '保存设置' }}
      </button>
    </section>
  </div>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(27, 32, 34, 0.32);
  backdrop-filter: blur(10px);
}

.settings-panel {
  width: min(480px, 100%);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  border-radius: var(--radius-lg, 12px);
  background: var(--bg);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.settings-header h2 {
  margin: 0;
}

.hint {
  margin: 0;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--text-muted);
}

.field input {
  padding: 10px 14px;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-family: monospace;
}

.field input:focus {
  border-color: var(--accent);
  outline: none;
}

.save-button,
.close-button {
  padding: 10px 16px;
  border-radius: var(--radius-md, 8px);
  font-size: 0.95rem;
  font-weight: 500;
  transition: background 150ms;
}

.save-button {
  background: var(--accent);
  color: #fff;
  border: none;
}

.save-button:hover:not(:disabled) {
  opacity: 0.9;
}

.save-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.close-button {
  background: transparent;
  color: var(--text-muted);
}

.close-button:hover {
  background: var(--bg-hover);
  color: var(--text);
}
</style>
