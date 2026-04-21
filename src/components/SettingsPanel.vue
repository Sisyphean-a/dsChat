<script setup lang="ts">
import { computed } from 'vue'
import { getProviderDefinition, getProviderDefinitions } from '../constants/providers'
import { modelSupportsTemperature } from '../composables/chatAppSettings'
import type { ProviderId, ProviderSettings, SettingsForm, ThemeMode } from '../types/chat'

const props = defineProps<{
  isBrowserMode: boolean
  open: boolean
  saving: boolean
  settings: SettingsForm
}>()

const emit = defineEmits<{
  close: []
  save: []
  selectProvider: [provider: ProviderId]
  updateProviderField: [field: keyof ProviderSettings, value: string | number]
  updateTheme: [theme: ThemeMode]
}>()

const providerOptions = getProviderDefinitions()
const themeCards: Array<{ label: string; summary: string; value: ThemeMode }> = [
  { label: '浅色', summary: '', value: 'light' },
  { label: '夜色', summary: '', value: 'dark' },
]

const activeProviderMeta = computed(() => getProviderDefinition(props.settings.activeProvider))
const activeProviderSettings = computed(() => props.settings.providers[props.settings.activeProvider])
const temperatureActive = computed(() => {
  return modelSupportsTemperature(props.settings.activeProvider, activeProviderSettings.value.model)
})
const temperatureLabel = computed(() => activeProviderSettings.value.temperature.toFixed(1))

function providerStatus(provider: ProviderId): string {
  return props.settings.providers[provider].apiKey.trim() ? '已配' : '未配'
}
</script>

<template>
  <transition name="settings-fade">
    <div v-if="props.open" class="settings-overlay" @click.self="emit('close')">
      <section class="settings-panel">
        <div class="settings-header">
          <h2>模型设置</h2>
          <button class="close-button" type="button" @click="emit('close')">关闭</button>
        </div>

        <p v-if="props.isBrowserMode" class="hint">
          浏览器预览模式，不持久化。
        </p>

        <div class="settings-body">
          <aside class="provider-rail">
            <button
              v-for="provider in providerOptions"
              :key="provider.id"
              class="provider-card"
              :class="{ active: provider.id === props.settings.activeProvider }"
              type="button"
              @click="emit('selectProvider', provider.id)"
            >
              <div class="provider-top">
                <strong>{{ provider.label }}</strong>
                <span>{{ providerStatus(provider.id) }}</span>
              </div>
            </button>
          </aside>

          <div class="config-stage">
            <section class="panel-block">
              <div class="block-header">
                <span>{{ activeProviderMeta.label }}</span>
                <small>{{ activeProviderSettings.baseUrl }}</small>
              </div>
              <div class="model-grid">
                <button
                  v-for="model in activeProviderMeta.models"
                  :key="model.value"
                  class="model-card"
                  :class="{ active: model.value === activeProviderSettings.model }"
                  type="button"
                  @click="emit('updateProviderField', 'model', model.value)"
                >
                  <strong>{{ model.shortLabel }}</strong>
                </button>
              </div>
            </section>

            <div class="field-grid">
              <label class="field">
                <span>模型 ID</span>
                <input
                  :value="activeProviderSettings.model"
                  type="text"
                  @input="emit('updateProviderField', 'model', ($event.target as HTMLInputElement).value)"
                />
              </label>

              <label class="field">
                <span>Base URL</span>
                <input
                  :value="activeProviderSettings.baseUrl"
                  :placeholder="activeProviderMeta.baseUrlPlaceholder"
                  type="text"
                  @input="emit('updateProviderField', 'baseUrl', ($event.target as HTMLInputElement).value)"
                />
              </label>
            </div>

            <label class="field">
              <span>API Key</span>
              <input
                :value="activeProviderSettings.apiKey"
                :placeholder="activeProviderMeta.apiKeyPlaceholder"
                type="password"
                @input="emit('updateProviderField', 'apiKey', ($event.target as HTMLInputElement).value)"
              />
            </label>

            <section class="panel-block">
              <div class="block-header">
                <span>Temperature</span>
                <strong>{{ temperatureLabel }}</strong>
              </div>
              <p v-if="!temperatureActive" class="hint subtle">
                当前模型忽略 temperature。
              </p>
              <div class="temperature-row" :class="{ inactive: !temperatureActive }">
                <input
                  class="temperature-slider"
                  :value="activeProviderSettings.temperature"
                  :max="activeProviderMeta.temperature.max"
                  :min="activeProviderMeta.temperature.min"
                  step="0.1"
                  type="range"
                  @input="emit('updateProviderField', 'temperature', Number(($event.target as HTMLInputElement).value))"
                />
                <input
                  class="temperature-input"
                  :value="temperatureLabel"
                  :max="activeProviderMeta.temperature.max"
                  :min="activeProviderMeta.temperature.min"
                  step="0.1"
                  type="number"
                  @input="emit('updateProviderField', 'temperature', Number(($event.target as HTMLInputElement).value))"
                />
              </div>
            </section>

            <section class="panel-block">
              <div class="block-header">
                <span>主题</span>
              </div>
              <div class="theme-grid">
                <button
                  v-for="theme in themeCards"
                  :key="theme.value"
                  class="theme-card"
                  :class="{ active: props.settings.theme === theme.value }"
                  type="button"
                  @click="emit('updateTheme', theme.value)"
                >
                  <strong>{{ theme.label }}</strong>
                </button>
              </div>
            </section>
          </div>
        </div>

        <div class="footer-actions">
          <button class="save-button" type="button" :disabled="props.saving" @click="emit('save')">
            {{ props.saving ? '保存中...' : '保存' }}
          </button>
        </div>
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
  width: min(720px, 100%);
  max-height: min(760px, 100%);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 16px;
  background: var(--bg);
  border: 1px solid var(--border);
  box-shadow: var(--panel-shadow);
}

