<script setup lang="ts">
import { UTOOLS_UPLOAD_MODE_OPTIONS } from '../constants/storage'
import {
  getAddableProviderDefinitions,
  getProviderDefinition,
  getProviderModelOptions,
} from '../constants/providers'
import type {
  AddableProviderId,
  ProviderSettings,
  SettingsForm,
  ThemeMode,
  UtoolsUploadMode,
} from '../types/chat'

type CustomModelField = keyof ProviderSettings | 'name'

const props = defineProps<{
  isBrowserMode: boolean
  open: boolean
  saving: boolean
  settings: SettingsForm
}>()

const emit = defineEmits<{
  addCustomModel: [provider: AddableProviderId]
  close: []
  removeCustomModel: [id: string]
  save: []
  selectActiveConfig: [configId: string]
  updateCustomModelField: [id: string, field: CustomModelField, value: string | number]
  updateDeepseekField: [field: keyof ProviderSettings, value: string | number]
  updateTheme: [theme: ThemeMode]
  updateUtoolsUploadMode: [mode: UtoolsUploadMode]
}>()

const themeCards: Array<{ label: string; value: ThemeMode }> = [
  { label: '浅色', value: 'light' },
  { label: '夜色', value: 'dark' },
]

const addableProviders = getAddableProviderDefinitions()
const deepseekOptions = getProviderModelOptions('deepseek')
const uploadModeOptions = UTOOLS_UPLOAD_MODE_OPTIONS
</script>

<template>
  <transition name="settings-fade">
    <div v-if="props.open" class="settings-overlay" @click.self="emit('close')">
      <section class="settings-panel">
        <header class="settings-header">
          <h2>设置</h2>
          <div class="header-actions">
            <button class="ghost-action" type="button" @click="emit('close')">取消</button>
            <button class="primary-action" type="button" :disabled="props.saving" @click="emit('save')">
              {{ props.saving ? '保存中' : '完成' }}
            </button>
          </div>
        </header>

        <div class="settings-body">
          <section class="setting-group">
            <h3>外观</h3>
            
            <div class="preference-row">
              <div class="theme-toggle">
                <button
                  v-for="theme in themeCards"
                  :key="theme.value"
                  :class="{ active: props.settings.theme === theme.value }"
                  type="button"
                  @click="emit('updateTheme', theme.value)"
                >
                  {{ theme.label }}
                </button>
              </div>
            </div>
          </section>

          <section class="setting-group">
            <h3>存储</h3>

            <div class="preference-row">
              <select
                class="storage-select"
                :value="props.settings.utoolsUploadMode"
                @change="emit('updateUtoolsUploadMode', ($event.target as HTMLSelectElement).value as UtoolsUploadMode)"
              >
                <option
                  v-for="option in uploadModeOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>
          </section>

          <section class="setting-group">
            <h3>服务提供商</h3>
            
            <!-- DeepSeek -->
            <div class="provider-card">
              <div class="provider-head">
                <h4>DeepSeek</h4>
              </div>
              <div class="field-grid">
                <input
                  :value="props.settings.deepseek.baseUrl"
                  :placeholder="getProviderDefinition('deepseek').baseUrlPlaceholder || 'Base URL'"
                  type="text"
                  @input="emit('updateDeepseekField', 'baseUrl', ($event.target as HTMLInputElement).value)"
                />
                <input
                  :value="props.settings.deepseek.apiKey"
                  :placeholder="getProviderDefinition('deepseek').apiKeyPlaceholder || 'API Key'"
                  type="password"
                  @input="emit('updateDeepseekField', 'apiKey', ($event.target as HTMLInputElement).value)"
                />
                <input
                  :value="props.settings.deepseek.model"
                  placeholder="自定义模型 ID"
                  type="text"
                  @input="emit('updateDeepseekField', 'model', ($event.target as HTMLInputElement).value)"
                />
              </div>
              <div class="chip-grid">
                <button
                  v-for="model in deepseekOptions"
                  :key="model.value"
                  class="chip-button"
                  :class="{ active: model.value === props.settings.deepseek.model }"
                  type="button"
                  @click="emit('updateDeepseekField', 'model', model.value)"
                >
                  {{ model.shortLabel }}
                </button>
              </div>
            </div>

            <!-- Custom Models -->
            <div
              v-for="item in props.settings.customModels"
              :key="item.id"
              class="provider-card"
            >
              <div class="provider-head">
                <input
                  class="transparent-input"
                  :value="item.name"
                  placeholder="未命名模型"
                  type="text"
                  @input="emit('updateCustomModelField', item.id, 'name', ($event.target as HTMLInputElement).value)"
                />
                <button class="danger-text" type="button" @click="emit('removeCustomModel', item.id)">删除</button>
              </div>
              <div class="field-grid">
                <input
                  :value="item.baseUrl"
                  :placeholder="getProviderDefinition(item.provider)?.baseUrlPlaceholder || 'Base URL'"
                  type="text"
                  @input="emit('updateCustomModelField', item.id, 'baseUrl', ($event.target as HTMLInputElement).value)"
                />
                <input
                  :value="item.apiKey"
                  :placeholder="getProviderDefinition(item.provider)?.apiKeyPlaceholder || 'API Key'"
                  type="password"
                  @input="emit('updateCustomModelField', item.id, 'apiKey', ($event.target as HTMLInputElement).value)"
                />
                <input
                  :value="item.model"
                  placeholder="自定义模型 ID"
                  type="text"
                  @input="emit('updateCustomModelField', item.id, 'model', ($event.target as HTMLInputElement).value)"
                />
              </div>
              <div class="chip-grid" v-if="getProviderModelOptions(item.provider).length">
                <button
                  v-for="model in getProviderModelOptions(item.provider)"
                  :key="model.value"
                  class="chip-button"
                  :class="{ active: model.value === item.model }"
                  type="button"
                  @click="emit('updateCustomModelField', item.id, 'model', model.value)"
                >
                  {{ model.shortLabel }}
                </button>
              </div>
            </div>

            <div class="add-provider-grid">
              <button
                v-for="provider in addableProviders"
                :key="provider.id"
                class="add-button"
                type="button"
                @click="emit('addCustomModel', provider.id as AddableProviderId)"
              >
                + 添加 {{ provider.label }}
              </button>
            </div>
          </section>
        </div>
      </section>
    </div>
  </transition>
