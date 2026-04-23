<script setup lang="ts">
import { computed } from 'vue'
import type { ConversationDoc } from '../types/chat'

const props = defineProps<{
  activeConversationId: string | null
  collapsed: boolean
  conversations: ConversationDoc[]
  disabled: boolean
  deleteDisabled: boolean
}>()

const emit = defineEmits<{
  deleteConversation: [id: string]
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
          <div
            v-for="conversation in conversations"
            :key="conversation.id"
            class="history-item"
            :class="{ active: conversation.id === activeConversationId }"
          >
            <button
              class="history-main"
              type="button"
              :disabled="props.disabled"
              @click="emit('selectConversation', conversation.id)"
            >
              <span class="item-title">{{ conversation.title }}</span>
              <span class="item-time">{{ formatTime(conversation.updatedAt) }}</span>
            </button>

            <button
              class="history-delete ghost-button"
              type="button"
              :disabled="props.deleteDisabled"
              title="删除对话"
              @click="emit('deleteConversation', conversation.id)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14H6L5 6"></path>
                <path d="M10 11v6"></path>
                <path d="M14 11v6"></path>
                <path d="M9 6V4h6v2"></path>
              </svg>
            </button>
          </div>
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
  width: 0;
  border-right: none;
  overflow: hidden;
}



.sidebar-action {
  padding: 16px 12px 16px;
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
  display: flex;
  align-items: stretch;
  gap: 6px;
  border-radius: var(--radius-md);
  transition: background 150ms;
}

.history-item:hover {
  background: var(--bg-hover);
}

.history-item.active {
  background: var(--bg-active);
}

.history-main {
  flex: 1;
  min-width: 0;
  padding: 10px 0 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
}

.history-delete {
  width: 40px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 6px 6px 6px 0;
  opacity: 0.72;
  color: var(--text-muted);
  transition: opacity 150ms, background 150ms, color 150ms, transform 150ms;
}

.history-item:hover .history-delete,
.history-item.active .history-delete {
  opacity: 1;
  transform: translateY(-1px);
}

.history-delete:hover {
  background: rgba(239, 68, 68, 0.08);
  color: var(--danger);
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

.history-main:disabled,
.history-delete:disabled,
.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
