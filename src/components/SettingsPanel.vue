<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  getAddableProviderDefinitions,
  getProviderDefinition,
  getProviderModelOptions,
} from '../constants/providers'
import { getModelConfigOptions } from '../composables/chatAppSettings'
import type { AddableProviderId, ProviderSettings, SettingsForm, ThemeMode } from '../types/chat'

type SettingsPage = 'basic' | 'custom' | 'deepseek'
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
}>()

const pages: Array<{ key: SettingsPage; label: string }> = [
  { key: 'basic', label: '基础设置' },
  { key: 'deepseek', label: 'DeepSeek' },
  { key: 'custom', label: '新增模型' },
]
const page = ref<SettingsPage>('basic')
const selectedCustomModelId = ref<string | null>(null)
const themeCards: Array<{ label: string; value: ThemeMode }> = [
  { label: '浅色', value: 'light' },
  { label: '夜色', value: 'dark' },
]
const activeConfigOptions = computed(() => getModelConfigOptions(props.settings))
const addableProviders = getAddableProviderDefinitions()
const deepseekOptions = getProviderModelOptions('deepseek')
const selectedCustomModel = computed(() => {
  return props.settings.customModels.find((item) => item.id === selectedCustomModelId.value) ?? null
})
const selectedCustomMeta = computed(() => {
  return selectedCustomModel.value
    ? getProviderDefinition(selectedCustomModel.value.provider)
    : null
})
const selectedCustomOptions = computed(() => {
  return selectedCustomModel.value
    ? getProviderModelOptions(selectedCustomModel.value.provider)
    : []
})

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return
    }

    page.value = 'basic'
  },
)

watch(
  () => props.settings.customModels,
  (next, previous) => {
    if (!next.length) {
      selectedCustomModelId.value = null
      return
    }

    if (previous && next.length > previous.length) {
      selectedCustomModelId.value = next.at(-1)?.id ?? next[0].id
      return
    }

    if (!selectedCustomModelId.value || !next.some((item) => item.id === selectedCustomModelId.value)) {
      selectedCustomModelId.value = next[0].id
    }
  },
  { deep: true, immediate: true },
)
</script>

