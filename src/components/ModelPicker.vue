<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  disabled: boolean
  modelValue: string
  options: string[]
}>()

const emit = defineEmits<{
  select: [value: string]
}>()

const rootRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)

const optionMeta: Record<string, { label: string }> = {
  'deepseek-chat': {
    label: 'Chat',
  },
  'deepseek-reasoner': {
    label: 'Reasoner',
  },
}

const currentMeta = computed(() => optionMeta[props.modelValue] ?? {
  label: props.modelValue,
})

function togglePanel(): void {
  if (props.disabled) return
  isOpen.value = !isOpen.value
}

function selectModel(model: string): void {
  emit('select', model)
  isOpen.value = false
}

function closeOnOutside(event: MouseEvent): void {
  if (!rootRef.value) return
  if (rootRef.value.contains(event.target as Node)) return
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
  <div ref="rootRef" class="model-picker" :class="{ open: isOpen, disabled: props.disabled }">
    <button class="picker-trigger" type="button" :disabled="props.disabled" @click="togglePanel">
      <span class="picker-copy">{{ currentMeta.label }}</span>
      <svg class="picker-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>

    <transition name="picker-fade">
      <div v-if="isOpen" class="picker-panel">
        <button
          v-for="option in props.options"
          :key="option"
          class="picker-option"
          :class="{ active: option === props.modelValue }"
          type="button"
          @click="selectModel(option)"
        >
          <span>{{ optionMeta[option]?.label ?? option }}</span>
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
  width: 116px;
}

.picker-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  height: 28px;
  padding: 0 9px;
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

.picker-copy {
  min-width: 0;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text);
}

.picker-option span {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text);
}

.picker-option small {
  margin-top: 2px;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.picker-arrow {
  flex-shrink: 0;
  color: var(--text-muted);
  transition: transform 160ms ease;
}

.model-picker.open .picker-arrow {
  transform: rotate(180deg);
}

.picker-panel {
  position: absolute;
  left: 0;
  right: -18px;
  bottom: calc(100% + 8px);
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 5px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
  box-shadow: var(--panel-shadow);
  z-index: 20;
}

.picker-option {
  padding: 7px 9px;
  border-radius: 8px;
  text-align: left;
  transition: background 150ms ease, transform 150ms ease;
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
</style>
