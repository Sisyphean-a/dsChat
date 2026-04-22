import type { Ref } from 'vue'
import type {
  AddableProviderId,
  ProviderSettings,
  SettingsForm,
  ThemeMode,
  UtoolsUploadMode,
} from '../types/chat'
import { createAddedModelDraft } from '../constants/providers'
import { getErrorMessage } from './chatAppErrors'
import { normalizeSettings } from './chatAppSettings'

type CustomModelField = keyof ProviderSettings | 'name'

interface ChatAppSettingsActionsOptions {
  settings: Ref<SettingsForm>
  isSavingSettings: Ref<boolean>
  isSettingsOpen: Ref<boolean>
  lastError: Ref<string | null>
  applyTheme: (theme: ThemeMode) => void
  saveSettings: (settings: SettingsForm) => Promise<void>
}

export interface ChatAppSettingsActions {
  addCustomModel: (provider: AddableProviderId) => void
  closeSettings: () => void
  openSettings: () => void
  removeCustomModel: (id: string) => void
  saveSettingsAction: () => Promise<void>
  selectActiveConfig: (configId: string) => void
  selectActiveModel: (model: string) => void
  toggleSidebar: () => void
  updateCustomModelField: (id: string, field: CustomModelField, value: string | number) => void
  updateDeepseekField: (
    field: keyof ProviderSettings,
    value: ProviderSettings[keyof ProviderSettings],
  ) => void
  updateTheme: (theme: ThemeMode) => void
  updateUtoolsUploadMode: (mode: UtoolsUploadMode) => void
}

interface ChatAppUiState {
  isSettingsOpen: Ref<boolean>
  isSidebarCollapsed: Ref<boolean>
}

export function createChatAppSettingsActions(
  options: ChatAppSettingsActionsOptions & ChatAppUiState,
): ChatAppSettingsActions {
  const {
    settings,
    isSavingSettings,
    isSettingsOpen,
    isSidebarCollapsed,
    lastError,
    applyTheme,
    saveSettings,
  } = options

  function openSettings(): void {
    isSettingsOpen.value = true
  }

  function closeSettings(): void {
    isSettingsOpen.value = false
  }

  function toggleSidebar(): void {
    isSidebarCollapsed.value = !isSidebarCollapsed.value
  }

  function selectActiveConfig(configId: string): void {
    settings.value = {
      ...settings.value,
      activeConfigId: configId,
    }
  }

  function updateDeepseekField(
    field: keyof ProviderSettings,
    value: ProviderSettings[keyof ProviderSettings],
  ): void {
    settings.value = {
      ...settings.value,
      deepseek: {
        ...settings.value.deepseek,
        [field]: value,
      },
    }
  }

  function updateCustomModelField(
    id: string,
    field: CustomModelField,
    value: string | number,
  ): void {
    settings.value = {
      ...settings.value,
      customModels: settings.value.customModels.map((item) => {
        if (item.id !== id) {
          return item
        }

        return {
          ...item,
          [field]: value,
        }
      }),
    }
  }

  function selectActiveModel(model: string): void {
    if (settings.value.activeConfigId === 'deepseek') {
      updateDeepseekField('model', model)
      return
    }

    updateCustomModelField(settings.value.activeConfigId, 'model', model)
  }

  function addCustomModel(provider: AddableProviderId): void {
    const nextModel = createAddedModelDraft(provider, settings.value.customModels)
    settings.value = {
      ...settings.value,
      customModels: [...settings.value.customModels, nextModel],
    }
  }

  function removeCustomModel(id: string): void {
    const customModels = settings.value.customModels.filter((item) => item.id !== id)
    settings.value = {
      ...settings.value,
      activeConfigId: settings.value.activeConfigId === id ? 'deepseek' : settings.value.activeConfigId,
      customModels,
    }
  }

  function updateTheme(theme: ThemeMode): void {
    const nextSettings = {
      ...settings.value,
      theme,
    }
    settings.value = nextSettings
    applyTheme(normalizeSettings(nextSettings).theme)
  }

  function updateUtoolsUploadMode(mode: UtoolsUploadMode): void {
    settings.value = {
      ...settings.value,
      utoolsUploadMode: mode,
    }
  }

  async function saveSettingsAction(): Promise<void> {
    isSavingSettings.value = true

    try {
      const normalizedSettings = normalizeSettings(settings.value)
      settings.value = normalizedSettings
      applyTheme(normalizedSettings.theme)
      await saveSettings(normalizedSettings)
      isSettingsOpen.value = false
      lastError.value = null
    } catch (error) {
      lastError.value = getErrorMessage(error, '设置保存失败。')
    } finally {
      isSavingSettings.value = false
    }
  }

  return {
    addCustomModel,
    closeSettings,
    openSettings,
    removeCustomModel,
    saveSettingsAction,
    selectActiveConfig,
    selectActiveModel,
    toggleSidebar,
    updateCustomModelField,
    updateDeepseekField,
    updateTheme,
    updateUtoolsUploadMode,
  }
}
