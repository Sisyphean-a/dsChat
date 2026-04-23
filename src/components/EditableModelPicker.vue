<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  allowManage: boolean
  disabled: boolean
  modelValue: string
  options: string[]
  placeholder?: string
}>()

const emit = defineEmits<{
  addOption: [value: string]
  renameOption: [payload: { from: string; to: string }]
  removeOption: [value: string]
  select: [value: string]
}>()

const rootRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const draftOption = ref('')
const editingFrom = ref<string | null>(null)

const normalizedOptions = computed(() => {
  const visited = new Set<string>()
  const normalized: string[] = []

  for (const item of props.options) {
    const value = item.trim()
    if (!value || visited.has(value)) {
      continue
    }

    visited.add(value)
    normalized.push(value)
  }

  return normalized
})

function togglePanel(): void {
  if (props.disabled) {
    return
  }

  isOpen.value = !isOpen.value
}

function openPanel(): void {
  if (!props.disabled) {
    isOpen.value = true
  }
}

function selectModel(model: string): void {
  emit('select', model)
  isOpen.value = false
}

function submitOption(): void {
  if (!props.allowManage) {
    return
  }

  const value = draftOption.value.trim()
  if (!value) {
    return
  }

  if (editingFrom.value) {
    const from = editingFrom.value
    emit('renameOption', { from, to: value })
    if (props.modelValue === from) {
      emit('select', value)
    }
    clearDraft()
    return
  }

  emit('addOption', value)
  emit('select', value)
  clearDraft()
}

function removeOption(model: string): void {
  if (editingFrom.value === model) {
    clearDraft()
  }
  emit('removeOption', model)
}

function editOption(model: string): void {
  if (!props.allowManage) {
    return
  }

  editingFrom.value = model
  draftOption.value = model
}

function updateModel(event: Event): void {
  emit('select', (event.target as HTMLInputElement).value)
}

function closeOnOutside(event: MouseEvent): void {
  if (!rootRef.value || rootRef.value.contains(event.target as Node)) {
    return
  }

  isOpen.value = false
  clearDraft()
}

function clearDraft(): void {
  draftOption.value = ''
  editingFrom.value = null
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
    <div class="picker-trigger">
      <input
        class="picker-input"
        :disabled="props.disabled"
        :placeholder="props.placeholder ?? '输入模型 ID'"
        :value="props.modelValue"
        type="text"
        @focus="openPanel"
        @input="updateModel"
      />
      <button class="picker-toggle" type="button" :disabled="props.disabled" @click="togglePanel">
        <svg class="picker-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
    </div>

    <transition name="picker-fade">
      <div v-if="isOpen" class="picker-panel">
        <div v-if="props.allowManage" class="picker-manage">
          <input
            v-model="draftOption"
            class="picker-manage-input"
            :placeholder="editingFrom ? '编辑模型 ID' : '新增模型 ID'"
            type="text"
            @keydown.enter.prevent="submitOption"
          />
          <div class="picker-manage-actions">
            <button class="picker-manage-button" type="button" @click="submitOption">
              {{ editingFrom ? '保存' : '添加' }}
            </button>
            <button
              v-if="editingFrom"
              class="picker-manage-cancel"
              type="button"
              @click="clearDraft"
            >
              取消
            </button>
          </div>
        </div>

        <div v-if="normalizedOptions.length" class="picker-options">
          <div
            v-for="option in normalizedOptions"
            :key="option"
            class="picker-option"
            :class="{ active: option === props.modelValue }"
          >
            <button class="picker-option-main" type="button" @click="selectModel(option)">
              <strong>{{ option }}</strong>
            </button>
            <div v-if="props.allowManage" class="picker-option-actions">
              <button
                class="picker-option-edit"
                type="button"
                @click.stop="editOption(option)"
              >
                编辑
              </button>
              <button
                class="picker-option-remove"
                type="button"
                @click.stop="removeOption(option)"
              >
                删除
              </button>
            </div>
          </div>
        </div>
        <div v-else class="picker-empty">暂无模型</div>
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
  transform: translateY(-6px);
}

.model-picker {
  position: relative;
  width: 100%;
}

.picker-trigger {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 6px 0 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-soft);
  transition: border-color 160ms ease, background 160ms ease, transform 160ms ease, box-shadow 160ms ease;
}

.picker-trigger:hover,
.model-picker.open .picker-trigger {
  border-color: rgba(16, 163, 127, 0.28);
  background: var(--bg-hover);
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(16, 163, 127, 0.08);
}

.picker-input {
  width: 100%;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 0.78rem;
  font-weight: 600;
  font-family: var(--font-mono);
  outline: none;
}

.picker-input::placeholder {
  color: var(--text-muted);
}

.picker-toggle {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: var(--text-muted);
}

.picker-arrow {
  transition: transform 160ms ease;
}

.model-picker.open .picker-arrow {
  transform: rotate(180deg);
}

.picker-panel {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 8px);
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg);
  box-shadow: var(--panel-shadow);
  z-index: 20;
}

.picker-manage {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
}

.picker-manage-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.picker-manage-input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-soft);
  color: var(--text);
  padding: 6px 8px;
  font-size: 0.75rem;
  outline: none;
  font-family: var(--font-mono);
}

.picker-manage-button {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 10px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text);
  background: var(--bg-soft);
}

.picker-manage-cancel {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 8px;
  font-size: 0.72rem;
  color: var(--text-muted);
  height: 30px;
}

.picker-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 180px;
  overflow: auto;
}

.picker-option {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
  align-items: center;
  border-radius: 9px;
  background: transparent;
}

.picker-option-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
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

.picker-option:hover .picker-option-main,
.picker-option.active .picker-option-main {
  background: var(--bg-hover);
  transform: translateY(-1px);
}

.picker-option-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.picker-option-edit,
.picker-option-remove {
  padding: 0 6px;
  font-size: 0.7rem;
  border-radius: 6px;
  height: 24px;
}

.picker-option-edit {
  color: var(--text-muted);
}

.picker-option-edit:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.picker-option-remove {
  color: var(--danger);
}

.picker-option-remove:hover {
  background: rgba(239, 68, 68, 0.1);
}

.picker-empty {
  font-size: 0.72rem;
  color: var(--text-muted);
  text-align: center;
  padding: 8px 0;
}

.disabled .picker-trigger {
  opacity: 0.7;
}
</style>