.settings-header,
.provider-top,
.block-header,
.footer-actions {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.settings-header h2 {
  margin: 0;
}

.hint {
  margin: 0;
  padding: 8px 10px;
  border-radius: 10px;
}

.hint {
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 0.78rem;
}

.hint.subtle {
  background: var(--bg-hover);
  color: var(--text-muted);
}

.settings-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 116px 1fr;
  gap: 10px;
}

.provider-rail,
.config-stage {
  min-height: 0;
  overflow: auto;
}

.provider-rail {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.provider-card,
.model-card,
.theme-card,
.save-button,
.close-button {
  transition: background 150ms, border-color 150ms, transform 150ms, opacity 150ms, box-shadow 150ms;
}

.provider-card,
.model-card,
.theme-card {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-soft);
  text-align: left;
}

.provider-card.active,
.provider-card:hover,
.model-card.active,
.model-card:hover,
.theme-card.active,
.theme-card:hover {
  border-color: rgba(16, 163, 127, 0.28);
  background: var(--bg-hover);
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(16, 163, 127, 0.08);
}

.provider-top span {
  font-size: 0.7rem;
  color: var(--accent-strong);
}

.config-stage {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 2px;
}

.block-header strong,
.block-header span,
.model-card strong {
  color: var(--text);
}

.block-header small {
  max-width: 48%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 0.74rem;
}

.panel-block,
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field span {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.field input,
.temperature-input {
  padding: 8px 10px;
  border-radius: 8px;
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

.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.model-grid,
.theme-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.model-card,
.theme-card {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
}

.temperature-row {
  display: grid;
  grid-template-columns: 1fr 96px;
  gap: 8px;
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
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 0.88rem;
  font-weight: 500;
}

.save-button {
  background: var(--accent);
  color: #fff;
}

.footer-actions {
  justify-content: flex-end;
}

.save-button:hover:not(:disabled),
.close-button:hover {
  transform: translateY(-1px);
}

.save-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.close-button {
  color: var(--text-muted);
}

.close-button:hover {
  background: var(--bg-hover);
  color: var(--text);
}

@media (max-width: 780px) {
  .settings-body,
  .field-grid,
  .model-grid,
  .theme-grid,
  .temperature-row {
    grid-template-columns: 1fr;
  }

  .settings-body {
    grid-template-columns: 1fr;
  }

  .provider-rail {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
