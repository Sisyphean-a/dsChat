<script setup lang="ts">
import { computed } from 'vue'
import { modelSupportsTemperature } from '../composables/chatAppSettings'
import type { SettingsForm, ThemeMode } from '../types/chat'

const props = defineProps<{
  isBrowserMode: boolean
  open: boolean
  saving: boolean
  settings: SettingsForm
}>()

const emit = defineEmits<{
  close: []
  save: []
  updateField: [field: keyof SettingsForm, value: string | number]
}>()

const themeCards: Array<{ label: string; summary: string; value: ThemeMode }> = [
  { label: '浅色', summary: '延续当前简洁亮色风格', value: 'light' },
  { label: '夜色', summary: '夜间使用更柔和', value: 'dark' },
]

const temperatureActive = computed(() => modelSupportsTemperature(props.settings.model))
const temperatureLabel = computed(() => props.settings.temperature.toFixed(1))
</script>

<template>
  <transition name="settings-fade">
    <div v-if="props.open" class="settings-overlay" @click.self="emit('close')">
      <section class="settings-panel">
        <div class="settings-header">
          <div>
            <h2>设置</h2>
            <p>控制接口、主题与采样参数。</p>
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

        <section class="panel-block">
          <div class="block-header">
            <span>主题</span>
            <small>即时预览</small>
          </div>
          <div class="theme-grid">
            <button
              v-for="theme in themeCards"
              :key="theme.value"
              class="theme-card"
              :class="{ active: props.settings.theme === theme.value }"
              type="button"
              @click="emit('updateField', 'theme', theme.value)"
            >
              <strong>{{ theme.label }}</strong>
              <span>{{ theme.summary }}</span>
            </button>
          </div>
        </section>

        <section class="panel-block">
          <div class="block-header">
            <span>Temperature</span>
            <strong>{{ temperatureLabel }}</strong>
          </div>
          <p v-if="!temperatureActive" class="hint subtle">
            当前模型为 `deepseek-reasoner`。DeepSeek 官方文档说明：`temperature` 可以传入，但不会生效。
          </p>
          <div class="temperature-row" :class="{ inactive: !temperatureActive }">
            <input
              class="temperature-slider"
              :value="props.settings.temperature"
              max="2"
              min="0"
              step="0.1"
              type="range"
              @input="emit('updateField', 'temperature', Number(($event.target as HTMLInputElement).value))"
            />
            <input
              class="temperature-input"
              :value="temperatureLabel"
              max="2"
              min="0"
              step="0.1"
              type="number"
              @input="emit('updateField', 'temperature', Number(($event.target as HTMLInputElement).value))"
            />
          </div>
        </section>

        <button class="save-button" type="button" :disabled="props.saving" @click="emit('save')">
          {{ props.saving ? '保存中...' : '保存设置' }}
        </button>
      </section>
    </div>
  </transition>
</template>

<style scoped>
.settings-fade-enter-active,
.settings-fade-leave-active {
  transition: opacity 180ms ease;
}

.settings-fade-enter-active .settings-panel,
.settings-fade-leave-active .settings-panel {
  transition: opacity 180ms ease, transform 180ms ease;
}

.settings-fade-enter-from,
.settings-fade-leave-to {
  opacity: 0;
}

.settings-fade-enter-from .settings-panel,
.settings-fade-leave-to .settings-panel {
  opacity: 0;
  transform: translateY(8px) scale(0.985);
}

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
  gap: 18px;
  padding: 24px;
  border-radius: 16px;
  background: var(--bg);
  border: 1px solid var(--border);
  box-shadow: var(--panel-shadow);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.settings-header h2,
.settings-header p {
  margin: 0;
}

.settings-header p {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.hint {
  margin: 0;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 0.85rem;
  line-height: 1.6;
}

.hint.subtle {
  background: var(--bg-hover);
  color: var(--text-muted);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--text-muted);
}

.field input,
.temperature-input {
  padding: 10px 14px;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-mono);
}

.field input:focus,
.temperature-input:focus {
  border-color: var(--accent);
  outline: none;
}

.panel-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.block-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  color: var(--text-muted);
}

.block-header strong,
.block-header span {
  color: var(--text);
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.theme-card {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg-soft);
  text-align: left;
  transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
}

.theme-card strong {
  color: var(--text);
}

.theme-card span {
  color: var(--text-muted);
  font-size: 0.82rem;
}

.theme-card:hover,
.theme-card.active {
  transform: translateY(-1px);
  border-color: rgba(16, 163, 127, 0.28);
  background: var(--bg-hover);
  box-shadow: 0 8px 18px rgba(16, 163, 127, 0.08);
}

.temperature-row {
  display: grid;
  grid-template-columns: 1fr 92px;
  gap: 10px;
  align-items: center;
}

.temperature-row.inactive {
  opacity: 0.75;
}

.temperature-slider {
  width: 100%;
  accent-color: var(--accent);
}

.save-button,
.close-button {
  padding: 10px 16px;
  border-radius: var(--radius-md, 8px);
  font-size: 0.95rem;
  font-weight: 500;
  transition: background 150ms, opacity 150ms, transform 150ms;
}

.save-button {
  background: var(--accent);
  color: #fff;
  border: none;
}

.save-button:hover:not(:disabled) {
  opacity: 0.92;
  transform: translateY(-1px);
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

@media (max-width: 640px) {
  .theme-grid,
  .temperature-row {
    grid-template-columns: 1fr;
  }
}
</style>
