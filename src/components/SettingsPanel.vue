<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useModalFocus } from '../composables/useModalFocus'
import SettingsConversationSection from './SettingsConversationSection.vue'
import SettingsGeneralSection from './SettingsGeneralSection.vue'
import SettingsProvidersSection from './SettingsProvidersSection.vue'
import SettingsToolsSection from './SettingsToolsSection.vue'
import type { SettingsForm } from '../types/chat'
import type { SettingsEdit, SettingsSectionId } from '../types/settingsPanel'

const props = defineProps<{
  error?: string | null
  isBrowserMode: boolean
  open: boolean
  saving: boolean
  settings: SettingsForm
}>()

const emit = defineEmits<{
  close: []
  edit: [edit: SettingsEdit]
  save: []
}>()

const activeSection = ref<SettingsSectionId>('general')
const closeButtonRef = ref<HTMLButtonElement | null>(null)
const dialogRef = ref<HTMLElement | null>(null)
const enabledBuiltinToolCount = computed(() => {
  const { currentTime, tavilySearch, qwenImage } = props.settings.toolSettings.builtinTools
  return Number(currentTime.enabled) + Number(tavilySearch.enabled) + Number(qwenImage.enabled)
})
const navItems = computed(() => [
  {
    id: 'general' as const,
    label: '通用',
    badge: props.settings.theme === 'dark' ? '夜色' : '浅色',
  },
  {
    id: 'conversation' as const,
    label: '对话',
    badge: '',
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
                  <span v-if="item.badge" class="nav-badge">{{ item.badge }}</span>
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
              @edit="emit('edit', $event)"
            />
            <SettingsConversationSection
              v-else-if="activeSection === 'conversation'"
              :saving="props.saving"
              :settings="props.settings"
              @edit="emit('edit', $event)"
            />
            <SettingsProvidersSection
              v-else-if="activeSection === 'providers'"
              :saving="props.saving"
              :settings="props.settings"
              @edit="emit('edit', $event)"
            />
            <SettingsToolsSection
              v-else
              :settings="props.settings"
              @edit="emit('edit', $event)"
            />
          </main>
        </div>
      </section>
    </div>
  </transition>
</template>

<style src="../styles/settings-panel.css"></style>
