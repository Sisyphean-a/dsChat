import type { Ref } from 'vue'
import type {
  AddableProviderId,
  CustomToolSettings,
  FontSizeMode,
  ProviderSettings,
  SettingsForm,
  ThinkingLevel,
  ThemeMode,
  UtoolsUploadMode,
} from '../types/chat'
import { createAddedModelDraft } from '../constants/providers'
import { getErrorMessage } from './chatAppErrors'
import { appendModelOption, replaceModelOption } from './chatAppModelOptions'
import { normalizeSettings } from './chatAppSettings'

type ProviderEditableField = Exclude<keyof ProviderSettings, 'modelOptions'>
type ProviderCapabilityField = keyof ProviderSettings['capabilities']
type CustomModelField = ProviderEditableField | 'name'
type BuiltinToolField = keyof SettingsForm['toolSettings']['builtinTools']
type CustomToolField = Exclude<keyof CustomToolSettings, 'id'>

interface ChatAppSettingsActionsOptions {
  settings: Ref<SettingsForm>
  isSavingSettings: Ref<boolean>
  isSettingsOpen: Ref<boolean>
  lastError: Ref<string | null>
  settingsSaveError: Ref<string | null>
  applyAppearance: (appearance: { fontSize: FontSizeMode; theme: ThemeMode }) => void
  saveSettings: (settings: SettingsForm) => Promise<void>
}

