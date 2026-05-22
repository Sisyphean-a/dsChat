import { mount } from '@vue/test-utils'
import { computed, defineComponent, h, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pluginEnterCallbacks: Array<() => void> = []
const initialize = vi.fn().mockResolvedValue(undefined)

vi.mock('./composables/chatAppSettings', () => ({
  canActiveConversationSearchWeb: vi.fn(() => false),
  getModelConfigOptions: vi.fn(() => []),
}))

vi.mock('./composables/useMessageListAutoScroll', () => ({
  useMessageListAutoScroll: vi.fn(() => ({
    handleMessageListScroll: vi.fn(),
    handleMessageListWheel: vi.fn(),
    messageListRef: ref(null),
    scrollToBottom: vi.fn(),
    showScrollToBottomButton: ref(false),
  })),
}))

vi.mock('./composables/useChatApp', () => ({
  useChatApp: vi.fn(() => ({
    activeChatConfig: computed(() => ({ label: 'DeepSeek', model: 'deepseek-v4-flash' })),
    activeConversationId: ref<string | null>(null),
    addCustomModel: vi.fn(),
    addCustomModelOption: vi.fn(),
    addCustomTool: vi.fn(),
    addPendingImages: vi.fn(),
    canSendMessage: computed(() => false),
    closeSettings: vi.fn(),
    conversations: ref([]),
    deleteConversation: vi.fn(),
    draftMessage: ref(''),
    environmentNotice: ref<string | null>(null),
    initialize,
    isBrowserMode: computed(() => false),
    isSavingSettings: ref(false),
    isSending: ref(false),
    isProviderSwitchLocked: computed(() => false),
    isSettingsOpen: ref(false),
    isSidebarCollapsed: ref(true),
    lastError: ref<string | null>(null),
    messages: ref([]),
    modelOptions: computed(() => []),
    openSettings: vi.fn(),
    pendingAttachments: ref([]),
    removeCustomModel: vi.fn(),
    removeCustomModelOption: vi.fn(),
    removeCustomTool: vi.fn(),
    removePendingAttachment: vi.fn(),
    renameCustomModelOption: vi.fn(),
    retryLastAssistantMessage: vi.fn(),
    retryableAssistantMessageId: computed(() => null),
    saveSettings: vi.fn(),
    selectActiveConfig: vi.fn(),
    selectActiveModel: vi.fn(),
    selectConversation: vi.fn(),
    sendMessage: vi.fn(),
    settings: ref({
      activeConfigId: 'deepseek',
      customModels: [],
      deepseek: {
        apiKey: '',
        baseUrl: 'https://api.deepseek.com/',
        capabilities: {
          imageInput: false,
          nativeWebSearch: false,
          protocol: 'chat_completions',
          reasoning: true,
          toolCalling: true,
        },
        model: 'deepseek-v4-flash',
        modelOptions: ['deepseek-v4-flash'],
        temperature: 1,
      },
      fontSize: 'medium',
      providerThinking: {
        deepseek: true,
        kimi: true,
        minimax: true,
      },
      theme: 'light',
      toolSettings: {
        builtinTools: {
          currentTime: {
            enabled: true,
          },
          tavilySearch: {
            apiKey: '',
            baseUrl: '',
            enabled: false,
          },
        },
        customTools: [],
        enabled: false,
      },
      utoolsUploadMode: 'local-only',
    }),
    showThinkingToggle: computed(() => false),
    stopGenerating: vi.fn(),
    thinkingEnabled: computed(() => true),
    toggleSidebar: vi.fn(),
    updateActiveThinkingEnabled: vi.fn(),
    updateBuiltinToolEnabled: vi.fn(),
    updateBuiltinToolTavilyApiKey: vi.fn(),
    updateBuiltinToolTavilyBaseUrl: vi.fn(),
    updateCustomModelCapability: vi.fn(),
    updateCustomModelField: vi.fn(),
    updateCustomToolField: vi.fn(),
    updateDeepseekCapability: vi.fn(),
    updateDeepseekField: vi.fn(),
    updateFontSize: vi.fn(),
    updateTheme: vi.fn(),
    updateToolEnabled: vi.fn(),
    updateUtoolsUploadMode: vi.fn(),
    startFreshConversation: vi.fn(),
  })),
}))

vi.mock('./components/ChatComposer.vue', () => ({
  default: defineComponent({
    props: {
      focusSignal: {
        required: false,
        type: Number,
      },
    },
    setup(props) {
      return () => h('div', {
        class: 'chat-composer-stub',
        'data-focus-signal': String(props.focusSignal ?? 0),
      })
    },
  }),
}))

vi.mock('./components/MessageBubble.vue', () => ({
  default: defineComponent({
    setup() {
      return () => h('div')
    },
  }),
}))

vi.mock('./components/ModelPicker.vue', () => ({
  default: defineComponent({
    setup() {
      return () => h('div')
    },
  }),
}))

vi.mock('./components/SettingsPanel.vue', () => ({
  default: defineComponent({
    setup() {
      return () => h('div')
    },
  }),
}))

vi.mock('./components/SidebarPanel.vue', () => ({
  default: defineComponent({
    setup() {
      return () => h('div')
    },
  }),
}))

import App from './App.vue'

describe('App', () => {
  beforeEach(() => {
    initialize.mockClear()
    pluginEnterCallbacks.length = 0
    Object.defineProperty(window, 'utools', {
      configurable: true,
      value: {
        onPluginEnter: vi.fn((callback: () => void) => {
          pluginEnterCallbacks.push(callback)
        }),
      },
    })
  })

  afterEach(() => {
    delete window.utools
  })

  it('requests composer focus on mount and every plugin re-entry', async () => {
    const wrapper = mount(App)
    await vi.waitFor(() => {
      expect(initialize).toHaveBeenCalledTimes(1)
    })

    expect(wrapper.get('.chat-composer-stub').attributes('data-focus-signal')).toBe('1')

    pluginEnterCallbacks[0]?.()
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.chat-composer-stub').attributes('data-focus-signal')).toBe('2')
  })
})
