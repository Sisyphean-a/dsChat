<script setup lang="ts">
import { computed } from 'vue'
import type { ConversationDoc } from '../types/chat'

const props = defineProps<{
  activeConversationId: string | null
  collapsed: boolean
  conversations: ConversationDoc[]
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
      <button class="sidebar-toggle" type="button" @click="emit('toggle')">
        {{ collapsed ? '展开' : '收起' }}
      </button>
      <button v-if="!collapsed" class="primary-button" type="button" @click="emit('newConversation')">
        新对话
      </button>
    </div>

    <template v-if="!collapsed">
      <div class="sidebar-body">
        <div v-if="conversations.length" class="history-list">
          <button
            v-for="conversation in conversations"
            :key="conversation.id"
            class="history-item"
            :class="{ active: conversation.id === activeConversationId }"
            type="button"
            @click="emit('selectConversation', conversation.id)"
          >
            <strong>{{ conversation.title }}</strong>
            <span>{{ formatTime(conversation.updatedAt) }}</span>
          </button>
        </div>

        <div v-else class="history-empty">
          <p>历史记录会显示在这里。</p>
          <p>发送第一条消息后，会自动创建会话。</p>
        </div>
      </div>

      <div class="sidebar-footer">
        <button class="ghost-wide" type="button" @click="emit('openSettings')">
          打开设置
        </button>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.sidebar-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border-radius: 28px;
  background: rgba(25, 43, 46, 0.95);
  color: #f6f3ea;
  box-shadow: 0 18px 40px rgba(37, 48, 54, 0.16);
}

.sidebar-panel.is-collapsed {
  width: 92px;
}

.sidebar-header,
.sidebar-footer {
  display: flex;
  gap: 10px;
}

.sidebar-header {
  justify-content: space-between;
}

.sidebar-body {
  min-height: 0;
  flex: 1;
}

.history-list {
  height: 100%;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item,
.sidebar-toggle,
.primary-button,
.ghost-wide {
  border-radius: 14px;
  transition:
    transform 160ms ease,
    background 160ms ease;
}

.history-item,
.sidebar-toggle,
.ghost-wide {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
}

.history-item {
  width: 100%;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}

.history-item strong {
  font-size: 0.96rem;
  font-weight: 600;
}

.history-item span,
.history-empty {
  color: rgba(246, 243, 234, 0.68);
  font-size: 0.84rem;
}

.history-item.active {
  background: rgba(18, 95, 88, 0.46);
  border-color: rgba(255, 255, 255, 0.16);
}

.sidebar-toggle,
.ghost-wide {
  padding: 12px 14px;
}

.primary-button {
  padding: 12px 16px;
  background: #f2ebdd;
  color: #203035;
}

.ghost-wide {
  width: 100%;
}

.history-item:hover,
.sidebar-toggle:hover,
.primary-button:hover,
.ghost-wide:hover {
  transform: translateY(-1px);
}

.history-empty {
  padding: 18px 6px;
  line-height: 1.7;
}

@media (max-width: 1024px) {
  .sidebar-panel,
  .sidebar-panel.is-collapsed {
    width: 100%;
  }
}
</style>
