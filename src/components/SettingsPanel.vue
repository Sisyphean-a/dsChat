<script setup lang="ts">
import type { SettingsForm } from '../types/chat'

const props = defineProps<{
  isBrowserMode: boolean
  modelOptions: string[]
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
          <p class="eyebrow">连接设置</p>
          <h2>DeepSeek 与本地持久化</h2>
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

      <label class="field">
        <span>模型</span>
        <select
          :value="props.settings.model"
          @change="emit('updateField', 'model', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="model in props.modelOptions" :key="model" :value="model">
            {{ model }}
          </option>
        </select>
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
  width: min(560px, 100%);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  border-radius: 28px;
  background: #fbf8f1;
  box-shadow: 0 28px 60px rgba(37, 48, 54, 0.2);
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

.field input,
.field select {
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: #fff;
  color: var(--text);
}

.save-button,
.close-button {
  padding: 13px 16px;
  border-radius: 16px;
}

.save-button {
  background: linear-gradient(180deg, var(--accent), var(--accent-strong));
  color: #eff7f4;
}

.close-button {
  background: rgba(37, 48, 54, 0.06);
  color: var(--text-muted);
}
</style>
