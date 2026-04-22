import {
  CONVERSATION_PREFIX,
  DEFAULT_SETTINGS,
  SESSION_DOC_ID,
  SETTINGS_DOC_ID,
} from '../constants/app'
import { buildDefaultProviderSettings, createAddedModelDraft } from '../constants/providers'
import {
  isLegacyMultiProviderDocShape,
  normalizeSettings,
} from '../composables/chatAppSettings'
import type {
  AddableProviderId,
  BaseDoc,
  ConversationDoc,
  ProviderSettings,
  SessionDoc,
  SettingsDoc,
  SettingsForm,
  ThemeMode,
} from '../types/chat'
import type { DbResult, UtoolsApi } from '../types/utools'
import { sortConversations } from '../utils/chat'

const memoryStore = new Map<string, BaseDoc>()

interface LegacySettingsDoc extends BaseDoc {
  type: 'settings'
  apiKey?: string
  baseUrl?: string
  model?: string
  temperature?: number
  theme?: ThemeMode
}

type LegacyMultiProviderDoc = BaseDoc & {
  activeProvider?: string
  providers?: Record<string, Partial<ProviderSettings>>
  theme?: ThemeMode
  type: 'settings'
}

export function hasUtools(): boolean {
  return typeof window !== 'undefined' && typeof window.utools !== 'undefined'
}

export async function loadSettings(): Promise<SettingsForm> {
  const doc = (await getDoc(SETTINGS_DOC_ID)) as SettingsDoc | LegacySettingsDoc | LegacyMultiProviderDoc | null
  if (!doc) {
    return structuredClone(DEFAULT_SETTINGS)
  }

  return normalizeSettings(migrateSettingsDoc(doc))
}

export async function saveSettings(settings: SettingsForm): Promise<void> {
  const existing = (await getDoc(SETTINGS_DOC_ID)) as SettingsDoc | null
  const doc: SettingsDoc = {
    _id: SETTINGS_DOC_ID,
    _rev: existing?._rev,
    type: 'settings',
    ...settings,
  }

  await putDoc(doc)
}

export async function loadSession(): Promise<SessionDoc | null> {
  return (await getDoc(SESSION_DOC_ID)) as SessionDoc | null
}

export async function saveSession(session: SessionDoc): Promise<SessionDoc> {
  const existing = (await getDoc(SESSION_DOC_ID)) as SessionDoc | null
  return (await putDoc({
    ...session,
    _rev: existing?._rev,
  })) as SessionDoc
}

export async function loadConversations(): Promise<ConversationDoc[]> {
  const docs = (await getAllDocs(CONVERSATION_PREFIX)) as ConversationDoc[]
  return sortConversations(docs)
}

export async function saveConversation(conversation: ConversationDoc): Promise<ConversationDoc> {
  return (await putDoc(conversation)) as ConversationDoc
}

export async function deleteConversation(conversation: ConversationDoc): Promise<void> {
  if (hasUtools()) {
    const result = await getUtoolsApi().db.promises.remove(conversation._id)
    if (!result.ok) {
      throw new Error(result.message ?? 'uTools 数据库删除失败。')
    }
    return
  }

  memoryStore.delete(conversation._id)
}

async function getDoc(id: string): Promise<BaseDoc | null> {
  if (hasUtools()) {
    return getUtoolsApi().db.promises.get(id)
  }

  return cloneDoc(memoryStore.get(id) ?? null)
}

async function getAllDocs(prefix: string): Promise<BaseDoc[]> {
  if (hasUtools()) {
    return getUtoolsApi().db.promises.allDocs(prefix)
  }

  return [...memoryStore.values()]
    .filter((doc) => doc._id.startsWith(prefix))
    .map((doc) => cloneBaseDoc(doc))
}

async function putDoc(doc: BaseDoc): Promise<BaseDoc> {
  if (hasUtools()) {
    return writeUtoolsDoc(doc)
  }

  return writeMemoryDoc(doc)
}

async function writeUtoolsDoc(doc: BaseDoc): Promise<BaseDoc> {
  const result = (await getUtoolsApi().db.promises.put(doc)) as DbResult
  if (!result.ok || !result.rev) {
    throw new Error(result.message ?? 'uTools 数据库存储失败。')
  }

  return {
    ...doc,
    _rev: result.rev,
  }
}

function writeMemoryDoc(doc: BaseDoc): BaseDoc {
  const current = memoryStore.get(doc._id)
  const next = {
    ...doc,
    _rev: createMemoryRevision(current?._rev),
  }

  memoryStore.set(next._id, next)
  return cloneBaseDoc(next)
}

