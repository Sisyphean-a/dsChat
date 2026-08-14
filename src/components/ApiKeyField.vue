<script setup lang="ts">
import { ref } from 'vue'
import { PhEye, PhEyeSlash } from '@phosphor-icons/vue'

const props = defineProps<{
  modelValue: string
  placeholder: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isVisible = ref(false)

function toggleVisibility(): void {
  isVisible.value = !isVisible.value
}
</script>

<template>
  <label class="field-shell">
    <span>API Key</span>
    <span class="api-key-control">
      <input
        :value="props.modelValue"
        :placeholder="props.placeholder"
        :type="isVisible ? 'text' : 'password'"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <button
        class="api-key-visibility"
        :aria-label="isVisible ? '隐藏 API Key' : '显示 API Key'"
        :aria-pressed="isVisible"
        :title="isVisible ? '隐藏 API Key' : '显示 API Key'"
        type="button"
        @click="toggleVisibility"
      >
        <PhEyeSlash v-if="isVisible" :size="16" aria-hidden="true" weight="bold" />
        <PhEye v-else :size="16" aria-hidden="true" weight="bold" />
      </button>
    </span>
  </label>
</template>
