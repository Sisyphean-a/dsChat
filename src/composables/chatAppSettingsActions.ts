import type { Ref } from 'vue'
import type {
  AddableProviderId,
  FontSizeMode,
  ProviderSettings,
  SettingsForm,
  ThinkingLevel,
  ThemeMode,
  UtoolsUploadMode,
} from '../types/chat'
import type { SettingsEdit } from '../types/settingsPanel'
import { createAddedModelDraft } from '../constants/providers'
import { getErrorMessage } from './chatAppErrors'
import { appendModelOption, replaceModelOption } from './chatAppModelOptions'
import { normalizeSettings } from './chatAppSettings'

type ProviderEditableField = Exclude<keyof ProviderSettings, 'modelOptions'>
type ProviderCapabilityField = keyof ProviderSettings['capabilities']
type CustomModelField = ProviderEditableField | 'name'
type BuiltinToolField = keyof SettingsForm['toolSettings']['builtinTools']

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
  applySettingsEdit: (edit: SettingsEdit) => void
  closeSettings: () => void
  openSettings: () => void
  saveSettingsAction: () => Promise<void>
  selectActiveConfig: (configId: string) => void
  selectActiveModel: (model: string) => void
  toggleSidebar: () => void
  updateActiveThinkingLevel: (level: ThinkingLevel) => void
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

  function applySettingsEdit(edit: SettingsEdit): void {
    switch (edit.domain) {
      case 'general':
        if (edit.field === 'fontSize') updateFontSize(edit.value)
        if (edit.field === 'theme') updateTheme(edit.value)
        if (edit.field === 'utoolsUploadMode') updateUtoolsUploadMode(edit.value)
        return
      case 'conversation':
        if (edit.field === 'systemPrompt') updateSystemPrompt(edit.value)
        if (edit.field === 'utoolsSessionIdleTimeoutMinutes') updateUtoolsSessionIdleTimeoutMinutes(edit.value)
        return
      case 'provider':
        if (edit.action === 'addModel') addCustomModel(edit.provider)
        if (edit.action === 'removeModel') removeCustomModel(edit.id)
        if (edit.action === 'addModelOption') addCustomModelOption(edit.id, edit.option)
        if (edit.action === 'removeModelOption') removeCustomModelOption(edit.id, edit.option)
        if (edit.action === 'renameModelOption') renameCustomModelOption(edit.id, edit.from, edit.to)
        if (edit.action === 'updateDeepseekField') updateDeepseekField(edit.field, edit.value)
        if (edit.action === 'updateDeepseekCapability') updateDeepseekCapability(edit.field, edit.value)
        if (edit.action === 'updateCustomModelField') updateCustomModelField(edit.id, edit.field, edit.value)
        if (edit.action === 'updateCustomModelCapability') updateCustomModelCapability(edit.id, edit.field, edit.value)
        return
      case 'tools':
        if (edit.action === 'toggle') updateToolEnabled(edit.enabled)
        if (edit.action === 'toggleBuiltin') updateBuiltinToolEnabled(edit.tool, edit.enabled)
        if (edit.action === 'updateTavilyApiKey') updateBuiltinToolTavilyApiKey(edit.value)
        if (edit.action === 'updateTavilyBaseUrl') updateBuiltinToolTavilyBaseUrl(edit.value)
        if (edit.action === 'updateQwenImageApiKey') updateBuiltinToolQwenImageApiKey(edit.value)
        if (edit.action === 'updateQwenImageBaseUrl') updateBuiltinToolQwenImageBaseUrl(edit.value)
        if (edit.action === 'updateQwenImageModel') updateBuiltinToolQwenImageModel(edit.value)
        return
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
    applySettingsEdit,
    closeSettings,
    openSettings,
    saveSettingsAction,
    selectActiveConfig,
    selectActiveModel,
    toggleSidebar,
    updateActiveThinkingLevel,
  }
}
