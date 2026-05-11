<script setup lang="ts">
import { computed } from 'vue'
import ModelPicker from './ModelPicker.vue'
import { UTOOLS_UPLOAD_MODE_OPTIONS } from '../constants/storage'
import type {
  FontSizeMode,
  ModelConfigOption,
  SettingsForm,
  ThemeMode,
  UtoolsUploadMode,
} from '../types/chat'

const props = defineProps<{
  isBrowserMode: boolean
  saving: boolean
  settings: SettingsForm
}>()

const emit = defineEmits<{
  updateFontSize: [fontSize: FontSizeMode]
  updateTheme: [theme: ThemeMode]
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

const uploadModePickerOptions = computed<ModelConfigOption[]>(() => {
  const shortLabels: Record<UtoolsUploadMode, string> = {
    'all-data': 'API + 对话',
    'local-only': '仅本地',
    'settings-only': '仅 API',
  }

  return UTOOLS_UPLOAD_MODE_OPTIONS.map((option) => ({
    badge: '存储',
    detail: option.label,
    label: option.label,
    shortLabel: shortLabels[option.value],
    value: option.value,
  }))
})
</script>

<template>
  <section class="settings-page" aria-labelledby="settings-general-title">
    <header class="page-heading">
      <p class="eyebrow">General</p>
      <h3 id="settings-general-title">通用</h3>
    </header>

    <div class="settings-grid two-columns">
      <article class="setting-card">
        <div class="setting-card-head">
          <div>
            <h4>外观</h4>
          </div>
        </div>
        <div class="stacked-controls">
          <div class="control-row">
            <span class="control-label">主题</span>
            <div class="segmented-control" role="group" aria-label="主题">
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
          <div class="control-row">
            <span class="control-label">字体大小</span>
            <div class="pill-control" role="group" aria-label="字体大小">
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
        </div>
      </article>

      <article class="setting-card">
        <div class="setting-card-head">
          <div>
            <h4>存储</h4>
            <p>控制哪些数据会进入 uTools 数据库。</p>
          </div>
        </div>
        <ModelPicker
          class="storage-picker"
          :disabled="props.saving"
          :model-value="props.settings.utoolsUploadMode"
          :options="uploadModePickerOptions"
          panel-direction="down"
          @select="emit('updateUtoolsUploadMode', $event as UtoolsUploadMode)"
        />
        <p v-if="props.isBrowserMode" class="hint-row">浏览器预览模式仅使用本地存储。</p>
      </article>
    </div>
  </section>
</template>
