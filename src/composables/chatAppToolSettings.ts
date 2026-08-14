import {
  providerSupportsNativeWebSearch,
  providerSupportsToolCalling as configSupportsToolCalling,
  supportsOpenAiNativeWebSearchModel,
} from '../constants/providerCapabilities'
import {
  DEFAULT_TAVILY_SEARCH_BASE_URL,
  DEFAULT_QWEN_IMAGE_BASE_URL,
  DEFAULT_QWEN_IMAGE_MODEL,
} from '../constants/tools'
import { getQwenImageEndpointError } from '../services/qwenEndpointValidation'
import type { ActiveProviderSettings, SettingsForm } from '../types/chat'

export function normalizeToolSettings(
  toolSettings: SettingsForm['toolSettings'] | undefined,
): SettingsForm['toolSettings'] {
  const legacy = toolSettings as Partial<{
    tavilyApiKey: string
    builtinTools?: {
      zaiImage?: {
        enabled?: boolean
      }
    }
  }>
  const builtinTools = normalizeBuiltinToolSettings(toolSettings, legacy.tavilyApiKey, legacy.builtinTools?.zaiImage?.enabled)
  return {
    enabled: toolSettings?.enabled ?? false,
    builtinTools,
    customTools: [],
  }
}

export function getToolSettingsError(
  activeSettings: ActiveProviderSettings,
  toolSettings: SettingsForm['toolSettings'],
): string | null {
  if (!toolSettings.enabled) {
    return null
  }

  if (hasEnabledCustomTool(toolSettings)) {
    return '自定义工具暂未接入执行引擎，请先关闭已启用的自定义工具。'
  }

  if (!hasEnabledBuiltinTool(toolSettings)) {
    return '请至少启用一个内置工具。'
  }

  const supportsLocalTools = configSupportsToolCalling(activeSettings)
  if (hasEnabledQwenImageTool(toolSettings) && !supportsLocalTools) {
    return `${activeSettings.label} 当前配置暂不支持本地图片工具，请切换支持 Chat Completions 工具调用的配置。`
  }

  if (!providerSupportsToolCalling(activeSettings)) {
    return `${activeSettings.label} 当前配置暂不支持工具调用。`
  }

  if (supportsLocalTools && hasEnabledQwenImageTool(toolSettings)) {
    if (!toolSettings.builtinTools.qwenImage?.apiKey.trim()) {
      return '请先填写阿里云 Qwen 图片工具 API Key。'
    }
    const qwenEndpointError = getQwenImageEndpointError(
      toolSettings.builtinTools.qwenImage.baseUrl,
    )
    if (qwenEndpointError) {
      return qwenEndpointError
    }
  }

  return null
}

export function canUseBuiltinQwenImageTool(
  activeSettings: ActiveProviderSettings,
  toolSettings: SettingsForm['toolSettings'],
): boolean {
  return toolSettings.enabled
    && configSupportsToolCalling(activeSettings)
    && hasEnabledQwenImageTool(toolSettings)
    && Boolean(toolSettings.builtinTools.qwenImage?.apiKey.trim())
}

export function canActiveSettingsSearchWeb(
  activeSettings: ActiveProviderSettings,
  toolSettings: SettingsForm['toolSettings'],
): boolean {
  if (canUseOpenAiNativeWebSearch(activeSettings)) {
    return true
  }

  return canUseBuiltinTavilySearch(activeSettings, toolSettings)
}

function normalizeBuiltinToolSettings(
  toolSettings: SettingsForm['toolSettings'] | undefined,
  legacyTavilyApiKey: string | undefined,
  legacyQwenImageEnabled: boolean | undefined,
): SettingsForm['toolSettings']['builtinTools'] {
  const builtinTavilyApiKey = toolSettings?.builtinTools?.tavilySearch?.apiKey?.trim() ?? ''
  const builtinTavilyBaseUrl = normalizeTavilySearchBaseUrl(toolSettings?.builtinTools?.tavilySearch?.baseUrl)
  const normalizedLegacyTavilyApiKey = legacyTavilyApiKey?.trim() ?? ''
  return {
    currentTime: {
      enabled: toolSettings?.builtinTools?.currentTime?.enabled ?? true,
    },
    tavilySearch: {
      enabled: toolSettings?.builtinTools?.tavilySearch?.enabled ?? true,
      apiKey: builtinTavilyApiKey || normalizedLegacyTavilyApiKey,
      baseUrl: builtinTavilyBaseUrl,
    },
    qwenImage: {
      enabled: toolSettings?.builtinTools?.qwenImage?.enabled ?? legacyQwenImageEnabled ?? false,
      apiKey: toolSettings?.builtinTools?.qwenImage?.apiKey?.trim() ?? '',
      baseUrl: normalizeQwenImageBaseUrl(toolSettings?.builtinTools?.qwenImage?.baseUrl),
      model: toolSettings?.builtinTools?.qwenImage?.model?.trim() || DEFAULT_QWEN_IMAGE_MODEL,
    },
  }
}

function providerSupportsToolCalling(
  activeSettings: ActiveProviderSettings,
): boolean {
  if (configSupportsToolCalling(activeSettings)) {
    return true
  }

  return providerSupportsNativeWebSearch(activeSettings)
}

function canUseOpenAiNativeWebSearch(
  activeSettings: ActiveProviderSettings,
): boolean {
  if (!providerSupportsNativeWebSearch(activeSettings)) {
    return false
  }

  if (!supportsOpenAiNativeWebSearchModel(activeSettings.model)) {
    return false
  }

  return true
}

function canUseBuiltinTavilySearch(
  activeSettings: ActiveProviderSettings,
  toolSettings: SettingsForm['toolSettings'],
): boolean {
  if (!toolSettings.enabled || !configSupportsToolCalling(activeSettings)) {
    return false
  }

  if (hasEnabledCustomTool(toolSettings)) {
    return false
  }

  return toolSettings.builtinTools.tavilySearch.enabled
    && Boolean(toolSettings.builtinTools.tavilySearch.apiKey.trim())
}

function normalizeTavilySearchBaseUrl(value: string | undefined): string {
  const normalized = value?.trim() ?? ''
  return normalized || DEFAULT_TAVILY_SEARCH_BASE_URL
}

function normalizeQwenImageBaseUrl(value: string | undefined): string {
  const normalized = value?.trim() ?? ''
  return normalized || DEFAULT_QWEN_IMAGE_BASE_URL
}

function hasEnabledBuiltinTool(toolSettings: SettingsForm['toolSettings']): boolean {
  const { currentTime, tavilySearch, qwenImage } = toolSettings.builtinTools
  return currentTime.enabled || tavilySearch.enabled || qwenImage.enabled
}

function hasEnabledQwenImageTool(toolSettings: SettingsForm['toolSettings']): boolean {
  return toolSettings.builtinTools.qwenImage?.enabled ?? false
}

function hasEnabledCustomTool(toolSettings: SettingsForm['toolSettings']): boolean {
  return toolSettings.customTools.some((item) => item.enabled)
}
