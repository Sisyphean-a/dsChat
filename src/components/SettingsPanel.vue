<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SettingsGeneralSection from './SettingsGeneralSection.vue'
import SettingsProvidersSection from './SettingsProvidersSection.vue'
import SettingsToolsSection from './SettingsToolsSection.vue'
import type {
  AddableProviderId,
  CustomToolSettings,
  FontSizeMode,
  SettingsForm,
  ThemeMode,
  UtoolsUploadMode,
} from '../types/chat'
import type {
  CustomModelField,
  CustomToolEditableField,
  ProviderEditableField,
  SettingsSectionId,
} from '../types/settingsPanel'

const props = defineProps<{
  isBrowserMode: boolean
  open: boolean
  saving: boolean
  settings: SettingsForm
}>()

const emit = defineEmits<{
  addCustomModel: [provider: AddableProviderId]
  addCustomModelOption: [id: string, option: string]
  addCustomTool: []
  close: []
  removeCustomModel: [id: string]
  removeCustomModelOption: [id: string, option: string]
  removeCustomTool: [id: string]
  renameCustomModelOption: [id: string, from: string, to: string]
  save: []
  updateBuiltinToolEnabled: [tool: 'currentTime' | 'tavilySearch', enabled: boolean]
  updateBuiltinToolTavilyApiKey: [apiKey: string]
  updateBuiltinToolTavilyBaseUrl: [baseUrl: string]
  updateCustomModelField: [id: string, field: CustomModelField, value: string | number]
  updateCustomToolField: [
    id: string,
    field: CustomToolEditableField,
    value: string | boolean | CustomToolSettings['headers'],
  ]
  updateDeepseekField: [field: ProviderEditableField, value: string | number]
  updateFontSize: [fontSize: FontSizeMode]
  updateTheme: [theme: ThemeMode]
  updateToolEnabled: [enabled: boolean]
  updateToolMaxRounds: [maxToolRounds: number]
  updateToolOpenAiNativeSearch: [enabled: boolean]
  updateUtoolsUploadMode: [mode: UtoolsUploadMode]
}>()

const activeSection = ref<SettingsSectionId>('general')
const enabledBuiltinToolCount = computed(() => {
  const { currentTime, tavilySearch } = props.settings.toolSettings.builtinTools
  return Number(currentTime.enabled) + Number(tavilySearch.enabled)
})
const navItems = computed(() => [
  {
    id: 'general' as const,
    label: '通用',
    description: '外观与存储',
    badge: props.settings.theme === 'dark' ? '夜色' : '浅色',
  },
  {
    id: 'providers' as const,
    label: '模型服务商',
    description: '密钥、地址、模型',
    badge: `${props.settings.customModels.length + 1} 个`,
  },
  {
    id: 'tools' as const,
    label: '工具',
    description: '调用、内置、自定义',
    badge: props.settings.toolSettings.enabled ? `${enabledBuiltinToolCount.value} 启用` : '关闭',
  },
])

watch(() => props.open, (open) => {
  if (open) {
    activeSection.value = 'general'
  }
})

function selectSection(id: SettingsSectionId): void {
  activeSection.value = id
}
</script>

<template>
  <transition name="settings-fade">
    <div
      v-if="props.open"
      class="settings-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <section class="settings-panel">
        <header class="settings-header">
          <div class="settings-title-block">
            <h2 id="settings-title">设置</h2>
          </div>
          <div class="settings-header-actions">
            <button class="ghost-action" type="button" @click="emit('close')">取消</button>
            <button class="primary-action" type="button" :disabled="props.saving" @click="emit('save')">
              {{ props.saving ? '保存中' : '保存' }}
            </button>
          </div>
        </header>

        <div class="settings-workspace">
          <aside class="settings-sidebar" aria-label="设置分类">
            <nav class="settings-nav">
              <button
                v-for="item in navItems"
                :key="item.id"
                class="settings-nav-item"
                :class="{ active: activeSection === item.id }"
                :aria-current="activeSection === item.id ? 'page' : undefined"
                type="button"
                @click="selectSection(item.id)"
              >
                <span class="nav-main">
                  <span class="nav-label">{{ item.label }}</span>
                  <span class="nav-badge">{{ item.badge }}</span>
                </span>
                <span class="nav-description">{{ item.description }}</span>
              </button>
            </nav>
            <div class="settings-sidebar-note">
              <strong>不打断对话</strong>
              <span>设置页覆盖当前视口，关闭后回到原来的聊天上下文。</span>
            </div>
          </aside>

          <main class="settings-content">
            <SettingsGeneralSection
              v-if="activeSection === 'general'"
              :is-browser-mode="props.isBrowserMode"
              :saving="props.saving"
              :settings="props.settings"
              @update-font-size="emit('updateFontSize', $event)"
              @update-theme="emit('updateTheme', $event)"
              @update-utools-upload-mode="emit('updateUtoolsUploadMode', $event)"
            />
            <SettingsProvidersSection
              v-else-if="activeSection === 'providers'"
              :saving="props.saving"
              :settings="props.settings"
              @add-custom-model="emit('addCustomModel', $event)"
              @add-custom-model-option="(id, option) => emit('addCustomModelOption', id, option)"
              @remove-custom-model="emit('removeCustomModel', $event)"
              @remove-custom-model-option="(id, option) => emit('removeCustomModelOption', id, option)"
              @rename-custom-model-option="(id, from, to) => emit('renameCustomModelOption', id, from, to)"
              @update-custom-model-field="(id, field, value) => emit('updateCustomModelField', id, field, value)"
              @update-deepseek-field="(field, value) => emit('updateDeepseekField', field, value)"
            />
            <SettingsToolsSection
              v-else
              :settings="props.settings"
              @add-custom-tool="emit('addCustomTool')"
              @remove-custom-tool="emit('removeCustomTool', $event)"
              @update-builtin-tool-enabled="(tool, enabled) => emit('updateBuiltinToolEnabled', tool, enabled)"
              @update-builtin-tool-tavily-api-key="emit('updateBuiltinToolTavilyApiKey', $event)"
              @update-builtin-tool-tavily-base-url="emit('updateBuiltinToolTavilyBaseUrl', $event)"
              @update-custom-tool-field="(id, field, value) => emit('updateCustomToolField', id, field, value)"
              @update-tool-enabled="emit('updateToolEnabled', $event)"
              @update-tool-max-rounds="emit('updateToolMaxRounds', $event)"
              @update-tool-open-ai-native-search="emit('updateToolOpenAiNativeSearch', $event)"
            />
          </main>
        </div>
      </section>
    </div>
  </transition>
</template>

<style src="../styles/settings-panel.css"></style>
