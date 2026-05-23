<script setup lang="ts">
import { computed } from 'vue'
import { providerSupportsToolCalling } from '../constants/providerCapabilities'
import type { ProviderCapabilities, ProviderSettings } from '../types/chat'

const props = defineProps<{
  expanded: boolean
  settings: ProviderSettings
}>()

const emit = defineEmits<{
  toggle: []
  updateCapability: [
    field: keyof ProviderCapabilities,
    value: ProviderCapabilities[keyof ProviderCapabilities],
  ]
}>()

const CAPABILITY_HELP = {
  imageInput: '允许把用户上传的图片随消息发给模型。',
  nativeWebSearch: '使用服务商 API 自带的联网搜索能力，不经过本地工具编排。',
  protocol: '决定请求使用 Chat Completions API 还是 Responses API 格式。',
  reasoning: '允许显示思考开关，并在请求中发送厂商支持的推理参数。',
  toolCalling: '允许模型调用本地内置工具，例如时间工具、Tavily 搜索。',
} as const

const CAPABILITY_LABELS = {
  imageInput: '图片',
  reasoning: '思考',
  toolCalling: '工具',
  nativeWebSearch: '联网',
} as const

const summaryCapabilities = computed(() => ({
  imageInput: props.settings.capabilities.imageInput,
  reasoning: props.settings.capabilities.reasoning,
  toolCalling: providerSupportsToolCalling(props.settings),
  nativeWebSearch: props.settings.capabilities.nativeWebSearch,
}))

function enabledCapabilityLabels(): string {
  const states = summaryCapabilities.value
  const labels = Object.entries(CAPABILITY_LABELS)
    .filter(([key]) => states[key as keyof typeof CAPABILITY_LABELS])
    .map(([, label]) => label)

  return labels.length ? labels.join(' / ') : '无'
}

function resolveCapabilityTitle(key: keyof typeof CAPABILITY_LABELS): string {
  if (key === 'toolCalling') {
    return resolveToolCallingTitle()
  }

  return CAPABILITY_HELP[key]
}

function updateProtocol(protocol: ProviderCapabilities['protocol']): void {
  emit('updateCapability', 'protocol', protocol)
  if (protocol === 'responses' && props.settings.capabilities.toolCalling) {
    emit('updateCapability', 'toolCalling', false)
  }
}

function updateCapability(
  field: keyof ProviderCapabilities,
  value: ProviderCapabilities[keyof ProviderCapabilities],
): void {
  emit('updateCapability', field, value)
}

function resolveToolCallingTitle(): string {
  if (props.settings.capabilities.protocol === 'chat_completions') {
    return CAPABILITY_HELP.toolCalling
  }

  return '本地工具调用当前只支持 Chat Completions API 协议。'
}
</script>

<template>
  <div class="capability-summary-row">
    <span class="capability-summary-label">能力</span>
    <div class="capability-pills" :title="`已启用：${enabledCapabilityLabels()}`">
      <span
        v-for="(label, key) in CAPABILITY_LABELS"
        :key="key"
        class="capability-pill"
        :class="{ off: !summaryCapabilities[key] }"
        :title="resolveCapabilityTitle(key)"
      >
        {{ label }}
      </span>
    </div>
    <button
      class="capability-toggle"
      type="button"
      :aria-expanded="props.expanded"
      @click="emit('toggle')"
    >
      {{ props.expanded ? '收起' : '配置' }}
    </button>
  </div>

  <div v-if="props.expanded" class="capability-panel">
    <label class="field-shell">
      <span :title="CAPABILITY_HELP.protocol">协议</span>
      <select
        :value="props.settings.capabilities.protocol"
        @change="updateProtocol(($event.target as HTMLSelectElement).value as ProviderCapabilities['protocol'])"
      >
        <option value="chat_completions">Chat Completions API</option>
        <option value="responses">Responses API</option>
      </select>
    </label>
    <div class="capability-switch-grid">
      <label class="switch-row" :title="CAPABILITY_HELP.imageInput">
        <input
          :checked="props.settings.capabilities.imageInput"
          type="checkbox"
          @change="updateCapability('imageInput', ($event.target as HTMLInputElement).checked)"
        />
        <span>图片输入</span>
      </label>
      <label class="switch-row" :title="CAPABILITY_HELP.reasoning">
        <input
          :checked="props.settings.capabilities.reasoning"
          type="checkbox"
          @change="updateCapability('reasoning', ($event.target as HTMLInputElement).checked)"
        />
        <span>思考能力</span>
      </label>
      <label class="switch-row" :title="resolveToolCallingTitle()">
        <input
          :checked="providerSupportsToolCalling(props.settings)"
          :disabled="props.settings.capabilities.protocol !== 'chat_completions'"
          type="checkbox"
          @change="updateCapability('toolCalling', ($event.target as HTMLInputElement).checked)"
        />
        <span>工具调用</span>
      </label>
      <label class="switch-row" :title="CAPABILITY_HELP.nativeWebSearch">
        <input
          :checked="props.settings.capabilities.nativeWebSearch"
          type="checkbox"
          @change="updateCapability('nativeWebSearch', ($event.target as HTMLInputElement).checked)"
        />
        <span>原生联网</span>
      </label>
    </div>
  </div>
</template>
