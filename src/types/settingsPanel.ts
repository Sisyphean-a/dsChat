import type { CustomToolSettings, ProviderSettings } from './chat'

export type ProviderEditableField = Exclude<keyof ProviderSettings, 'modelOptions'>
export type CustomModelField = ProviderEditableField | 'name'
export type CustomToolEditableField = Exclude<keyof CustomToolSettings, 'id'>
export type SettingsSectionId = 'general' | 'providers' | 'tools'