<template>
  <transition name="settings-fade">
    <div v-if="props.open" class="settings-overlay" @click.self="emit('close')">
      <section class="settings-panel">
        <header class="settings-header">
          <div class="header-copy">
            <h2>设置</h2>
            <span>DeepSeek 为内置配置，其他模型通过预设新增</span>
          </div>
          <div class="header-actions">
            <button class="ghost-action" type="button" @click="emit('close')">关闭</button>
            <button class="primary-action" type="button" :disabled="props.saving" @click="emit('save')">
              {{ props.saving ? '保存中...' : '保存' }}
            </button>
          </div>
        </header>

        <p v-if="props.isBrowserMode" class="notice">浏览器预览模式下不持久化设置。</p>

        <nav class="tab-strip" aria-label="设置分页">
          <button
            v-for="item in pages"
            :key="item.key"
            class="tab-button"
            :class="{ active: item.key === page }"
            type="button"
            @click="page = item.key"
          >
            {{ item.label }}
          </button>
        </nav>

        <div v-if="page === 'basic'" class="page-stack">
          <section class="section-card">
            <div class="section-head">
              <span>默认对话模型</span>
            </div>
            <div class="config-list">
              <button
                v-for="option in activeConfigOptions"
                :key="option.value"
                class="config-button"
                :class="{ active: option.value === props.settings.activeConfigId }"
                type="button"
                @click="emit('selectActiveConfig', option.value)"
              >
                <div class="config-meta">
                  <strong>{{ option.label }}</strong>
                  <span>{{ option.detail }}</span>
                </div>
                <em>{{ option.badge }}</em>
              </button>
            </div>
          </section>

          <section class="section-card">
            <div class="section-head">
              <span>外观</span>
            </div>
            <div class="theme-grid">
              <button
                v-for="theme in themeCards"
                :key="theme.value"
                class="theme-button"
                :class="{ active: props.settings.theme === theme.value }"
                type="button"
                @click="emit('updateTheme', theme.value)"
              >
                {{ theme.label }}
              </button>
            </div>
          </section>
        </div>

        <div v-else-if="page === 'deepseek'" class="page-stack">
          <section class="section-card">
            <div class="section-head">
              <span>接入信息</span>
              <a class="link-action" :href="getProviderDefinition('deepseek').docsUrl" rel="noreferrer" target="_blank">
                官网
              </a>
            </div>
            <div class="field-grid">
              <label class="field field-span-2">
                <span>Base URL</span>
                <input
                  :value="props.settings.deepseek.baseUrl"
                  :placeholder="getProviderDefinition('deepseek').baseUrlPlaceholder"
                  type="text"
                  @input="emit('updateDeepseekField', 'baseUrl', ($event.target as HTMLInputElement).value)"
                />
              </label>

              <label class="field field-span-2">
                <span>API Key</span>
                <input
                  :value="props.settings.deepseek.apiKey"
                  :placeholder="getProviderDefinition('deepseek').apiKeyPlaceholder"
                  type="password"
                  @input="emit('updateDeepseekField', 'apiKey', ($event.target as HTMLInputElement).value)"
                />
              </label>
            </div>
          </section>

          <section class="section-card">
            <div class="section-head">
              <span>模型</span>
            </div>

            <label class="field">
              <span>模型 ID</span>
              <input
                :value="props.settings.deepseek.model"
                type="text"
                @input="emit('updateDeepseekField', 'model', ($event.target as HTMLInputElement).value)"
              />
            </label>

            <div class="chip-grid">
              <button
                v-for="model in deepseekOptions"
                :key="model.value"
                class="chip-button"
                :class="{ active: model.value === props.settings.deepseek.model }"
                type="button"
                @click="emit('updateDeepseekField', 'model', model.value)"
              >
                <strong>{{ model.shortLabel }}</strong>
                <span>{{ model.value }}</span>
              </button>
            </div>
          </section>
        </div>

        <div v-else class="page-stack">
          <section class="section-card">
            <div class="section-head">
              <span>新增模型</span>
            </div>
            <div class="preset-grid">
              <button
                v-for="provider in addableProviders"
                :key="provider.id"
                class="preset-button"
                type="button"
                @click="emit('addCustomModel', provider.id as AddableProviderId)"
              >
                <strong>{{ provider.label }}</strong>
                <span>{{ provider.baseUrlDefault || '手动填写 Base URL' }}</span>
              </button>
            </div>
          </section>

          <section v-if="props.settings.customModels.length" class="editor-shell">
            <aside class="model-list">
              <button
                v-for="item in props.settings.customModels"
                :key="item.id"
                class="model-row"
                :class="{ active: item.id === selectedCustomModelId }"
                type="button"
                @click="selectedCustomModelId = item.id"
              >
                <strong>{{ item.name }}</strong>
                <span>{{ item.model || '未设置模型' }}</span>
              </button>
            </aside>

            <div v-if="selectedCustomModel && selectedCustomMeta" class="page-stack">
              <section class="section-card">
                <div class="section-head">
                  <span>模型信息</span>
                  <div class="inline-actions">
                    <a
                      v-if="selectedCustomMeta.docsUrl"
                      class="link-action"
                      :href="selectedCustomMeta.docsUrl"
                      rel="noreferrer"
                      target="_blank"
                    >
                      官网
                    </a>
                    <button class="danger-action" type="button" @click="emit('removeCustomModel', selectedCustomModel.id)">
                      删除
                    </button>
                  </div>
                </div>

                <div class="field-grid">
                  <label class="field">
                    <span>名称</span>
                    <input
                      :value="selectedCustomModel.name"
                      type="text"
                      @input="emit('updateCustomModelField', selectedCustomModel.id, 'name', ($event.target as HTMLInputElement).value)"
                    />
                  </label>

                  <label class="field">
                    <span>预设</span>
                    <input :value="selectedCustomMeta.label" disabled type="text" />
                  </label>

                  <label class="field field-span-2">
                    <span>Base URL</span>
                    <input
                      :value="selectedCustomModel.baseUrl"
                      :placeholder="selectedCustomMeta.baseUrlPlaceholder"
                      type="text"
                      @input="emit('updateCustomModelField', selectedCustomModel.id, 'baseUrl', ($event.target as HTMLInputElement).value)"
                    />
                  </label>

                  <label class="field field-span-2">
                    <span>API Key</span>
                    <input
                      :value="selectedCustomModel.apiKey"
                      :placeholder="selectedCustomMeta.apiKeyPlaceholder"
                      type="password"
                      @input="emit('updateCustomModelField', selectedCustomModel.id, 'apiKey', ($event.target as HTMLInputElement).value)"
                    />
                  </label>
                </div>
              </section>

              <section class="section-card">
                <div class="section-head">
                  <span>模型</span>
                </div>

                <label class="field">
                  <span>模型 ID</span>
                  <input
                    :value="selectedCustomModel.model"
                    type="text"
                    @input="emit('updateCustomModelField', selectedCustomModel.id, 'model', ($event.target as HTMLInputElement).value)"
                  />
                </label>

                <div v-if="selectedCustomOptions.length" class="chip-grid">
                  <button
                    v-for="model in selectedCustomOptions"
                    :key="model.value"
                    class="chip-button"
                    :class="{ active: model.value === selectedCustomModel.model }"
                    type="button"
                    @click="emit('updateCustomModelField', selectedCustomModel.id, 'model', model.value)"
                  >
                    <strong>{{ model.shortLabel }}</strong>
                    <span>{{ model.value }}</span>
                  </button>
                </div>
              </section>
            </div>
          </section>

          <section v-else class="empty-card">
            <strong>还没有新增模型</strong>
            <span>先从上面的预设创建一个配置项，再填写 Base URL、API Key 和模型。</span>
          </section>
        </div>
      </section>
    </div>
  </transition>
