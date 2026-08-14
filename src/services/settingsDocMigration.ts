import { DEFAULT_SETTINGS } from '../constants/app'
import {
  ADDABLE_PROVIDER_IDS,
  buildDefaultProviderSettings,
  createAddedModelDraft,
} from '../constants/providers'
import {
  isLegacyMultiProviderDocShape,
  normalizeUtoolsSessionIdleTimeoutMinutes,
  normalizeUtoolsUploadMode,
} from '../composables/chatAppSettings'
import { normalizeToolSettings } from '../composables/chatAppToolSettings'
import { normalizeThinkingLevel } from '../constants/thinking'
import type {
  AddableProviderId,
  FontSizeMode,
  ProviderSettings,
  SettingsDoc,
  SettingsForm,
  ThemeMode,
  UtoolsUploadMode,
} from '../types/chat'

type LegacyProviderThinkingSettings = Partial<Record<AddableProviderId | 'deepseek', boolean>>

export interface LegacySettingsDoc {
  _id: string
  _rev?: string
  type: 'settings'
  apiKey?: string
  baseUrl?: string
  model?: string
  temperature?: number
  fontSize?: FontSizeMode
  providerThinking?: LegacyProviderThinkingSettings
  theme?: ThemeMode
}

export type LegacyMultiProviderDoc = {
  _id: string
  _rev?: string
  activeProvider?: string
  fontSize?: FontSizeMode
  providers?: Record<string, Partial<ProviderSettings>>
  providerThinking?: LegacyProviderThinkingSettings
  theme?: ThemeMode
  type: 'settings'
}

export type PersistedSettingsDoc = SettingsDoc | LegacySettingsDoc | LegacyMultiProviderDoc

export function migrateSettingsDoc(
  doc: PersistedSettingsDoc,
  legacyUploadModeFallback: UtoolsUploadMode,
): SettingsForm {
  if (isSettingsDoc(doc)) {
    const legacyThinking = getLegacyProviderThinking(doc)
    return {
      activeConfigId: doc.activeConfigId,
      customModels: doc.customModels.map((item) => withMigratedThinkingLevel(item.provider, item, legacyThinking)),
      deepseek: withMigratedThinkingLevel('deepseek', doc.deepseek, legacyThinking),
      fontSize: doc.fontSize,
      systemPrompt: typeof doc.systemPrompt === 'string' ? doc.systemPrompt : '',
      theme: doc.theme,
      toolSettings: normalizeToolSettings(doc.toolSettings),
      utoolsSessionIdleTimeoutMinutes: normalizeUtoolsSessionIdleTimeoutMinutes(
        doc.utoolsSessionIdleTimeoutMinutes,
      ),
      utoolsUploadMode: normalizeUtoolsUploadMode(doc.utoolsUploadMode, legacyUploadModeFallback),
    }
  }

  if (isLegacyMultiProviderDocShape(doc)) {
    return migrateLegacyMultiProviderDoc(doc as LegacyMultiProviderDoc, legacyUploadModeFallback)
  }

  return {
    activeConfigId: 'deepseek',
    customModels: [],
    deepseek: withMigratedThinkingLevel('deepseek', {
      ...DEFAULT_SETTINGS.deepseek,
      apiKey: doc.apiKey ?? DEFAULT_SETTINGS.deepseek.apiKey,
      baseUrl: doc.baseUrl ?? DEFAULT_SETTINGS.deepseek.baseUrl,
      model: doc.model ?? DEFAULT_SETTINGS.deepseek.model,
      modelOptions: buildLegacyModelOptions(
        DEFAULT_SETTINGS.deepseek,
        { model: doc.model },
        { appendCurrentModel: false },
      ),
      temperature: typeof doc.temperature === 'number'
        ? doc.temperature
        : DEFAULT_SETTINGS.deepseek.temperature,
    }, doc.providerThinking, true),
    fontSize: doc.fontSize ?? DEFAULT_SETTINGS.fontSize,
    systemPrompt: '',
    theme: doc.theme ?? DEFAULT_SETTINGS.theme,
    toolSettings: { ...DEFAULT_SETTINGS.toolSettings },
    utoolsSessionIdleTimeoutMinutes: DEFAULT_SETTINGS.utoolsSessionIdleTimeoutMinutes,
    utoolsUploadMode: legacyUploadModeFallback,
  }
}

