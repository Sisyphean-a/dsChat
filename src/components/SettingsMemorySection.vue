<script setup lang="ts">
import { computed } from 'vue'
import type { SettingsForm } from '../types/chat'
import type { MemoryFact, MemoryStatus } from '../types/memory'
import { MEMORY_OBSERVE_INTERVAL_OPTIONS } from '../constants/memory'
import type { SettingsEdit } from '../types/settingsPanel'

const props = defineProps<{
  facts: MemoryFact[]
  pendingTurns: number
  settings: SettingsForm
  status: MemoryStatus | null
}>()

const emit = defineEmits<{
  clear: []
  edit: [edit: SettingsEdit]
  forget: [id: string]
  observeNow: []
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
  const time = new Date(props.status.lastObservedAt).toLocaleString('zh-CN')
  const count = props.status.lastObservedCount
  return count === null || count === undefined ? time : `${time} · ${count} 条`
})
const pendingLabel = computed(() => {
  if (props.pendingTurns > 0) return `待抽取 ${props.pendingTurns} 轮`
  return props.status?.lastObservedAt ? '已抽取完，继续聊会重新累计' : '待抽取 0 轮'
})

function setEnabled(enabled: boolean): void {
  if (enabled === props.settings.memory.enabled) return
  emit('edit', { domain: 'memory', action: 'toggle', enabled })
}

function updateInterval(event: Event): void {
  const value = Number((event.target as HTMLSelectElement).value)
  emit('edit', { domain: 'memory', action: 'updateObserveEveryTurns', value })
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
          <div class="pill-control memory-toggle" role="group" aria-label="长期记忆开关">
            <button type="button" :class="{ active: props.settings.memory.enabled }" @click="setEnabled(true)">
              开启
            </button>
            <button type="button" :class="{ active: !props.settings.memory.enabled }" @click="setEnabled(false)">
              关闭
            </button>
          </div>
        </div>
        <p class="field-hint">
          开启后，每聊 {{ props.settings.memory.observeEveryTurns }} 轮会从对话里提炼值得长期记住的信息；下次提问时自动挑相关的几条放进提示词。轮数按会话独立累计，回复成功结束后才计数。
        </p>
        <label class="field-shell memory-interval-field">
          <span>抽取间隔</span>
          <select
            :value="props.settings.memory.observeEveryTurns"
            @change="updateInterval"
          >
            <option v-for="option in MEMORY_OBSERVE_INTERVAL_OPTIONS" :key="option" :value="option">
              每 {{ option }} 轮
            </option>
          </select>
        </label>
        <dl class="memory-meta">
          <div><dt>存储</dt><dd>{{ storageLabel }}</dd></div>
          <div><dt>已记住</dt><dd>{{ props.status?.factCount ?? 0 }} 条</dd></div>
          <div><dt>本会话</dt><dd>{{ pendingLabel }}</dd></div>
          <div><dt>上次抽取</dt><dd>{{ lastObservedLabel }}</dd></div>
        </dl>
        <p v-if="props.status?.lastError" class="settings-save-error" role="alert">
          上次抽取失败：{{ props.status.lastError }}
        </p>
        <p v-else-if="props.status?.lastObservedAt && props.status.lastObservedCount === 0" class="field-hint">
          上次抽取没有发现可长期记住的信息。试试直接说一句：“记住：我用 VSCode 写前端，回答先给结论”，再点下方按钮。
        </p>
        <div class="memory-actions">
          <button
            type="button"
            class="primary-action"
            :disabled="props.pendingTurns === 0 || props.status?.observing"
            @click="emit('observeNow')"
          >
            {{ props.status?.observing ? '正在抽取…' : '立即抽取当前会话' }}
          </button>
        </div>
      </article>

      <article class="setting-card wide-card">
        <div class="setting-card-head split-head">
          <h4>记住的事</h4>
          <button v-if="props.facts.length" type="button" class="danger-text" @click="clearAll">
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
              <button type="button" class="capability-toggle" @click="emit('pin', fact.id)">
                {{ fact.pinned ? '取消钉住' : '钉住' }}
              </button>
              <button type="button" class="capability-toggle" @click="emit('forget', fact.id)">
                移除
              </button>
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
.memory-toggle {
  flex: none;
  width: auto;
}

.memory-interval-field {
  max-width: 220px;
}

.memory-toggle button {
  min-width: 52px;
  padding: 5px 10px;
  font-size: 0.74rem;
}

.memory-actions {
  margin-top: 14px;
  display: flex;
  gap: 8px;
}

.memory-meta {
  display: grid;
  gap: 6px;
  margin: 14px 0 0;
  font-size: 0.8rem;
  line-height: 1.45;
}

.memory-meta div {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 10px;
}

.memory-meta dt {
  color: var(--text-muted);
}

.memory-meta dd {
  margin: 0;
  word-break: break-all;
}

.memory-list {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.memory-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-soft);
}

.memory-item-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  font-size: 0.82rem;
  line-height: 1.55;
}

.memory-kind {
  flex: none;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1.5;
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
