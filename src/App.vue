<script setup lang="ts">
import { computed, onMounted } from 'vue'
import ChatComposer from './components/ChatComposer.vue'
import MessageBubble from './components/MessageBubble.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import SidebarPanel from './components/SidebarPanel.vue'
import { useChatApp } from './composables/useChatApp'

const app = useChatApp()

const statusText = computed(() => {
  if (app.isSending.value) {
    return '正在接收回复'
  }

  if (app.lastError.value) {
    return '最近一次请求失败'
  }

  return app.isBrowserMode.value ? '浏览器预览模式' : 'uTools 就绪'
})

onMounted(() => {
  void app.initialize()
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">uTools Local AI</p>
        <h1>dsChat</h1>
      </div>
      <div class="topbar-meta">
        <span class="status-pill">{{ statusText }}</span>
        <button class="ghost-button" type="button" @click="app.openSettings">
          设置
        </button>
      </div>
    </header>

    <div class="workspace">
      <SidebarPanel
        :active-conversation-id="app.activeConversationId.value"
        :collapsed="app.isSidebarCollapsed.value"
        :conversations="app.conversations.value"
        @new-conversation="app.startFreshConversation"
        @open-settings="app.openSettings"
        @select-conversation="app.selectConversation"
        @toggle="app.toggleSidebar"
      />

      <main class="chat-stage">
        <div v-if="app.environmentNotice.value" class="environment-banner">
          {{ app.environmentNotice.value }}
        </div>

        <div v-if="app.lastError.value" class="error-banner">
          {{ app.lastError.value }}
        </div>

        <section v-if="app.messages.value.length" class="message-list">
          <MessageBubble
            v-for="message in app.messages.value"
            :key="message.id"
            :message="message"
          />
        </section>

        <section v-else class="empty-state">
          <p class="eyebrow">新对话</p>
          <h2>输入问题，立即向 DeepSeek 发起本地对话</h2>
          <p>
            会话记录展示在左侧历史栏中。关闭插件后 1 分钟内再次打开，将恢复当前对话；超时后自动开始新会话。
          </p>
        </section>

        <ChatComposer
          v-model="app.draftMessage.value"
          :disabled="app.isSending.value"
          :model-name="app.settings.value.model"
          @send="app.sendMessage"
        />
      </main>
    </div>

    <SettingsPanel
      :is-browser-mode="app.isBrowserMode.value"
      :model-options="app.modelOptions"
      :open="app.isSettingsOpen.value"
      :saving="app.isSavingSettings.value"
      :settings="app.settings.value"
      @close="app.closeSettings"
      @save="app.saveSettings"
      @update-field="app.updateSettingsField"
    />
  </div>
</template>
