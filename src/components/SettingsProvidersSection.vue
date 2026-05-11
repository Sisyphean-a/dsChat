<script setup lang="ts">
import EditableModelPicker from './EditableModelPicker.vue'
import {
  getAddableProviderDefinitions,
  getProviderDefinition,
} from '../constants/providers'
import type { AddableProviderId, SettingsForm } from '../types/chat'
import type { CustomModelField, ProviderEditableField } from '../types/settingsPanel'

const props = defineProps<{
  saving: boolean
  settings: SettingsForm
}>()

const emit = defineEmits<{
  addCustomModel: [provider: AddableProviderId]
  addCustomModelOption: [id: string, option: string]
  removeCustomModel: [id: string]
  removeCustomModelOption: [id: string, option: string]
  renameCustomModelOption: [id: string, from: string, to: string]
  updateCustomModelField: [id: string, field: CustomModelField, value: string | number]
  updateDeepseekField: [field: ProviderEditableField, value: string | number]
}>()

const addableProviders = getAddableProviderDefinitions()

function removeProviderWithConfirm(id: string, name: string): void {
  if (!window.confirm(`确认删除服务商「${name || '未命名'}」吗？`)) {
    return
  }

  emit('removeCustomModel', id)
}
</script>

<template>
  <section class="settings-page" aria-labelledby="settings-providers-title">
    <header class="page-heading">
      <p class="eyebrow">Model Providers</p>
      <h3 id="settings-providers-title">模型服务商</h3>
    </header>

    <div class="settings-grid">
      <article class="provider-card primary-provider">
        <div class="provider-head">
          <div>
            <h4>DeepSeek</h4>
          </div>
        </div>
        <div class="field-grid">
          <label class="field-shell">
            <span>Base URL</span>
            <input
              :value="props.settings.deepseek.baseUrl"
              :placeholder="getProviderDefinition('deepseek').baseUrlPlaceholder || 'Base URL'"
              type="text"
              @input="emit('updateDeepseekField', 'baseUrl', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="field-shell">
            <span>API Key</span>
            <input
              :value="props.settings.deepseek.apiKey"
              :placeholder="getProviderDefinition('deepseek').apiKeyPlaceholder || 'API Key'"
              type="password"
              @input="emit('updateDeepseekField', 'apiKey', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="field-shell">
            <span>默认模型</span>
            <EditableModelPicker
              :allow-manage="false"
              :disabled="props.saving"
              :model-value="props.settings.deepseek.model"
              :options="props.settings.deepseek.modelOptions"
              placeholder="输入模型 ID"
              @select="emit('updateDeepseekField', 'model', $event)"
            />
          </label>
        </div>
      </article>

      <article
        v-for="item in props.settings.customModels"
        :key="item.id"
        class="provider-card"
      >
        <div class="provider-head">
          <label class="provider-title-field">
            <span>{{ getProviderDefinition(item.provider).label }}</span>
            <input
              class="provider-name-input"
              :value="item.name"
              placeholder="未命名模型"
              type="text"
              @input="emit('updateCustomModelField', item.id, 'name', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <button class="danger-text" type="button" @click="removeProviderWithConfirm(item.id, item.name)">删除</button>
        </div>
        <div class="field-grid">
          <label class="field-shell">
            <span>Base URL</span>
            <input
              :value="item.baseUrl"
              :placeholder="getProviderDefinition(item.provider).baseUrlPlaceholder || 'Base URL'"
              type="text"
              @input="emit('updateCustomModelField', item.id, 'baseUrl', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="field-shell">
            <span>API Key</span>
            <input
              :value="item.apiKey"
              :placeholder="getProviderDefinition(item.provider).apiKeyPlaceholder || 'API Key'"
              type="password"
              @input="emit('updateCustomModelField', item.id, 'apiKey', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="field-shell">
            <span>默认模型</span>
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
          </label>
        </div>
      </article>

      <article class="setting-card add-provider-card">
        <div class="setting-card-head">
          <div>
            <h4>添加服务商</h4>
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
            + {{ provider.label }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