function migrateLegacyMultiProviderDoc(
  doc: LegacyMultiProviderDoc,
  legacyUploadModeFallback: UtoolsUploadMode,
): SettingsForm {
  const deepseekDefaults = buildDefaultProviderSettings('deepseek')
  const deepseek = {
    ...deepseekDefaults,
    ...(doc.providers?.deepseek ?? {}),
    modelOptions: buildLegacyModelOptions(
      deepseekDefaults,
      doc.providers?.deepseek,
      { appendCurrentModel: false },
    ),
  }
  const customModels = ADDABLE_PROVIDER_IDS
    .map((provider) => toLegacyCustomModel(provider, doc.providers?.[provider], doc.providerThinking))
    .filter((item) => item !== null)

  return {
    activeConfigId: resolveLegacyActiveConfigId(doc.activeProvider, customModels),
    customModels,
    deepseek: withMigratedThinkingLevel('deepseek', deepseek, doc.providerThinking, true),
    fontSize: doc.fontSize ?? DEFAULT_SETTINGS.fontSize,
    systemPrompt: '',
    theme: doc.theme ?? DEFAULT_SETTINGS.theme,
    toolSettings: { ...DEFAULT_SETTINGS.toolSettings },
    utoolsSessionIdleTimeoutMinutes: DEFAULT_SETTINGS.utoolsSessionIdleTimeoutMinutes,
    utoolsUploadMode: legacyUploadModeFallback,
  }
}

function resolveLegacyActiveConfigId(
  activeProvider: string | undefined,
  customModels: SettingsForm['customModels'],
): string {
  if (!activeProvider || activeProvider === 'deepseek') {
    return 'deepseek'
  }

  return customModels.find((item) => item.provider === activeProvider)?.id ?? 'deepseek'
}

function toLegacyCustomModel(
  provider: AddableProviderId,
  incomingSettings: Partial<ProviderSettings> | undefined,
  legacyThinking: LegacyProviderThinkingSettings | undefined,
): SettingsForm['customModels'][number] | null {
  if (!incomingSettings || !isMeaningfulProviderSettings(provider, incomingSettings)) {
    return null
  }

  const draft = createAddedModelDraft(provider, [])
  return withMigratedThinkingLevel(provider, {
    ...draft,
    apiKey: incomingSettings.apiKey ?? draft.apiKey,
    baseUrl: incomingSettings.baseUrl ?? draft.baseUrl,
    model: incomingSettings.model ?? draft.model,
    modelOptions: buildLegacyModelOptions(draft, incomingSettings),
    temperature: typeof incomingSettings.temperature === 'number'
      ? incomingSettings.temperature
      : draft.temperature,
  }, legacyThinking, true)
}

function buildLegacyModelOptions(
  defaults: ProviderSettings,
  incoming: Partial<ProviderSettings> | undefined,
  options?: { appendCurrentModel?: boolean },
): string[] {
  const source = Array.isArray(incoming?.modelOptions)
    ? incoming.modelOptions
    : defaults.modelOptions
  const normalized = [...new Set(source.map((item) => item.trim()).filter(Boolean))]
  const model = incoming?.model?.trim()
  if (!model || normalized.includes(model) || options?.appendCurrentModel === false) {
    return normalized
  }

  return [...normalized, model]
}

function isMeaningfulProviderSettings(
  provider: AddableProviderId,
  incomingSettings: Partial<ProviderSettings>,
): boolean {
  if (incomingSettings.apiKey?.trim()) {
    return true
  }

  const defaults = buildDefaultProviderSettings(provider)
  return Boolean(
    (incomingSettings.baseUrl?.trim() && incomingSettings.baseUrl.trim() !== defaults.baseUrl)
    || (incomingSettings.model?.trim() && incomingSettings.model.trim() !== defaults.model),
  )
}

function withMigratedThinkingLevel<T extends Partial<ProviderSettings>>(
  provider: AddableProviderId | 'deepseek',
  settings: T,
  legacyThinking: LegacyProviderThinkingSettings | undefined,
  preferLegacyThinking = false,
): T & Pick<ProviderSettings, 'reasoningLevel'> {
  const migratedCapabilities = provider === 'openai'
    && settings.reasoningLevel === undefined
    && settings.capabilities?.reasoning === false
    ? { ...settings.capabilities, reasoning: true }
    : undefined

  return {
    ...settings,
    ...(migratedCapabilities ? { capabilities: migratedCapabilities } : {}),
    reasoningLevel: normalizeThinkingLevel(
      provider,
      settings.model ?? '',
      (preferLegacyThinking ? undefined : settings.reasoningLevel)
        ?? (legacyThinking?.[provider] === false ? 'off' : undefined),
    ),
  }
}

function getLegacyProviderThinking(doc: SettingsDoc): LegacyProviderThinkingSettings | undefined {
  return (doc as SettingsDoc & { providerThinking?: LegacyProviderThinkingSettings }).providerThinking
}

function isSettingsDoc(doc: PersistedSettingsDoc): doc is SettingsDoc {
  const candidate = doc as Partial<SettingsDoc>
  return typeof candidate.activeConfigId === 'string'
    && Array.isArray(candidate.customModels)
    && typeof candidate.deepseek === 'object'
    && candidate.deepseek !== null
}
