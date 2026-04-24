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
  FontSizeMode,
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
  updateFontSize: [fontSize: FontSizeMode]
  updateCustomModelField: [id: string, field: CustomModelField, value: string | number]
  updateDeepseekField: [field: ProviderEditableField, value: string | number]
  updateTheme: [theme: ThemeMode]
  updateUtoolsUploadMode: [mode: UtoolsUploadMode]
}>()

const themeCards: Array<{ label: string; value: ThemeMode }> = [
  { label: '浅色', value: 'light' },
  { label: '夜色', value: 'dark' },
]
const fontSizeCards: Array<{ description: string; label: string; value: FontSizeMode }> = [
  { description: '默认信息密度', label: '标准', value: 'medium' },
  { description: '更易读，适合多数人', label: '大号', value: 'large' },
  { description: '尽量放大正文和代码', label: '特大', value: 'x-large' },
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
            <div class="font-size-grid">
              <button
                v-for="fontSize in fontSizeCards"
                :key="fontSize.value"
                class="font-size-card"
                :class="{ active: props.settings.fontSize === fontSize.value }"
                type="button"
                @click="emit('updateFontSize', fontSize.value)"
              >
                <span class="font-size-card-label">{{ fontSize.label }}</span>
                <span class="font-size-card-detail">{{ fontSize.description }}</span>
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
<style scoped src="../styles/settings-panel.css"></style>
