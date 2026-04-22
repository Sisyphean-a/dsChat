import {
  CONVERSATION_PREFIX,
  SESSION_DOC_ID,
  SETTINGS_DOC_ID,
} from '../constants/app'
import { DEFAULT_UTOOLS_UPLOAD_MODE } from '../constants/storage'
import { normalizeSettings } from '../composables/chatAppSettings'
import type {
  ConversationDoc,
  SessionDoc,
  SettingsForm,
  UtoolsUploadMode,
} from '../types/chat'
import { sortConversations } from '../utils/chat'
import {
  loadAllLocalDocs,
  loadLocalDoc,
  removeLocalDoc,
  saveLocalDoc,
} from './localDocStorage'
import {
  hasUtools,
  loadAllRemoteDocs,
  loadRemoteDoc,
  removeRemoteDoc,
  saveRemoteDoc,
} from './utoolsRemoteStorage'
import { migrateSettingsDoc, type PersistedSettingsDoc } from './settingsDocMigration'

export { hasUtools } from './utoolsRemoteStorage'

const LEGACY_UPLOAD_MODE_FALLBACK: UtoolsUploadMode = 'all-data'

export async function loadSettings(): Promise<SettingsForm> {
  const localDoc = await loadStoredSettingsDoc('local')
  if (localDoc) {
    return normalizeSettings(migrateSettingsDoc(localDoc, LEGACY_UPLOAD_MODE_FALLBACK))
  }

  const remoteDoc = await loadStoredSettingsDoc('remote')
  if (!remoteDoc) {
    return structuredClone(DEFAULT_SETTINGS)
  }

  const settings = normalizeSettings(migrateSettingsDoc(remoteDoc, LEGACY_UPLOAD_MODE_FALLBACK))
  await persistLocalSettingsDoc(settings)
  return settings
}

export async function saveSettings(settings: SettingsForm): Promise<void> {
  const normalizedSettings = normalizeSettings(settings)
  const previousMode = await getCurrentUtoolsUploadMode()

  await persistLocalSettingsDoc(normalizedSettings)

  if (!hasUtools()) {
    return
  }

  if (shouldUploadSettingsToUtools(normalizedSettings.utoolsUploadMode)) {
    await persistRemoteSettingsDoc(normalizedSettings)
  } else {
    await removeRemoteDoc(SETTINGS_DOC_ID)
  }

  if (normalizedSettings.utoolsUploadMode === 'all-data') {
    await syncLocalChatDataToRemote()
    return
  }

  if (previousMode === 'all-data') {
    await clearRemoteChatData()
  }
}

export async function loadSession(): Promise<SessionDoc | null> {
  const localSession = (await loadLocalDoc(SESSION_DOC_ID)) as SessionDoc | null
  if (!(await shouldUseRemoteConversationStorage())) {
    return localSession
  }

  const remoteSession = (await loadRemoteDoc(SESSION_DOC_ID)) as SessionDoc | null
  return remoteSession ?? localSession
}

export async function saveSession(session: SessionDoc): Promise<SessionDoc> {
  const localSaved = (await saveLocalDoc({
    ...session,
    _id: SESSION_DOC_ID,
  })) as SessionDoc

  if (!(await shouldUseRemoteConversationStorage())) {
    return localSaved
  }

  return persistRemoteSessionDoc(session)
}

export async function loadConversations(): Promise<ConversationDoc[]> {
  const localDocs = (await loadAllLocalDocs(CONVERSATION_PREFIX)) as ConversationDoc[]
  if (!(await shouldUseRemoteConversationStorage())) {
    return sortConversations(localDocs)
  }

  const remoteDocs = (await loadAllRemoteDocs(CONVERSATION_PREFIX)) as ConversationDoc[]
  return sortConversations(mergeConversationDocs(localDocs, remoteDocs))
}

export async function saveConversation(conversation: ConversationDoc): Promise<ConversationDoc> {
  const localSaved = (await saveLocalDoc(conversation)) as ConversationDoc
  if (!(await shouldUseRemoteConversationStorage())) {
    return localSaved
  }

  return persistRemoteConversationDoc(localSaved)
}

