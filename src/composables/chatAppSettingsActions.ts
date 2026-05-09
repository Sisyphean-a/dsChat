import type { Ref } from 'vue'
import type {
  AddableProviderId,
  FontSizeMode,
  ProviderSettings,
  ProviderThinkingSettings,
  SettingsForm,
  ThemeMode,
  UtoolsUploadMode,
} from '../types/chat'
import { createAddedModelDraft } from '../constants/providers'
import { getErrorMessage } from './chatAppErrors'
import { appendModelOption, replaceModelOption } from './chatAppModelOptions'
import { normalizeSettings } from './chatAppSettings'

type ProviderEditableField = Exclude<keyof ProviderSettings, 'modelOptions'>
type CustomModelField = ProviderEditableField | 'name'

interface ChatAppSettingsActionsOptions {
  settings: Ref<SettingsForm>
  isSavingSettings: Ref<boolean>
  isSettingsOpen: Ref<boolean>
  lastError: Ref<string | null>
  applyAppearance: (appearance: { fontSize: FontSizeMode; theme: ThemeMode }) => void
  saveSettings: (settings: SettingsForm) => Promise<void>
}

export interface ChatAppSettingsActions {
  addCustomModel: (provider: AddableProviderId) => void
  addCustomModelOption: (id: string, option: string) => void
  closeSettings: () => void
  openSettings: () => void
  renameCustomModelOption: (id: string, fromOption: string, toOption: string) => void
  removeCustomModel: (id: string) => void
  removeCustomModelOption: (id: string, option: string) => void
  saveSettingsAction: () => Promise<void>
  selectActiveConfig: (configId: string) => void
  selectActiveModel: (model: string) => void
  toggleSidebar: () => void
  updateCustomModelField: (id: string, field: CustomModelField, value: string | number) => void
  updateDeepseekField: (
    field: ProviderEditableField,
    value: ProviderSettings[ProviderEditableField],
  ) => void
  updateFontSize: (fontSize: FontSizeMode) => void
  updateProviderThinking: (
    provider: keyof ProviderThinkingSettings,
    enabled: boolean,
  ) => void
  updateTheme: (theme: ThemeMode) => void
  updateToolEnabled: (enabled: boolean) => void
  updateToolTavilyApiKey: (apiKey: string) => void
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
    applyAppearance,
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
    field: ProviderEditableField,
    value: ProviderSettings[ProviderEditableField],
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
    const value = model.trim()
    if (settings.value.activeConfigId === 'deepseek') {
      updateDeepseekField('model', value)
      return
    }

    settings.value = {
      ...settings.value,
      customModels: settings.value.customModels.map((item) => {
        if (item.id !== settings.value.activeConfigId) {
          return item
        }

        return {
          ...item,
          model: value,
          modelOptions: appendModelOption(item.modelOptions, value),
        }
      }),
    }
  }

  function addCustomModel(provider: AddableProviderId): void {
    const nextModel = createAddedModelDraft(provider, settings.value.customModels)
    settings.value = {
      ...settings.value,
      customModels: [...settings.value.customModels, nextModel],
    }
  }

  function addCustomModelOption(id: string, option: string): void {
    const value = option.trim()
    if (!value) {
      return
    }

    settings.value = {
      ...settings.value,
      customModels: settings.value.customModels.map((item) => {
        if (item.id !== id) {
          return item
        }

        return {
          ...item,
          model: item.model.trim() || value,
          modelOptions: appendModelOption(item.modelOptions, value),
        }
      }),
    }
  }

  function removeCustomModelOption(id: string, option: string): void {
    const value = option.trim()
    if (!value) {
      return
    }

    settings.value = {
      ...settings.value,
      customModels: settings.value.customModels.map((item) => {
        if (item.id !== id) {
          return item
        }

        const nextOptions = item.modelOptions.filter((candidate) => candidate !== value)
        return {
          ...item,
          model: item.model === value ? (nextOptions[0] ?? '') : item.model,
          modelOptions: nextOptions,
        }
      }),
    }
  }

  function renameCustomModelOption(id: string, fromOption: string, toOption: string): void {
    const from = fromOption.trim()
    const to = toOption.trim()
    if (!from || !to || from === to) {
      return
    }

    settings.value = {
      ...settings.value,
      customModels: settings.value.customModels.map((item) => {
        if (item.id !== id) {
          return item
        }

        return {
          ...item,
          model: item.model === from ? to : item.model,
          modelOptions: replaceModelOption(item.modelOptions, from, to),
        }
      }),
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
    const normalized = normalizeSettings(nextSettings)
    applyAppearance({
      fontSize: normalized.fontSize,
      theme: normalized.theme,
    })
  }

  function updateFontSize(fontSize: FontSizeMode): void {
    const nextSettings = {
      ...settings.value,
      fontSize,
    }
    settings.value = nextSettings
    const normalized = normalizeSettings(nextSettings)
    applyAppearance({
      fontSize: normalized.fontSize,
      theme: normalized.theme,
    })
  }

  function updateProviderThinking(
    provider: keyof ProviderThinkingSettings,
    enabled: boolean,
  ): void {
    settings.value = {
      ...settings.value,
      providerThinking: {
        ...settings.value.providerThinking,
        [provider]: enabled,
      },
    }
  }

  function updateUtoolsUploadMode(mode: UtoolsUploadMode): void {
    settings.value = {
      ...settings.value,
      utoolsUploadMode: mode,
    }
  }

  function updateToolEnabled(enabled: boolean): void {
    settings.value = {
      ...settings.value,
      toolSettings: {
        ...settings.value.toolSettings,
        enabled,
      },
    }
  }

  function updateToolTavilyApiKey(apiKey: string): void {
    settings.value = {
      ...settings.value,
      toolSettings: {
        ...settings.value.toolSettings,
        tavilyApiKey: apiKey,
      },
    }
  }

  async function saveSettingsAction(): Promise<void> {
    isSavingSettings.value = true

    try {
      const normalizedSettings = normalizeSettings(settings.value)
      settings.value = normalizedSettings
      applyAppearance({
        fontSize: normalizedSettings.fontSize,
        theme: normalizedSettings.theme,
      })
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
    addCustomModelOption,
    closeSettings,
    openSettings,
    renameCustomModelOption,
    removeCustomModel,
    removeCustomModelOption,
    saveSettingsAction,
    selectActiveConfig,
    selectActiveModel,
    toggleSidebar,
    updateCustomModelField,
    updateDeepseekField,
    updateFontSize,
    updateProviderThinking,
    updateTheme,
    updateToolEnabled,
    updateToolTavilyApiKey,
    updateUtoolsUploadMode,
  }
}