export interface ChatAppSettingsActions {
  addCustomModel: (provider: AddableProviderId) => void
  addCustomModelOption: (id: string, option: string) => void
  addCustomTool: () => void
  closeSettings: () => void
  openSettings: () => void
  renameCustomModelOption: (id: string, fromOption: string, toOption: string) => void
  removeCustomModel: (id: string) => void
  removeCustomModelOption: (id: string, option: string) => void
  removeCustomTool: (id: string) => void
  saveSettingsAction: () => Promise<void>
  selectActiveConfig: (configId: string) => void
  selectActiveModel: (model: string) => void
  toggleSidebar: () => void
  updateBuiltinToolEnabled: (tool: BuiltinToolField, enabled: boolean) => void
  updateBuiltinToolTavilyApiKey: (apiKey: string) => void
  updateBuiltinToolTavilyBaseUrl: (baseUrl: string) => void
  updateBuiltinToolQwenImageApiKey: (apiKey: string) => void
  updateBuiltinToolQwenImageBaseUrl: (baseUrl: string) => void
  updateBuiltinToolQwenImageModel: (model: string) => void
  updateCustomToolField: (id: string, field: CustomToolField, value: CustomToolSettings[CustomToolField]) => void
  updateCustomModelField: (id: string, field: CustomModelField, value: string | number) => void
  updateCustomModelCapability: (
    id: string,
    field: ProviderCapabilityField,
    value: ProviderSettings['capabilities'][ProviderCapabilityField],
  ) => void
  updateDeepseekCapability: (
    field: ProviderCapabilityField,
    value: ProviderSettings['capabilities'][ProviderCapabilityField],
  ) => void
  updateDeepseekField: (
    field: ProviderEditableField,
    value: ProviderSettings[ProviderEditableField],
  ) => void
  updateFontSize: (fontSize: FontSizeMode) => void
  updateActiveThinkingLevel: (level: ThinkingLevel) => void
  updateSystemPrompt: (systemPrompt: string) => void
  updateTheme: (theme: ThemeMode) => void
  updateToolEnabled: (enabled: boolean) => void
  updateUtoolsSessionIdleTimeoutMinutes: (minutes: number) => void
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
    settingsSaveError,
    applyAppearance,
    saveSettings,
  } = options

  function openSettings(): void {
    settingsSaveError.value = null
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

  function updateDeepseekCapability(
    field: ProviderCapabilityField,
    value: ProviderSettings['capabilities'][ProviderCapabilityField],
  ): void {
    settings.value = {
      ...settings.value,
      deepseek: {
        ...settings.value.deepseek,
        capabilities: {
          ...settings.value.deepseek.capabilities,
          [field]: value,
        },
      },
    }
  }

  function updateCustomModelCapability(
    id: string,
    field: ProviderCapabilityField,
    value: ProviderSettings['capabilities'][ProviderCapabilityField],
  ): void {
    settings.value = {
      ...settings.value,
      customModels: settings.value.customModels.map((item) => {
        if (item.id !== id) {
          return item
        }

        return {
          ...item,
          capabilities: {
            ...item.capabilities,
            [field]: value,
          },
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

  function updateActiveThinkingLevel(level: ThinkingLevel): void {
    if (settings.value.activeConfigId === 'deepseek') {
      settings.value = {
        ...settings.value,
        deepseek: {
          ...settings.value.deepseek,
          reasoningLevel: level,
        },
      }
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
          reasoningLevel: level,
        }
      }),
    }
  }

  function updateSystemPrompt(systemPrompt: string): void {
    settings.value = {
      ...settings.value,
      systemPrompt,
    }
  }

  function updateUtoolsSessionIdleTimeoutMinutes(minutes: number): void {
    settings.value = {
      ...settings.value,
      utoolsSessionIdleTimeoutMinutes: minutes,
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

  function updateBuiltinToolEnabled(tool: BuiltinToolField, enabled: boolean): void {
    settings.value = {
      ...settings.value,
      toolSettings: {
        ...settings.value.toolSettings,
        builtinTools: {
          ...settings.value.toolSettings.builtinTools,
          [tool]: {
            ...settings.value.toolSettings.builtinTools[tool],
            enabled,
          },
        },
      },
    }
  }

  function updateBuiltinToolTavilyApiKey(apiKey: string): void {
    settings.value = {
      ...settings.value,
      toolSettings: {
        ...settings.value.toolSettings,
        builtinTools: {
          ...settings.value.toolSettings.builtinTools,
          tavilySearch: {
            ...settings.value.toolSettings.builtinTools.tavilySearch,
            apiKey,
          },
        },
      },
    }
  }

  function updateBuiltinToolTavilyBaseUrl(baseUrl: string): void {
    settings.value = {
      ...settings.value,
      toolSettings: {
        ...settings.value.toolSettings,
        builtinTools: {
          ...settings.value.toolSettings.builtinTools,
          tavilySearch: {
            ...settings.value.toolSettings.builtinTools.tavilySearch,
            baseUrl,
          },
        },
      },
    }
  }

  function updateBuiltinToolQwenImageApiKey(apiKey: string): void {
    settings.value = {
      ...settings.value,
      toolSettings: {
        ...settings.value.toolSettings,
        builtinTools: {
          ...settings.value.toolSettings.builtinTools,
          qwenImage: {
            ...settings.value.toolSettings.builtinTools.qwenImage,
            apiKey,
          },
        },
      },
    }
  }

  function updateBuiltinToolQwenImageBaseUrl(baseUrl: string): void {
    settings.value = {
      ...settings.value,
      toolSettings: {
        ...settings.value.toolSettings,
        builtinTools: {
          ...settings.value.toolSettings.builtinTools,
          qwenImage: {
            ...settings.value.toolSettings.builtinTools.qwenImage,
            baseUrl,
          },
        },
      },
    }
  }

  function updateBuiltinToolQwenImageModel(model: string): void {
    settings.value = {
      ...settings.value,
      toolSettings: {
        ...settings.value.toolSettings,
        builtinTools: {
          ...settings.value.toolSettings.builtinTools,
          qwenImage: {
            ...settings.value.toolSettings.builtinTools.qwenImage,
            model,
          },
        },
      },
    }
  }

  function addCustomTool(): void {
    const tool = createCustomToolDraft()
    settings.value = {
      ...settings.value,
      toolSettings: {
        ...settings.value.toolSettings,
        customTools: [...settings.value.toolSettings.customTools, tool],
      },
    }
  }

  function removeCustomTool(id: string): void {
    settings.value = {
      ...settings.value,
      toolSettings: {
        ...settings.value.toolSettings,
        customTools: settings.value.toolSettings.customTools.filter((item) => item.id !== id),
      },
    }
  }

  function updateCustomToolField(
    id: string,
    field: CustomToolField,
    value: CustomToolSettings[CustomToolField],
  ): void {
    settings.value = {
      ...settings.value,
      toolSettings: {
        ...settings.value.toolSettings,
        customTools: settings.value.toolSettings.customTools.map((item) => {
          if (item.id !== id) {
            return item
          }

          return {
            ...item,
            [field]: value,
          }
        }),
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
      settingsSaveError.value = null
    } catch (error) {
      const message = getErrorMessage(error, '设置保存失败。')
      lastError.value = message
      settingsSaveError.value = message
    } finally {
      isSavingSettings.value = false
    }
  }

  return {
    addCustomModel,
    addCustomModelOption,
    addCustomTool,
    closeSettings,
    openSettings,
    renameCustomModelOption,
    removeCustomModel,
    removeCustomModelOption,
    removeCustomTool,
    saveSettingsAction,
    selectActiveConfig,
    selectActiveModel,
    toggleSidebar,
    updateBuiltinToolEnabled,
    updateBuiltinToolTavilyApiKey,
    updateBuiltinToolTavilyBaseUrl,
    updateBuiltinToolQwenImageApiKey,
    updateBuiltinToolQwenImageBaseUrl,
    updateBuiltinToolQwenImageModel,
    updateCustomToolField,
    updateCustomModelField,
    updateCustomModelCapability,
    updateDeepseekCapability,
    updateDeepseekField,
    updateFontSize,
    updateActiveThinkingLevel,
    updateSystemPrompt,
    updateTheme,
    updateToolEnabled,
    updateUtoolsSessionIdleTimeoutMinutes,
    updateUtoolsUploadMode,
  }
}

function createCustomToolDraft(): CustomToolSettings {
  const suffix = Math.random().toString(36).slice(2, 8)
  return {
    id: `custom-tool-${Date.now().toString(36)}-${suffix}`,
    name: '未命名工具',
    description: '',
    enabled: false,
    url: '',
    method: 'POST',
    headers: [],
  }
}
