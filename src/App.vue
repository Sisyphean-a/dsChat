<script setup lang="ts">
import { computed, onMounted } from 'vue'
import ChatComposer from './components/ChatComposer.vue'
import MessageBubble from './components/MessageBubble.vue'
import ModelPicker from './components/ModelPicker.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import SidebarPanel from './components/SidebarPanel.vue'
import { useMessageListAutoScroll } from './composables/useMessageListAutoScroll'
import { useChatApp } from './composables/useChatApp'
import { getModelConfigOptions } from './composables/chatAppSettings'

const app = useChatApp()
const configOptions = computed(() => getModelConfigOptions(app.settings.value))
const {
  handleMessageListScroll,
  handleMessageListWheel,
  messageListRef,
} = useMessageListAutoScroll({
  activeConversationId: app.activeConversationId,
  messages: app.messages,
})
void messageListRef

const currentTitle = computed(() => {
  if (!app.activeConversationId.value) return '新对话'
  const target = app.conversations.value.find(c => c.id === app.activeConversationId.value)
  return target?.title || '新对话'
})

function handleModelSelect(model: string): void {
  app.selectActiveModel(model)
  void app.saveSettings()
}

function handleProviderSelect(configId: string): void {
  app.selectActiveConfig(configId)
  void app.saveSettings()
}

function applyQuickPrompt(prompt: string, autoSend = false): void {
  app.draftMessage.value = prompt
  if (autoSend) {
    void app.sendMessage()
  }
}

onMounted(() => {
  void app.initialize()
})
</script>

<template>
  <div class="app-shell">
    <SidebarPanel
      :active-conversation-id="app.activeConversationId.value"
      :collapsed="app.isSidebarCollapsed.value"
      :conversations="app.conversations.value"
      :disabled="app.isSending.value"
      :delete-disabled="false"
      @delete-conversation="app.deleteConversation"
      @new-conversation="app.startFreshConversation"
      @open-settings="app.openSettings"
      @select-conversation="app.selectConversation"
      @toggle="app.toggleSidebar"
    />

    <main class="chat-stage">
      <header class="chat-header">
        <div class="header-actions">
          <button class="ghost-button action-btn" type="button" @click="app.toggleSidebar" title="历史会话">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
          </button>
          <button class="ghost-button action-btn" type="button" :disabled="app.isSending.value" @click="app.startFreshConversation" title="新对话">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
        
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
        @wheel.capture.passive="handleMessageListWheel"
      >
        <MessageBubble
          v-for="message in app.messages.value"
          :key="message.id"
          :can-retry="!app.isSending.value && app.retryableAssistantMessageId.value === message.id"
          :message="message"
          @retry="app.retryLastAssistantMessage"
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
            <button class="prompt-btn" @click="applyQuickPrompt('写一段 Python 快速排序代码', true)">
              写一段 Python 快速排序代码
            </button>
            <button class="prompt-btn" @click="applyQuickPrompt('帮我翻译这段英文到中文：\n\n')">
              翻译英文
            </button>
            <button class="prompt-btn" @click="applyQuickPrompt('请解释什么是大语言模型（LLM）？', true)">
              解释大语言模型
            </button>
          </div>
        </div>
      </section>

      <div class="composer-container">
        <ChatComposer
          v-model="app.draftMessage.value"
          :attachments="app.pendingAttachments.value"
          :can-send="app.canSendMessage.value"
          :is-sending="app.isSending.value"
          :show-thinking-toggle="app.showThinkingToggle.value"
          :thinking-enabled="app.thinkingEnabled.value"
          :send-disabled="app.isSending.value"
          @add-images="app.addPendingImages"
          @remove-attachment="app.removePendingAttachment"
          @update-thinking-enabled="app.updateActiveThinkingEnabled"
          @send="app.sendMessage"
          @stop="app.stopGenerating"
        >
          <template #actions>
            <div class="composer-pickers">
              <div class="composer-picker composer-picker-provider">
                <ModelPicker
                  :disabled="app.isSending.value"
                  :model-value="app.settings.value.activeConfigId"
                  :options="configOptions"
                  @select="handleProviderSelect"
                />
              </div>
              <div class="composer-picker composer-picker-model">
                <ModelPicker
                  :disabled="app.isSending.value"
                  :model-value="app.activeChatConfig.value.model"
                  :options="app.modelOptions.value"
                  @select="handleModelSelect"
                />
              </div>
            </div>
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
      @add-custom-model-option="app.addCustomModelOption"
      @close="app.closeSettings"
      @remove-custom-model="app.removeCustomModel"
      @remove-custom-model-option="app.removeCustomModelOption"
      @rename-custom-model-option="app.renameCustomModelOption"
      @save="app.saveSettings"
      @update-custom-model-field="app.updateCustomModelField"
      @update-deepseek-field="app.updateDeepseekField"
      @update-font-size="app.updateFontSize"
      @update-theme="app.updateTheme"
      @update-utools-upload-mode="app.updateUtoolsUploadMode"
    />
  </div>
</template>
<style scoped src="./styles/app-shell.css"></style>
