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
  CustomToolSettings,
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
  updateToolEnabled: [enabled: boolean]
  updateToolMaxRounds: [maxToolRounds: number]
  updateToolOpenAiNativeSearch: [enabled: boolean]
  updateBuiltinToolEnabled: [tool: 'currentTime' | 'tavilySearch', enabled: boolean]
  updateBuiltinToolTavilyApiKey: [apiKey: string]
  updateBuiltinToolTavilyBaseUrl: [baseUrl: string]
  addCustomTool: []
  removeCustomTool: [id: string]
  updateCustomToolField: [
    id: string,
    field: Exclude<keyof CustomToolSettings, 'id'>,
    value: string | boolean | CustomToolSettings['headers'],
  ]
  updateUtoolsUploadMode: [mode: UtoolsUploadMode]
}>()

const themeCards: Array<{ label: string; value: ThemeMode }> = [
  { label: '浅色', value: 'light' },
  { label: '夜色', value: 'dark' },
]
const fontSizeCards: Array<{ label: string; value: FontSizeMode }> = [
  { label: '标准', value: 'medium' },
  { label: '大号', value: 'large' },
  { label: '特大', value: 'x-large' },
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
    <div v-if="props.open" class="settings-overlay">
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
            <div class="inline-setting-row">
              <span class="inline-setting-label">字体大小</span>
              <div class="font-size-toggle" role="group" aria-label="字体大小">
                <button
                  v-for="fontSize in fontSizeCards"
                  :key="fontSize.value"
                  :class="{ active: props.settings.fontSize === fontSize.value }"
                  type="button"
                  @click="emit('updateFontSize', fontSize.value)"
                >
                  {{ fontSize.label }}
                </button>
              </div>
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
            <h3>工具调用</h3>
            <label class="tool-toggle-row">
              <input
                :checked="props.settings.toolSettings.enabled"
                type="checkbox"
                @change="emit('updateToolEnabled', ($event.target as HTMLInputElement).checked)"
              />
              <span>启用工具调用</span>
            </label>
            <label class="tool-toggle-row">
              <input
                :checked="props.settings.toolSettings.openaiUseNativeWebSearch"
                type="checkbox"
                @change="emit('updateToolOpenAiNativeSearch', ($event.target as HTMLInputElement).checked)"
              />
              <span>OpenAI 使用原生 web_search（避免与工具编排冲突）</span>
            </label>
            <label class="inline-setting-row">
              <span class="inline-setting-label">工具最大轮数</span>
              <input
                class="tool-rounds-input"
                :value="props.settings.toolSettings.maxToolRounds"
                min="1"
                max="10"
                step="1"
                type="number"
                @change="emit('updateToolMaxRounds', Number(($event.target as HTMLInputElement).value))"
              />
            </label>

            <div class="provider-card">
              <div class="provider-head">
                <h4>内置工具：当前时间</h4>
              </div>
              <label class="tool-toggle-row">
                <input
                  :checked="props.settings.toolSettings.builtinTools.currentTime.enabled"
                  type="checkbox"
                  @change="emit('updateBuiltinToolEnabled', 'currentTime', ($event.target as HTMLInputElement).checked)"
                />
                <span>启用 get_current_time</span>
              </label>
            </div>

            <div class="provider-card">
              <div class="provider-head">
                <h4>内置工具：Tavily 搜索</h4>
              </div>
              <label class="tool-toggle-row">
                <input
                  :checked="props.settings.toolSettings.builtinTools.tavilySearch.enabled"
                  type="checkbox"
                  @change="emit('updateBuiltinToolEnabled', 'tavilySearch', ($event.target as HTMLInputElement).checked)"
                />
                <span>启用 tavily_search</span>
              </label>
              <input
                :value="props.settings.toolSettings.builtinTools.tavilySearch.baseUrl"
                placeholder="Tavily 后端地址（默认 https://api.tavily.com/search）"
                type="text"
                @input="emit('updateBuiltinToolTavilyBaseUrl', ($event.target as HTMLInputElement).value)"
              />
              <input
                :value="props.settings.toolSettings.builtinTools.tavilySearch.apiKey"
                placeholder="tvly-...（仅 Tavily 搜索需要）"
                type="password"
                @input="emit('updateBuiltinToolTavilyApiKey', ($event.target as HTMLInputElement).value)"
              />
            </div>

            <div class="provider-card">
              <div class="provider-head">
                <h4>自定义工具（预配置）</h4>
                <button class="ghost-action" type="button" @click="emit('addCustomTool')">新增</button>
              </div>

              <div
                v-for="item in props.settings.toolSettings.customTools"
                :key="item.id"
                class="field-grid"
              >
                <div class="provider-head">
                  <input
                    class="provider-name-input"
                    :value="item.name"
                    placeholder="工具名称"
                    type="text"
                    @input="emit('updateCustomToolField', item.id, 'name', ($event.target as HTMLInputElement).value)"
                  />
                  <button class="danger-text" type="button" @click="emit('removeCustomTool', item.id)">删除</button>
                </div>
                <label class="tool-toggle-row">
                  <input
                    :checked="item.enabled"
                    type="checkbox"
                    @change="emit('updateCustomToolField', item.id, 'enabled', ($event.target as HTMLInputElement).checked)"
                  />
                  <span>启用</span>
                </label>
                <input
                  :value="item.description"
                  placeholder="描述（给模型看的工具能力说明）"
                  type="text"
                  @input="emit('updateCustomToolField', item.id, 'description', ($event.target as HTMLInputElement).value)"
                />
                <select
                  :value="item.method"
                  @change="emit('updateCustomToolField', item.id, 'method', ($event.target as HTMLSelectElement).value)"
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                </select>
                <input
                  :value="item.url"
                  placeholder="https://example.com/tool-endpoint"
                  type="text"
                  @input="emit('updateCustomToolField', item.id, 'url', ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
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
