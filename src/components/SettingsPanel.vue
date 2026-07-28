<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useModalFocus } from '../composables/useModalFocus'
import SettingsGeneralSection from './SettingsGeneralSection.vue'
import SettingsProvidersSection from './SettingsProvidersSection.vue'
import SettingsToolsSection from './SettingsToolsSection.vue'
import type {
  AddableProviderId,
  ProviderCapabilities,
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
  error?: string | null
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
  updateCustomModelCapability: [
    id: string,
    field: keyof ProviderCapabilities,
    value: ProviderCapabilities[keyof ProviderCapabilities],
  ]
  updateCustomToolField: [
    id: string,
    field: CustomToolEditableField,
    value: string | boolean | CustomToolSettings['headers'],
  ]
  updateDeepseekField: [field: ProviderEditableField, value: string | number]
  updateDeepseekCapability: [
    field: keyof ProviderCapabilities,
    value: ProviderCapabilities[keyof ProviderCapabilities],
  ]
  updateFontSize: [fontSize: FontSizeMode]
  updateTheme: [theme: ThemeMode]
  updateToolEnabled: [enabled: boolean]
  updateUtoolsSessionIdleTimeoutMinutes: [minutes: number]
  updateUtoolsUploadMode: [mode: UtoolsUploadMode]
}>()

const activeSection = ref<SettingsSectionId>('general')
const closeButtonRef = ref<HTMLButtonElement | null>(null)
const dialogRef = ref<HTMLElement | null>(null)
const enabledBuiltinToolCount = computed(() => {
  const { currentTime, tavilySearch } = props.settings.toolSettings.builtinTools
  return Number(currentTime.enabled) + Number(tavilySearch.enabled)
})
const navItems = computed(() => [
  {
    id: 'general' as const,
    label: '通用',
    badge: props.settings.theme === 'dark' ? '夜色' : '浅色',
  },
  {
    id: 'providers' as const,
    label: '模型服务商',
    badge: `${props.settings.customModels.length + 1} 个`,
  },
  {
    id: 'tools' as const,
    label: '工具',
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

const { handleModalKeydown } = useModalFocus({
  close: () => emit('close'),
  container: dialogRef,
  initialFocus: closeButtonRef,
  isOpen: () => props.open,
})
</script>

<template>
  <transition name="settings-fade">
    <div
      v-if="props.open"
      ref="dialogRef"
      class="settings-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      tabindex="-1"
      @keydown="handleModalKeydown"
    >
      <section class="settings-panel">
        <header class="settings-header">
          <div class="settings-title-block">
            <p class="settings-kicker">偏好设置</p>
            <h2 id="settings-title">设置</h2>
            <p class="settings-intro">外观、模型连接与工具配置</p>
          </div>
          <div class="settings-header-actions">
            <button ref="closeButtonRef" class="ghost-action" type="button" @click="emit('close')">关闭</button>
            <button class="primary-action" type="button" :disabled="props.saving" @click="emit('save')">
              {{ props.saving ? '保存中' : '保存' }}
            </button>
          </div>
        </header>

        <p v-if="props.error" class="settings-save-error" role="alert">{{ props.error }}</p>

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
              </button>
            </nav>
            <div class="settings-sidebar-note">
              <strong>先预览，再保存</strong>
              <span>主题和字号会立即预览，其他更改会在保存后写入本地。</span>
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
              @update-utools-session-idle-timeout-minutes="emit('updateUtoolsSessionIdleTimeoutMinutes', $event)"
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
              @update-custom-model-capability="(id, field, value) => emit('updateCustomModelCapability', id, field, value)"
              @update-custom-model-field="(id, field, value) => emit('updateCustomModelField', id, field, value)"
              @update-deepseek-capability="(field, value) => emit('updateDeepseekCapability', field, value)"
              @update-deepseek-field="(field, value) => emit('updateDeepseekField', field, value)"
            />
            <SettingsToolsSection
              v-else
              :settings="props.settings"
              @update-builtin-tool-enabled="(tool, enabled) => emit('updateBuiltinToolEnabled', tool, enabled)"
              @update-builtin-tool-tavily-api-key="emit('updateBuiltinToolTavilyApiKey', $event)"
              @update-builtin-tool-tavily-base-url="emit('updateBuiltinToolTavilyBaseUrl', $event)"
              @update-tool-enabled="emit('updateToolEnabled', $event)"
            />
          </main>
        </div>
      </section>
    </div>
  </transition>
</template>

<style src="../styles/settings-panel.css"></style>
