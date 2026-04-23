<script setup lang="ts">
import { computed } from 'vue'
import EditableModelPicker from './EditableModelPicker.vue'
import ModelPicker from './ModelPicker.vue'
import { UTOOLS_UPLOAD_MODE_OPTIONS } from '../constants/storage'
import {
  getAddableProviderDefinitions,
  getProviderDefinition,
} from '../constants/providers'
import type {
  AddableProviderId,
  ModelConfigOption,
  ProviderSettings,
  SettingsForm,
  ThemeMode,
  UtoolsUploadMode,
} from '../types/chat'

type ProviderEditableField = Exclude<keyof ProviderSettings, 'modelOptions'>
type CustomModelField = ProviderEditableField | 'name'

const props = defineProps<{
  isBrowserMode: boolean
  open: boolean
  saving: boolean
  settings: SettingsForm
}>()

const emit = defineEmits<{
  addCustomModel: [provider: AddableProviderId]
  addCustomModelOption: [id: string, option: string]
  close: []
  removeCustomModel: [id: string]
  removeCustomModelOption: [id: string, option: string]
  renameCustomModelOption: [id: string, from: string, to: string]
  save: []
  updateCustomModelField: [id: string, field: CustomModelField, value: string | number]
  updateDeepseekField: [field: ProviderEditableField, value: string | number]
  updateTheme: [theme: ThemeMode]
  updateUtoolsUploadMode: [mode: UtoolsUploadMode]
}>()

const themeCards: Array<{ label: string; value: ThemeMode }> = [
  { label: '浅色', value: 'light' },
  { label: '夜色', value: 'dark' },
]

const addableProviders = getAddableProviderDefinitions()
const uploadModeOptions = UTOOLS_UPLOAD_MODE_OPTIONS
const uploadModePickerOptions = computed<ModelConfigOption[]>(() => {
  const shortLabels: Record<UtoolsUploadMode, string> = {
    'all-data': 'API + 对话',
    'local-only': '仅本地',
    'settings-only': '仅 API',
  }

  return uploadModeOptions.map((option) => ({
    badge: '存储',
    detail: option.label,
    label: option.label,
    shortLabel: shortLabels[option.value],
    value: option.value,
  }))
})
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
          </section>

          <section class="setting-group">
            <h3>存储</h3>
            <ModelPicker
              class="storage-picker"
              :disabled="props.saving"
              :model-value="props.settings.utoolsUploadMode"
              :options="uploadModePickerOptions"
              panel-direction="down"
              @select="emit('updateUtoolsUploadMode', $event as UtoolsUploadMode)"
            />
            <div v-if="props.isBrowserMode" class="hint-row">浏览器预览模式仅使用本地存储</div>
          </section>

          <section class="setting-group">
            <h3>服务提供商</h3>

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
                <EditableModelPicker
                  :allow-manage="false"
                  :disabled="props.saving"
                  :model-value="props.settings.deepseek.model"
                  :options="props.settings.deepseek.modelOptions"
                  placeholder="输入模型 ID"
                  @select="emit('updateDeepseekField', 'model', $event)"
                />
              </div>
            </div>

            <div
              v-for="item in props.settings.customModels"
              :key="item.id"
              class="provider-card"
            >
              <div class="provider-head">
                <input
                  class="provider-name-input"
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
                <EditableModelPicker
                  :allow-manage="true"
                  :disabled="props.saving"
                  :model-value="item.model"
                  :options="item.modelOptions"
                  placeholder="输入模型 ID"
                  @add-option="emit('addCustomModelOption', item.id, $event)"
                  @remove-option="emit('removeCustomModelOption', item.id, $event)"
                  @rename-option="emit('renameCustomModelOption', item.id, $event.from, $event.to)"
                  @select="emit('updateCustomModelField', item.id, 'model', $event)"
                />
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
  width: min(700px, 100%);
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.settings-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text);
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
}

.hint-row {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.provider-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 12px;
  background: var(--bg-soft);
  border: 1px solid var(--border);
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

.provider-name-input {
  width: 100%;
  max-width: 240px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  padding: 6px 10px;
  font-size: 0.85rem;
  outline: none;
  box-sizing: border-box;
  font-family: var(--font-mono, inherit);
}

.danger-text {
  color: var(--danger);
  font-size: 0.8rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
}

.danger-text:hover {
  background: rgba(239, 68, 68, 0.1);
}

.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1.4fr;
  gap: 12px;
  align-items: start;
}

input:not(.provider-name-input),
.storage-select {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 0.85rem;
  outline: none;
  box-sizing: border-box;
  font-family: var(--font-mono, inherit);
}

.storage-select {
  font-family: inherit;
}

.storage-picker {
  width: 100%;
  max-width: none;
  min-width: 0;
  flex: none;
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

@media (max-width: 700px) {
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
