<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import ChatComposer from './components/ChatComposer.vue'
import MessageBubble from './components/MessageBubble.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import SidebarPanel from './components/SidebarPanel.vue'
import { useChatApp } from './composables/useChatApp'

const app = useChatApp()
const messageListRef = ref<HTMLElement | null>(null)

const currentTitle = computed(() => {
  if (!app.activeConversationId.value) return '新对话'
  const target = app.conversations.value.find(c => c.id === app.activeConversationId.value)
  return target?.title || '新对话'
})

const messageScrollKey = computed(() => {
  const last = app.messages.value.at(-1)
  if (!last) return `${app.activeConversationId.value ?? 'empty'}:0`
  return [
    app.activeConversationId.value ?? 'empty',
    app.messages.value.length,
    last.id,
    last.status,
    last.content.length,
    last.reasoningContent?.length ?? 0,
  ].join(':')
})

async function scrollToBottom(): Promise<void> {
  await nextTick()
  if (!messageListRef.value) return
  messageListRef.value.scrollTop = messageListRef.value.scrollHeight
}

onMounted(() => {
  void app.initialize()
})

watch(messageScrollKey, () => {
  void scrollToBottom()
}, { flush: 'post' })
</script>

<template>
  <div class="app-shell">
    <SidebarPanel
      :active-conversation-id="app.activeConversationId.value"
      :collapsed="app.isSidebarCollapsed.value"
      :conversations="app.conversations.value"
      :disabled="app.isSending.value"
      @delete-conversation="app.deleteConversation"
      @new-conversation="app.startFreshConversation"
      @open-settings="app.openSettings"
      @select-conversation="app.selectConversation"
      @toggle="app.toggleSidebar"
    />

    <main class="chat-stage">
      <header class="chat-header">
        <button class="ghost-button action-btn" type="button" @click="app.toggleSidebar" title="历史会话">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
          </svg>
        </button>
        
        <span class="chat-title">{{ currentTitle }}</span>
        
        <button class="ghost-button action-btn" type="button" @click="app.openSettings" title="全局设置">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </header>

      <div v-if="app.environmentNotice.value" class="environment-banner">
        {{ app.environmentNotice.value }}
      </div>
      <div v-if="app.lastError.value" class="error-banner">
        {{ app.lastError.value }}
      </div>

      <section v-if="app.messages.value.length" ref="messageListRef" class="message-list">
        <MessageBubble
          v-for="message in app.messages.value"
          :key="message.id"
          :message="message"
        />
      </section>

      <section v-else class="empty-state">
        <div class="empty-content">
          <h2>向 DeepSeek 发起本地对话</h2>
          <p>
            会话记录自动展示在左栏。<br />
            关闭插件后 1 分钟内重新打开，将恢复当前对话。
          </p>
        </div>
      </section>

      <div class="composer-container">
        <ChatComposer
          v-model="app.draftMessage.value"
          :disabled="app.isSending.value"
          @send="app.sendMessage"
        >
          <template #actions>
            <select class="model-select action-select" v-model="app.settings.value.model" @change="app.saveSettings" title="切换模型">
              <option v-for="opt in app.modelOptions" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </template>
        </ChatComposer>
      </div>
    </main>

    <SettingsPanel
      :is-browser-mode="app.isBrowserMode.value"
      :open="app.isSettingsOpen.value"
      :saving="app.isSavingSettings.value"
      :settings="app.settings.value"
      @close="app.closeSettings"
      @save="app.saveSettings"
      @update-field="app.updateSettingsField"
    />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
}

.chat-stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100vh;
  position: relative;
}

.chat-header {
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 10;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.chat-title {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-muted);
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 50%;
}

.action-btn {
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-select {
  font-size: 0.75rem;
  color: var(--text-muted);
  background: var(--bg-hover);
  padding: 3px 6px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}

.action-select:hover {
  background: var(--bg-active);
  color: var(--text);
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.empty-content {
  text-align: center;
  max-width: 400px;
}

.empty-content h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 12px;
}

.empty-content p {
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--text-muted);
  margin: 0;
}

.composer-container {
  flex-shrink: 0;
  padding: 0 16px 24px;
  background: linear-gradient(0deg, var(--bg) 60%, rgba(255, 255, 255, 0));
}
</style>
