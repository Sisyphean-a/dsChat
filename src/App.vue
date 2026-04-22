<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import ChatComposer from './components/ChatComposer.vue'
import MessageBubble from './components/MessageBubble.vue'
import ModelPicker from './components/ModelPicker.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import SidebarPanel from './components/SidebarPanel.vue'
import { useChatApp } from './composables/useChatApp'
import { getModelConfigOptions } from './composables/chatAppSettings'

const app = useChatApp()
const configOptions = computed(() => getModelConfigOptions(app.settings.value))
const messageListRef = ref<HTMLElement | null>(null)
const releasedScrollMessageId = ref<string | null>(null)

const currentTitle = computed(() => {
  if (!app.activeConversationId.value) return '新对话'
  const target = app.conversations.value.find(c => c.id === app.activeConversationId.value)
  return target?.title || '新对话'
})

const currentStreamingMessageId = computed(() => {
  for (let index = app.messages.value.length - 1; index >= 0; index -= 1) {
    const message = app.messages.value[index]
    if (message?.status === 'streaming') {
      return message.id
    }
  }

  return null
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

function isNearBottom(element: HTMLElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 48
}

function handleMessageListScroll(): void {
  if (!messageListRef.value || !currentStreamingMessageId.value) {
    return
  }

  releasedScrollMessageId.value = isNearBottom(messageListRef.value)
    ? null
    : currentStreamingMessageId.value
}

async function scrollToBottom(force = false): Promise<void> {
  await nextTick()
  if (!messageListRef.value) return
  if (!force && releasedScrollMessageId.value === currentStreamingMessageId.value) return
  messageListRef.value.scrollTop = messageListRef.value.scrollHeight
}

function handleModelSelect(model: string): void {
  app.selectActiveModel(model)
  void app.saveSettings()
}

function handleProviderSelect(configId: string): void {
  app.selectActiveConfig(configId)
  void app.saveSettings()
}

onMounted(() => {
  void app.initialize()
})

watch(currentStreamingMessageId, (next, prev) => {
  if (next && next !== prev) {
    releasedScrollMessageId.value = null
  }
})

watch(() => app.activeConversationId.value, () => {
  releasedScrollMessageId.value = null
  void scrollToBottom(true)
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

      <section
        v-if="app.messages.value.length"
        ref="messageListRef"
        class="message-list"
        @scroll.passive="handleMessageListScroll"
      >
        <MessageBubble
          v-for="message in app.messages.value"
          :key="message.id"
          :message="message"
        />
      </section>

      <section v-else class="empty-state">
        <div class="empty-content">
          <h2>向 {{ app.activeChatConfig.value.label }} 发起对话</h2>
          <p>
            当前默认模型：{{ app.activeChatConfig.value.label }}。<br />
            关闭插件后 1 分钟内重新打开，将恢复当前对话。
          </p>
          <div class="quick-prompts">
            <button class="prompt-btn" @click="app.draftMessage.value = '写一段 Python 快速排序代码'; app.sendMessage()">
              写一段 Python 快速排序代码
            </button>
            <button class="prompt-btn" @click="app.draftMessage.value = '帮我翻译这段英文到中文：\n\n'">
              翻译英文
            </button>
            <button class="prompt-btn" @click="app.draftMessage.value = '请解释什么是大语言模型（LLM）？'; app.sendMessage()">
              解释大语言模型
            </button>
          </div>
        </div>
      </section>

      <div class="composer-container">
        <ChatComposer
          v-model="app.draftMessage.value"
          :disabled="app.isSending.value"
          :is-sending="app.isSending.value"
          @send="app.sendMessage"
          @stop="app.stopGenerating"
        >
          <template #actions>
            <ModelPicker
              :disabled="app.isSending.value"
              :model-value="app.settings.value.activeConfigId"
              :options="configOptions"
              @select="handleProviderSelect"
            />
            <ModelPicker
              :disabled="app.isSending.value"
              :model-value="app.activeChatConfig.value.model"
              :options="app.modelOptions.value"
              @select="handleModelSelect"
            />
          </template>
        </ChatComposer>
      </div>
    </main>

    <SettingsPanel
      :is-browser-mode="app.isBrowserMode.value"
      :open="app.isSettingsOpen.value"
      :saving="app.isSavingSettings.value"
      :settings="app.settings.value"
      @add-custom-model="app.addCustomModel"
      @close="app.closeSettings"
      @remove-custom-model="app.removeCustomModel"
      @save="app.saveSettings"
      @select-active-config="app.selectActiveConfig"
      @update-custom-model-field="app.updateCustomModelField"
      @update-deepseek-field="app.updateDeepseekField"
      @update-theme="app.updateTheme"
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
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 10;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
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

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  scroll-behavior: smooth;
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
  margin: 0 0 24px;
}

.quick-prompts {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}

.prompt-btn {
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.85rem;
  background: transparent;
  transition: all 180ms ease;
  cursor: pointer;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prompt-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}

.composer-container {
  flex-shrink: 0;
  padding: 0 14px 12px;
  background: linear-gradient(0deg, var(--bg) 60%, transparent);
}
</style>