</template>

<style scoped>
.settings-fade-enter-active,
.settings-fade-leave-active {
  transition: opacity 140ms ease;
}

.settings-fade-enter-active .settings-panel,
.settings-fade-leave-active .settings-panel {
  transition: opacity 140ms ease, transform 140ms ease;
}

.settings-fade-enter-from,
.settings-fade-leave-to {
  opacity: 0;
}

.settings-fade-enter-from .settings-panel,
.settings-fade-leave-to .settings-panel {
  opacity: 0;
  transform: translateY(6px);
}

.settings-overlay {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: start center;
  overflow-y: auto;
  padding: 20px;
  background: rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(6px);
}

.settings-panel {
  width: min(760px, 100%);
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
  overflow-y: auto;
}

.settings-header,
.header-actions,
.section-head,
.inline-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.settings-header {
  position: sticky;
  top: 0;
  z-index: 2;
  padding-bottom: 2px;
  background: var(--bg);
}

.header-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-copy h2 {
  margin: 0;
  font-size: 1.05rem;
  color: var(--text);
}

.header-copy span,
.notice,
.field span,
.config-meta span,
.model-row span,
.preset-button span,
.chip-button span,
.empty-card span {
  font-size: 0.79rem;
  color: var(--text-muted);
}

.notice {
  margin: 0;
}

.tab-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.tab-button,
.theme-button,
.config-button,
.chip-button,
.preset-button,
.model-row,
.ghost-action,
.primary-action,
.danger-action,
.field input {
  border: 1px solid var(--border);
  border-radius: 10px;
}

.tab-button,
.theme-button,
.config-button,
.chip-button,
.preset-button,
.model-row,
.ghost-action,
.primary-action,
.danger-action {
  transition: border-color 140ms ease, background 140ms ease;
}

.tab-button,
.theme-button,
.ghost-action,
.primary-action,
.danger-action {
  min-height: 38px;
  padding: 0 14px;
  background: var(--bg);
  font-size: 0.85rem;
}

.tab-button {
  color: var(--text-muted);
}

.tab-button.active,
.tab-button:hover,
.theme-button.active,
.theme-button:hover,
.config-button.active,
.config-button:hover,
.chip-button.active,
.chip-button:hover,
.preset-button:hover,
.model-row.active,
.model-row:hover,
.ghost-action:hover,
.primary-action:hover:not(:disabled),
.danger-action:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
}

.primary-action {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.primary-action:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.ghost-action {
  color: var(--text-muted);
}

.danger-action {
  color: var(--danger);
  background: var(--bg);
}

.link-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-muted);
  background: var(--bg);
}

.page-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-card,
.empty-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-soft);
}

.section-head span,
.empty-card strong {
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 600;
}

.config-list,
.chip-grid,
.preset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.config-button,
.chip-button,
.preset-button,
.model-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 12px;
  background: var(--bg);
  text-align: left;
}

.config-meta,
.chip-button,
.preset-button,
.model-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.config-meta {
  min-width: 0;
  gap: 4px;
}

.config-meta strong,
.chip-button strong,
.preset-button strong,
.model-row strong {
  color: var(--text);
}

.config-meta span,
.chip-button span,
.preset-button span,
.model-row span {
  font-family: var(--font-mono);
  line-height: 1.3;
  word-break: break-all;
}

.config-button em {
  flex-shrink: 0;
  font-style: normal;
  font-size: 0.75rem;
  color: var(--accent-strong);
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.theme-button {
  color: var(--text);
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-span-2 {
  grid-column: span 2;
}

.field input {
  min-height: 40px;
  padding: 0 12px;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-mono);
}

.field input:focus {
  border-color: var(--accent);
}

.field input:disabled {
  background: var(--bg-soft);
  color: var(--text-muted);
  cursor: not-allowed;
}

.editor-shell {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 12px;
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

@media (max-width: 700px) {
  .settings-overlay {
    padding: 10px;
  }

  .settings-panel {
    width: 100%;
    max-height: calc(100vh - 20px);
    padding: 14px;
  }

  .config-list,
  .chip-grid,
  .preset-grid,
  .theme-grid,
  .field-grid,
  .editor-shell {
    grid-template-columns: 1fr;
  }

  .field-span-2 {
    grid-column: auto;
  }
}

@media (max-width: 560px) {
  .settings-header,
  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .tab-strip {
    grid-template-columns: 1fr;
  }
}
</style>
