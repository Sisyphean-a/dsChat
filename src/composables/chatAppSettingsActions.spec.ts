import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { buildDefaultSettings } from '../constants/providers'
import { createChatAppSettingsActions } from './chatAppSettingsActions'

describe('chatAppSettingsActions', () => {
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
