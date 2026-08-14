import type {
  AddableProviderId,
  CustomToolSettings,
  FontSizeMode,
  ProviderCapabilities,
  ProviderSettings,
  ThemeMode,
  UtoolsUploadMode,
} from './chat'

export type ProviderEditableField = Exclude<keyof ProviderSettings, 'modelOptions'>
export type ProviderCapabilityField = keyof ProviderSettings['capabilities']
export type CustomModelField = ProviderEditableField | 'name'
export type CustomToolEditableField = Exclude<keyof CustomToolSettings, 'id'>
export type SettingsSectionId = 'general' | 'conversation' | 'providers' | 'tools'

export type SettingsEdit =
  | { domain: 'general'; field: 'fontSize'; value: FontSizeMode }
  | { domain: 'general'; field: 'theme'; value: ThemeMode }
  | { domain: 'general'; field: 'utoolsUploadMode'; value: UtoolsUploadMode }
  | { domain: 'conversation'; field: 'systemPrompt'; value: string }
  | { domain: 'conversation'; field: 'utoolsSessionIdleTimeoutMinutes'; value: number }
  | { domain: 'provider'; action: 'addModel'; provider: AddableProviderId }
  | { domain: 'provider'; action: 'removeModel'; id: string }
  | { domain: 'provider'; action: 'addModelOption'; id: string; option: string }
  | { domain: 'provider'; action: 'removeModelOption'; id: string; option: string }
  | { domain: 'provider'; action: 'renameModelOption'; id: string; from: string; to: string }
  | { domain: 'provider'; action: 'updateDeepseekField'; field: ProviderEditableField; value: string | number }
  | { domain: 'provider'; action: 'updateDeepseekCapability'; field: ProviderCapabilityField; value: ProviderCapabilities[ProviderCapabilityField] }
  | { domain: 'provider'; action: 'updateCustomModelField'; id: string; field: CustomModelField; value: string | number }
  | { domain: 'provider'; action: 'updateCustomModelCapability'; id: string; field: ProviderCapabilityField; value: ProviderCapabilities[ProviderCapabilityField] }
  | { domain: 'tools'; action: 'toggle'; enabled: boolean }
  | { domain: 'tools'; action: 'toggleBuiltin'; tool: 'currentTime' | 'tavilySearch' | 'qwenImage'; enabled: boolean }
  | { domain: 'tools'; action: 'updateTavilyApiKey'; value: string }
  | { domain: 'tools'; action: 'updateTavilyBaseUrl'; value: string }
  | { domain: 'tools'; action: 'updateQwenImageApiKey'; value: string }
  | { domain: 'tools'; action: 'updateQwenImageBaseUrl'; value: string }
  | { domain: 'tools'; action: 'updateQwenImageModel'; value: string }