function createMemoryRevision(revision?: string): string {
  if (!revision) {
    return '1-memory'
  }

  const current = Number.parseInt(revision, 10) || 1
  return `${current + 1}-memory`
}

function cloneDoc<T extends BaseDoc | null | undefined>(doc: T): T {
  if (!doc) {
    return doc
  }

  return structuredClone(doc)
}

function cloneBaseDoc<T extends BaseDoc>(doc: T): T {
  return structuredClone(doc)
}

function getUtoolsApi(): UtoolsApi {
  if (!window.utools) {
    throw new Error('uTools API 不可用。')
  }

  return window.utools
}

function migrateSettingsDoc(
  doc: SettingsDoc | LegacySettingsDoc | LegacyMultiProviderDoc,
): SettingsForm {
  if (isSettingsDoc(doc)) {
    return {
      activeConfigId: doc.activeConfigId,
      customModels: doc.customModels,
      deepseek: doc.deepseek,
      theme: doc.theme,
    }
  }

  if (isLegacyMultiProviderDocShape(doc)) {
    return migrateLegacyMultiProviderDoc(doc as LegacyMultiProviderDoc)
  }

  return {
    activeConfigId: 'deepseek',
    customModels: [],
    deepseek: {
      ...DEFAULT_SETTINGS.deepseek,
      apiKey: doc.apiKey ?? DEFAULT_SETTINGS.deepseek.apiKey,
      baseUrl: doc.baseUrl ?? DEFAULT_SETTINGS.deepseek.baseUrl,
      model: doc.model ?? DEFAULT_SETTINGS.deepseek.model,
      temperature: typeof doc.temperature === 'number'
        ? doc.temperature
        : DEFAULT_SETTINGS.deepseek.temperature,
    },
    theme: doc.theme ?? DEFAULT_SETTINGS.theme,
  }
}

function migrateLegacyMultiProviderDoc(doc: LegacyMultiProviderDoc): SettingsForm {
  const deepseek = {
    ...DEFAULT_SETTINGS.deepseek,
    ...(doc.providers?.deepseek ?? {}),
  }

  const customModels = (['openai', 'minimax', 'kimi'] as const)
    .map((provider) => toLegacyCustomModel(provider, doc.providers?.[provider]))
    .filter((item) => item !== null)

  const activeConfigId = resolveLegacyActiveConfigId(doc.activeProvider, customModels)

  return {
    activeConfigId,
    customModels,
    deepseek,
    theme: doc.theme ?? DEFAULT_SETTINGS.theme,
  }
}

function resolveLegacyActiveConfigId(
  activeProvider: string | undefined,
  customModels: SettingsForm['customModels'],
): string {
  if (!activeProvider || activeProvider === 'deepseek') {
    return 'deepseek'
  }

  const matched = customModels.find((item) => item.provider === activeProvider)
  return matched?.id ?? 'deepseek'
}

function toLegacyCustomModel(
  provider: AddableProviderId,
  incomingSettings: Partial<ProviderSettings> | undefined,
): SettingsForm['customModels'][number] | null {
  if (!incomingSettings || !isMeaningfulProviderSettings(provider, incomingSettings)) {
    return null
  }

  const draft = createAddedModelDraft(provider, [])
  return {
    ...draft,
    apiKey: incomingSettings.apiKey ?? draft.apiKey,
    baseUrl: incomingSettings.baseUrl ?? draft.baseUrl,
    model: incomingSettings.model ?? draft.model,
    temperature: typeof incomingSettings.temperature === 'number'
      ? incomingSettings.temperature
      : draft.temperature,
  }
}

function isMeaningfulProviderSettings(
  provider: AddableProviderId,
  incomingSettings: Partial<ProviderSettings>,
): boolean {
  if (incomingSettings.apiKey?.trim()) {
    return true
  }

  const defaults = buildDefaultProviderSettings(provider)
  const baseUrl = incomingSettings.baseUrl?.trim()
  const model = incomingSettings.model?.trim()

  return Boolean(
    (baseUrl && baseUrl !== defaults.baseUrl)
    || (model && model !== defaults.model),
  )
}

function isSettingsDoc(
  doc: SettingsDoc | LegacySettingsDoc | LegacyMultiProviderDoc,
): doc is SettingsDoc {
  const candidate = doc as Partial<SettingsDoc>
  return typeof candidate.activeConfigId === 'string'
    && Array.isArray(candidate.customModels)
    && typeof candidate.deepseek === 'object'
    && candidate.deepseek !== null
}
