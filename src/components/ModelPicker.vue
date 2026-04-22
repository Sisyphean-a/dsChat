<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ModelConfigOption } from '../types/chat'

const props = defineProps<{
  disabled: boolean
  modelValue: string
  options: ModelConfigOption[]
}>()

const emit = defineEmits<{
  select: [value: string]
}>()

const rootRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)

const currentMeta = computed(() => {
  return props.options.find((option) => option.value === props.modelValue) ?? {
    badge: '模型',
    detail: props.modelValue,
    label: props.modelValue,
    shortLabel: props.modelValue,
    value: props.modelValue,
  }
})

function togglePanel(): void {
  if (props.disabled) {
    return
  }

  isOpen.value = !isOpen.value
}

function selectModel(model: string): void {
  emit('select', model)
  isOpen.value = false
}

function closeOnOutside(event: MouseEvent): void {
  if (!rootRef.value || rootRef.value.contains(event.target as Node)) {
    return
  }

  isOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', closeOnOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeOnOutside)
})
</script>

<template>
  <div ref="rootRef" class="model-picker" :class="{ disabled: props.disabled, open: isOpen }">
    <button class="picker-trigger" type="button" :disabled="props.disabled" @click="togglePanel">
      <span class="provider-badge">{{ currentMeta.badge }}</span>
      <span class="picker-copy">{{ currentMeta.shortLabel }}</span>
      <svg class="picker-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>

    <transition name="picker-fade">
      <div v-if="isOpen" class="picker-panel">
        <button
          v-for="option in props.options"
          :key="option.value"
          class="picker-option"
          :class="{ active: option.value === props.modelValue }"
          type="button"
          @click="selectModel(option.value)"
        >
          <strong>{{ option.label }}</strong>
          <span>{{ option.detail }}</span>
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.picker-fade-enter-active,
.picker-fade-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.picker-fade-enter-from,
.picker-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.model-picker {
  position: relative;
  width: 228px;
}

.picker-trigger {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-soft);
  color: var(--text);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
  transition: border-color 160ms ease, background 160ms ease, transform 160ms ease, box-shadow 160ms ease;
}

.picker-trigger:hover:not(:disabled),
.model-picker.open .picker-trigger {
  border-color: rgba(16, 163, 127, 0.28);
  background: var(--bg-hover);
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(16, 163, 127, 0.08);
}

.provider-badge {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 0.67rem;
  font-weight: 700;
}

.picker-copy {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.78rem;
  font-weight: 600;
  text-align: left;
}

.picker-arrow {
  color: var(--text-muted);
  transition: transform 160ms ease;
}

.model-picker.open .picker-arrow {
  transform: rotate(180deg);
}

.picker-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 8px);
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg);
  box-shadow: var(--panel-shadow);
  z-index: 20;
}

.picker-option {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 9px;
  border-radius: 9px;
  text-align: left;
  transition: background 150ms ease, transform 150ms ease;
}

.picker-option strong {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text);
}

.picker-option span {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.picker-option:hover,
.picker-option.active {
  background: var(--bg-hover);
  transform: translateY(-1px);
}

.disabled .picker-trigger {
  opacity: 0.7;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .model-picker {
    width: 188px;
  }
}
</style>