</template>

<style scoped>
.settings-fade-enter-active,
.settings-fade-leave-active {
  transition: opacity 200ms ease;
}

.settings-fade-enter-active .settings-panel,
.settings-fade-leave-active .settings-panel {
  transition: opacity 200ms ease, transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.settings-fade-enter-from,
.settings-fade-leave-to {
  opacity: 0;
}

.settings-fade-enter-from .settings-panel,
.settings-fade-leave-to .settings-panel {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}

.settings-overlay {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.4);
  z-index: 100;
}

.settings-panel {
  width: min(640px, 100%);
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  will-change: transform, opacity;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  z-index: 10;
}

.settings-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text);
  letter-spacing: -0.02em;
}

.header-actions {
  display: flex;
  gap: 8px;
}

button {
  cursor: pointer;
  border: none;
  background: none;
  font-family: inherit;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  user-select: none;
}

.ghost-action {
  padding: 6px 14px;
  border-radius: 8px;
  color: var(--text-muted);
  font-weight: 500;
}
.ghost-action:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.primary-action {
  padding: 6px 18px;
  border-radius: 8px;
  background: var(--text);
  color: var(--bg);
  font-weight: 600;
}
.primary-action:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.primary-action:active:not(:disabled) {
  transform: translateY(0);
}
.primary-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.settings-body {
  padding: 16px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Custom Scrollbar for inner body */
.settings-body::-webkit-scrollbar {
  width: 6px;
}
.settings-body::-webkit-scrollbar-track {
  background: transparent;
}
.settings-body::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 4px;
}
.settings-body::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.setting-group h3 {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  opacity: 0.8;
}

.preference-row {
  display: flex;
}

.theme-toggle {
  display: inline-flex;
  background: var(--bg-soft);
  padding: 4px;
  border-radius: 12px;
  border: 1px solid var(--border);
}

.theme-toggle button {
  padding: 4px 16px;
  border-radius: 8px;
  color: var(--text-muted);
  font-weight: 500;
}

.theme-toggle button.active {
  background: var(--bg);
  color: var(--text);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.provider-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 12px;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  transition: all 0.2s ease;
}

.provider-card:hover {
  border-color: var(--text-muted);
}

.provider-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.provider-head h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
}

.transparent-input {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
  background: transparent;
  border: none;
  outline: none;
  padding: 0;
  flex: 1;
  min-width: 0;
}
.transparent-input::placeholder {
  color: var(--text-muted);
  opacity: 0.6;
}

.danger-text {
  color: var(--danger, #ef4444);
  font-size: 0.8rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
  flex-shrink: 0;
  white-space: nowrap;
}
.danger-text:hover {
  background: rgba(239, 68, 68, 0.1);
}

.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

input:not(.transparent-input),
select {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
  font-family: var(--font-mono, inherit);
}

input:not(.transparent-input):focus,
select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(var(--accent-rgb, 0,0,0), 0.1);
}

.storage-select {
  font-family: inherit;
}

.chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip-button {
  padding: 4px 12px;
  border-radius: 16px;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 500;
}

.chip-button:hover {
  border-color: var(--text-muted);
  color: var(--text);
}

.chip-button.active {
  background: var(--text);
  color: var(--bg);
  border-color: var(--text);
}

.add-provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.add-button {
  padding: 10px;
  border-radius: 10px;
  border: 1px dashed var(--border);
  background: transparent;
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.85rem;
}

.add-button:hover {
  border-color: var(--text);
  color: var(--text);
  background: var(--bg-soft);
}

@media (max-width: 640px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
  .settings-panel {
    border-radius: 16px 16px 0 0;
    max-height: 90vh;
    align-self: end;
  }
  .settings-overlay {
    align-items: end;
    padding: 0;
  }
}
</style>
