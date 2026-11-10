<script setup lang="ts">
import { computed } from 'vue'
import type { SettingsForm } from '../types/chat'
import type { MemoryFact, MemoryStatus } from '../types/memory'
import { MEMORY_OBSERVE_INTERVAL_OPTIONS } from '../constants/memory'
import type { SettingsEdit } from '../types/settingsPanel'

const props = defineProps<{
  facts: MemoryFact[]
  settings: SettingsForm
  status: MemoryStatus | null
}>()

const emit = defineEmits<{
  clear: []
  edit: [edit: SettingsEdit]
  forget: [id: string]
  pin: [id: string]
}>()

const kindLabels: Record<MemoryFact['kind'], string> = {
  profile: '身份',
  preference: '偏好',
  background: '背景',
  instruction: '要求',
}

const visibleFacts = computed(() => props.facts.slice(0, 100))
const storageLabel = computed(() => {
  if (!props.status) return '读取中…'
  if (props.status.storage === 'file') return `本地文件 · ${props.status.location}`
  if (props.status.storage === 'localStorage') return '浏览器 localStorage（预览模式，不随插件更新保留）'
  return '内存（临时，不持久化）'
})
const lastObservedLabel = computed(() => {
  if (!props.status?.lastObservedAt) return '尚未抽取'
  return new Date(props.status.lastObservedAt).toLocaleString('zh-CN')
})

function updateInterval(event: Event): void {
  const value = Number((event.target as HTMLSelectElement).value)
  emit('edit', { domain: 'memory', action: 'updateObserveEveryTurns', value })
}

function toggleEnabled(): void {
  emit('edit', {
    domain: 'memory',
    action: 'toggle',
    enabled: !props.settings.memory.enabled,
  })
}

function clearAll(): void {
  if (window.confirm('确认清空全部记忆？历史事件仍保留在本地日志中，但不会再参与对话。')) {
    emit('clear')
  }
}
</script>

<template>
  <section class="settings-page" aria-labelledby="settings-memory-title">
    <header class="page-heading">
      <h3 id="settings-memory-title">记忆</h3>
    </header>
    <div class="settings-grid">
      <article class="setting-card wide-card">
        <div class="setting-card-head split-head">
          <h4>长期记忆</h4>
          <button type="button" class="ghost-button" @click="toggleEnabled">
            {{ props.settings.memory.enabled ? '已开启' : '已关闭' }}
          </button>
        </div>
        <p class="field-hint">
          开启后，每聊 {{ props.settings.memory.observeEveryTurns }} 轮会从对话里提炼值得长期记住的信息；下次提问时自动挑相关的几条放进提示词。
        </p>
        <label class="field-label" for="memory-interval">抽取间隔</label>
        <select
          id="memory-interval"
          class="text-input"
          :value="props.settings.memory.observeEveryTurns"
          @change="updateInterval"
        >
          <option v-for="option in MEMORY_OBSERVE_INTERVAL_OPTIONS" :key="option" :value="option">
            每 {{ option }} 轮
          </option>
        </select>
        <dl class="memory-meta">
          <div><dt>存储</dt><dd>{{ storageLabel }}</dd></div>
          <div><dt>已记住</dt><dd>{{ props.status?.factCount ?? 0 }} 条</dd></div>
          <div><dt>上次抽取</dt><dd>{{ lastObservedLabel }}</dd></div>
        </dl>
        <p v-if="props.status?.lastError" class="settings-save-error" role="alert">
          上次抽取失败：{{ props.status.lastError }}
        </p>
      </article>

      <article class="setting-card wide-card">
        <div class="setting-card-head split-head">
          <h4>记住的事</h4>
          <button v-if="props.facts.length" type="button" class="ghost-button" @click="clearAll">
            清空
          </button>
        </div>
        <p v-if="!props.facts.length" class="field-hint">
          还没有记忆。正常聊天即可，达到间隔后会自动提炼。
        </p>
        <ul v-else class="memory-list">
          <li v-for="fact in visibleFacts" :key="fact.id" class="memory-item">
            <div class="memory-item-main">
              <span class="memory-kind">{{ kindLabels[fact.kind] }}</span>
              <span class="memory-text">{{ fact.text }}</span>
            </div>
            <div class="memory-item-actions">
              <button type="button" class="ghost-button" @click="emit('pin', fact.id)">
                {{ fact.pinned ? '取消钉住' : '钉住' }}
              </button>
              <button type="button" class="ghost-button" @click="emit('forget', fact.id)">移除</button>
            </div>
          </li>
        </ul>
        <p v-if="props.facts.length > visibleFacts.length" class="field-hint">
          仅显示最近 {{ visibleFacts.length }} 条。
        </p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.memory-meta {
  display: grid;
  gap: 6px;
  margin: 12px 0 0;
  font-size: 12px;
}

.memory-meta div {
  display: flex;
  gap: 8px;
}

.memory-meta dt {
  color: var(--text-muted);
  min-width: 64px;
}

.memory-meta dd {
  margin: 0;
  word-break: break-all;
}

.memory-list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.memory-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border: 1px solid var(--border-soft);
  border-radius: 8px;
}

.memory-item-main {
  display: flex;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
  line-height: 1.5;
}

.memory-kind {
  flex: none;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--surface-muted);
  color: var(--text-muted);
  font-size: 11px;
  line-height: 20px;
}

.memory-text {
  word-break: break-word;
}

.memory-item-actions {
  display: flex;
  flex: none;
  gap: 6px;
}
</style>
