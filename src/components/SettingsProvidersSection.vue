<script setup lang="ts">
import EditableModelPicker from './EditableModelPicker.vue'
import ProviderCapabilitiesEditor from './ProviderCapabilitiesEditor.vue'
import { ref } from 'vue'
import {
  getAddableProviderDefinitions,
  getProviderDefinition,
} from '../constants/providers'
import type { AddableProviderId, ProviderCapabilities, SettingsForm } from '../types/chat'
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
  updateCustomModelCapability: [
    id: string,
    field: keyof ProviderCapabilities,
    value: ProviderCapabilities[keyof ProviderCapabilities],
  ]
  updateCustomModelField: [id: string, field: CustomModelField, value: string | number]
  updateDeepseekCapability: [
    field: keyof ProviderCapabilities,
    value: ProviderCapabilities[keyof ProviderCapabilities],
  ]
  updateDeepseekField: [field: ProviderEditableField, value: string | number]
}>()

const addableProviders = getAddableProviderDefinitions()
const pendingDeleteProvider = ref<{ id: string; name: string } | null>(null)
const expandedCapabilityCards = ref<Set<string>>(new Set())

function requestRemoveProvider(id: string, name: string): void {
  pendingDeleteProvider.value = { id, name: name || '未命名' }
}

function cancelRemoveProvider(): void {
  pendingDeleteProvider.value = null
}

function confirmRemoveProvider(): void {
  const target = pendingDeleteProvider.value
  if (!target) {
    return
  }

  emit('removeCustomModel', target.id)
  pendingDeleteProvider.value = null
}

function isCapabilitiesExpanded(id: string): boolean {
  return expandedCapabilityCards.value.has(id)
}

function toggleCapabilities(id: string): void {
  const next = new Set(expandedCapabilityCards.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }

  expandedCapabilityCards.value = next
}

function updateDeepseekCapability(
  field: keyof ProviderCapabilities,
  value: ProviderCapabilities[keyof ProviderCapabilities],
): void {
  emit('updateDeepseekCapability', field, value)
}

function updateCustomCapability(
  id: string,
  field: keyof ProviderCapabilities,
  value: ProviderCapabilities[keyof ProviderCapabilities],
): void {
  emit('updateCustomModelCapability', id, field, value)
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
        <ProviderCapabilitiesEditor
          :expanded="isCapabilitiesExpanded('deepseek')"
          :settings="props.settings.deepseek"
          @toggle="toggleCapabilities('deepseek')"
          @update-capability="updateDeepseekCapability"
        />
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
          <button class="danger-text" type="button" @click="requestRemoveProvider(item.id, item.name)">删除</button>
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
        <ProviderCapabilitiesEditor
          :expanded="isCapabilitiesExpanded(item.id)"
          :settings="item"
          @toggle="toggleCapabilities(item.id)"
          @update-capability="(field, value) => updateCustomCapability(item.id, field, value)"
        />
      </article>

      <article v-if="pendingDeleteProvider" class="setting-card">
        <div class="setting-card-head">
          <div>
            <h4>确认删除</h4>
            <p>确认删除服务商「{{ pendingDeleteProvider.name }}」吗？</p>
          </div>
        </div>
        <div class="provider-head">
          <button class="ghost-action" type="button" @click="cancelRemoveProvider">取消</button>
          <button class="danger-text" type="button" @click="confirmRemoveProvider">确认删除</button>
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

    <div
      v-if="pendingDeleteProvider"
      class="confirm-dialog-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="provider-delete-title"
      aria-describedby="provider-delete-description"
      @click.self="cancelRemoveProvider"
    >
      <article class="setting-card confirm-dialog">
        <div class="setting-card-head">
          <div>
            <h4 id="provider-delete-title">确认删除</h4>
            <p id="provider-delete-description">确认删除服务商「{{ pendingDeleteProvider.name }}」吗？</p>
          </div>
        </div>
        <div class="provider-head confirm-dialog-actions">
          <button class="ghost-action" type="button" @click="cancelRemoveProvider">取消</button>
          <button class="danger-text" type="button" @click="confirmRemoveProvider">确认删除</button>
        </div>
      </article>
    </div>
  </section>
</template>
