<script setup lang="ts">
import ModelPicker from './ModelPicker.vue'
import { UTOOLS_SESSION_IDLE_TIMEOUT_OPTIONS } from '../constants/storage'
import type { ModelConfigOption, SettingsForm } from '../types/chat'
import type { SettingsEdit } from '../types/settingsPanel'

const props = defineProps<{
  saving: boolean
  settings: SettingsForm
}>()

const emit = defineEmits<{
  edit: [edit: SettingsEdit]
}>()

const sessionIdleTimeoutPickerOptions: ModelConfigOption[] = UTOOLS_SESSION_IDLE_TIMEOUT_OPTIONS.map((option) => ({
  badge: '会话',
  detail: '',
  label: option.label,
  shortLabel: option.label,
  value: String(option.value),
}))

function selectSessionIdleTimeout(value: string): void {
  const option = UTOOLS_SESSION_IDLE_TIMEOUT_OPTIONS.find((item) => item.value === Number(value))
  if (option) {
    emit('edit', { domain: 'conversation', field: 'utoolsSessionIdleTimeoutMinutes', value: option.value })
  }
}

function updateSystemPrompt(event: Event): void {
  emit('edit', { domain: 'conversation', field: 'systemPrompt', value: (event.target as HTMLTextAreaElement).value })
}
</script>

<template>
  <section class="settings-page" aria-labelledby="settings-conversation-title">
    <header class="page-heading">
      <h3 id="settings-conversation-title">对话</h3>
    </header>

    <div class="settings-grid">
      <article class="setting-card">
        <div class="setting-card-head">
          <h4>系统提示词</h4>
        </div>
        <textarea
          class="system-prompt-input"
          :disabled="props.saving"
          :value="props.settings.systemPrompt"
          aria-label="系统提示词"
          placeholder="例如：言简意赅，避免大段回复"
          rows="5"
          @input="updateSystemPrompt"
        ></textarea>
      </article>

      <article class="setting-card">
        <div class="setting-card-head">
          <div>
            <h4>会话</h4>
            <p>控制离开 uTools 多久后以新对话打开。</p>
          </div>
        </div>
        <ModelPicker
          class="session-idle-timeout-picker"
          :disabled="props.saving"
          :model-value="String(props.settings.utoolsSessionIdleTimeoutMinutes)"
          :options="sessionIdleTimeoutPickerOptions"
          panel-direction="down"
          @select="selectSessionIdleTimeout"
        />
      </article>
    </div>
  </section>
</template>
