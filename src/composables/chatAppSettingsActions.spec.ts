import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { buildDefaultSettings, createAddedModelDraft } from '../constants/providers'
import { createChatAppSettingsActions } from './chatAppSettingsActions'

describe('chatAppSettingsActions', () => {
  it('updates the system prompt before settings are saved', () => {
    const settings = ref(buildDefaultSettings())
    const actions = createChatAppSettingsActions({
      applyAppearance: vi.fn(),
      isSavingSettings: ref(false),
      isSettingsOpen: ref(false),
      isSidebarCollapsed: ref(false),
      lastError: ref<string | null>(null),
      saveSettings: vi.fn(),
      settings,
      settingsSaveError: ref<string | null>(null),
    })

    actions.updateSystemPrompt('言简意赅，避免大段回复')

    expect(settings.value.systemPrompt).toBe('言简意赅，避免大段回复')
  })

  it('updates the active configuration reasoning level without changing other configurations', () => {
    const currentSettings = buildDefaultSettings()
    const openai = createAddedModelDraft('openai', [])
    currentSettings.activeConfigId = openai.id
    currentSettings.customModels = [openai]
    const settings = ref(currentSettings)
    const actions = createChatAppSettingsActions({
      applyAppearance: vi.fn(),
      isSavingSettings: ref(false),
      isSettingsOpen: ref(false),
      isSidebarCollapsed: ref(false),
      lastError: ref<string | null>(null),
      saveSettings: vi.fn(),
      settings,
      settingsSaveError: ref<string | null>(null),
    })

    actions.updateActiveThinkingLevel('max')

    expect(settings.value.customModels[0]?.reasoningLevel).toBe('max')
    expect(settings.value.deepseek.reasoningLevel).toBe('high')
  })

  it('keeps settings open and exposes a save error when persistence fails', async () => {
    const isSavingSettings = ref(false)
    const isSettingsOpen = ref(false)
    const lastError = ref<string | null>(null)
    const settingsSaveError = ref<string | null>(null)
    const actions = createChatAppSettingsActions({
      applyAppearance: vi.fn(),
      isSavingSettings,
      isSettingsOpen,
      isSidebarCollapsed: ref(false),
      lastError,
      saveSettings: vi.fn(async () => {
        throw new Error('存储空间不足')
      }),
      settings: ref(buildDefaultSettings()),
      settingsSaveError,
    })

    actions.openSettings()
    await actions.saveSettingsAction()

    expect(isSettingsOpen.value).toBe(true)
    expect(isSavingSettings.value).toBe(false)
    expect(lastError.value).toBe('存储空间不足')
    expect(settingsSaveError.value).toBe('存储空间不足')
  })
})