export async function deleteConversation(conversation: ConversationDoc): Promise<void> {
  await removeLocalDoc(conversation._id)

  if (hasUtools()) {
    await removeRemoteDoc(conversation._id)
  }
}

async function loadStoredSettingsDoc(
  source: 'local' | 'remote',
): Promise<PersistedSettingsDoc | null> {
  const doc = source === 'local'
    ? await loadLocalDoc(SETTINGS_DOC_ID)
    : await loadRemoteDoc(SETTINGS_DOC_ID)

  return doc as PersistedSettingsDoc | null
}

async function persistLocalSettingsDoc(settings: SettingsForm): Promise<void> {
  await saveLocalDoc({
    _id: SETTINGS_DOC_ID,
    type: 'settings',
    ...settings,
  })
}

async function persistRemoteSettingsDoc(settings: SettingsForm): Promise<void> {
  const existing = (await loadRemoteDoc(SETTINGS_DOC_ID)) as SettingsDoc | null
  await saveRemoteDoc({
    _id: SETTINGS_DOC_ID,
    _rev: existing?._rev,
    type: 'settings',
    ...settings,
  })
}

async function persistRemoteSessionDoc(session: SessionDoc): Promise<SessionDoc> {
  const existing = (await loadRemoteDoc(SESSION_DOC_ID)) as SessionDoc | null
  return (await saveRemoteDoc({
    ...session,
    _id: SESSION_DOC_ID,
    _rev: existing?._rev,
  })) as SessionDoc
}

async function persistRemoteConversationDoc(conversation: ConversationDoc): Promise<ConversationDoc> {
  const existing = (await loadRemoteDoc(conversation._id)) as ConversationDoc | null
  return (await saveRemoteDoc({
    ...conversation,
    _rev: existing?._rev,
  })) as ConversationDoc
}

async function shouldUseRemoteConversationStorage(): Promise<boolean> {
  return hasUtools() && (await getCurrentUtoolsUploadMode()) === 'all-data'
}

async function getCurrentUtoolsUploadMode(): Promise<UtoolsUploadMode> {
  const localDoc = await loadStoredSettingsDoc('local')
  if (localDoc) {
    return migrateSettingsDoc(localDoc, LEGACY_UPLOAD_MODE_FALLBACK).utoolsUploadMode
  }

  const remoteDoc = await loadStoredSettingsDoc('remote')
  if (remoteDoc) {
    return migrateSettingsDoc(remoteDoc, LEGACY_UPLOAD_MODE_FALLBACK).utoolsUploadMode
  }

  return DEFAULT_UTOOLS_UPLOAD_MODE
}

function shouldUploadSettingsToUtools(mode: UtoolsUploadMode): boolean {
  return mode !== 'local-only'
}

async function syncLocalChatDataToRemote(): Promise<void> {
  const localConversations = (await loadAllLocalDocs(CONVERSATION_PREFIX)) as ConversationDoc[]
  const localSession = (await loadLocalDoc(SESSION_DOC_ID)) as SessionDoc | null

  for (const conversation of localConversations) {
    await persistRemoteConversationDoc(conversation)
  }

  if (localSession) {
    await persistRemoteSessionDoc(localSession)
    return
  }

  await removeRemoteDoc(SESSION_DOC_ID)
}

async function clearRemoteChatData(): Promise<void> {
  const remoteConversations = await loadAllRemoteDocs(CONVERSATION_PREFIX)
  for (const conversation of remoteConversations) {
    await removeRemoteDoc(conversation._id)
  }

  await removeRemoteDoc(SESSION_DOC_ID)
}

function mergeConversationDocs(
  localDocs: ConversationDoc[],
  remoteDocs: ConversationDoc[],
): ConversationDoc[] {
  const merged = new Map<string, ConversationDoc>()

  for (const conversation of [...localDocs, ...remoteDocs]) {
    const current = merged.get(conversation.id)
    if (!current || conversation.updatedAt >= current.updatedAt) {
      merged.set(conversation.id, conversation)
    }
  }

  return [...merged.values()]
}
