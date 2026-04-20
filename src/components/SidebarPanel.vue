<script setup lang="ts">
import { computed } from 'vue'
import type { ConversationDoc } from '../types/chat'

const props = defineProps<{
  activeConversationId: string | null
  collapsed: boolean
  conversations: ConversationDoc[]
  disabled: boolean
}>()

const emit = defineEmits<{
  newConversation: []
  openSettings: []
  selectConversation: [id: string]
  toggle: []
}>()

const panelClass = computed(() => ({
  'sidebar-panel': true,
  'is-collapsed': props.collapsed,
}))

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(timestamp)
}
</script>

<template>
  <aside :class="panelClass">
    <div class="sidebar-header">
      <button class="icon-button" type="button" @click="emit('toggle')" title="切换侧边栏">
        <svg v-if="collapsed" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
    </div>

    <template v-if="!collapsed">
      <div class="sidebar-action">
        <button
          class="primary-button"
          type="button"
          :disabled="props.disabled"
          @click="emit('newConversation')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          新对话
        </button>
      </div>

      <div class="sidebar-body">
        <div v-if="conversations.length" class="history-list">
          <button
            v-for="conversation in conversations"
            :key="conversation.id"
            class="history-item"
            :class="{ active: conversation.id === activeConversationId }"
            type="button"
            :disabled="props.disabled"
            @click="emit('selectConversation', conversation.id)"
          >
            <span class="item-title">{{ conversation.title }}</span>
            <span class="item-time">{{ formatTime(conversation.updatedAt) }}</span>
          </button>
        </div>

        <div v-else class="history-empty">
          <p>暂无对话记录</p>
        </div>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.sidebar-panel {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 260px;
  flex-shrink: 0;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  transition: width 200ms ease;
}

.sidebar-panel.is-collapsed {
  width: 52px;
}

.sidebar-header {
  height: 52px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  flex-shrink: 0;
}

.icon-button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  transition: background 150ms;
}

.icon-button:hover {
  background: var(--bg-active);
  color: var(--text);
}

.sidebar-action {
  padding: 0 12px 16px;
  flex-shrink: 0;
}

.primary-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bg-hover);
  color: var(--text);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 500;
  transition: background 150ms;
}

.primary-button:hover {
  background: var(--bg-active);
}

.sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 16px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history-item {
  width: 100%;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
  border-radius: var(--radius-md);
  transition: background 150ms;
}

.history-item:hover {
  background: var(--bg-hover);
}

.history-item.active {
  background: var(--bg-active);
}

.item-title {
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text);
}

.item-time {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.history-empty {
  padding: 32px 12px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.history-item:disabled,
.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
