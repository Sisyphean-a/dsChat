import {
  CONVERSATION_PREFIX,
  DEFAULT_SETTINGS,
  SESSION_DOC_ID,
  SETTINGS_DOC_ID,
} from '../constants/app'
import type {
  BaseDoc,
  ConversationDoc,
  SessionDoc,
  SettingsDoc,
  SettingsForm,
} from '../types/chat'
import type { DbResult } from '../types/utools'
import { sortConversations } from '../utils/chat'

const memoryStore = new Map<string, BaseDoc>()

export function hasUtools(): boolean {
  return typeof window !== 'undefined' && typeof window.utools !== 'undefined'
}

export async function loadSettings(): Promise<SettingsForm> {
  const doc = (await getDoc(SETTINGS_DOC_ID)) as SettingsDoc | null
  if (!doc) {
    return { ...DEFAULT_SETTINGS }
  }

  return {
    apiKey: doc.apiKey,
    baseUrl: doc.baseUrl,
    model: doc.model,
  }
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
    const result = await window.utools!.db.promises.remove(conversation._id)
    if (!result.ok) {
      throw new Error(result.message ?? 'uTools 数据库删除失败。')
    }
    return
  }

  memoryStore.delete(conversation._id)
}

async function getDoc(id: string): Promise<BaseDoc | null> {
  if (hasUtools()) {
    return window.utools!.db.promises.get(id)
  }

  return cloneDoc(memoryStore.get(id) ?? null)
}

async function getAllDocs(prefix: string): Promise<BaseDoc[]> {
  if (hasUtools()) {
    return window.utools!.db.promises.allDocs(prefix)
  }

  return [...memoryStore.values()]
    .filter((doc) => doc._id.startsWith(prefix))
    .map((doc) => cloneDoc(doc)!)
}

async function putDoc(doc: BaseDoc): Promise<BaseDoc> {
  if (hasUtools()) {
    return writeUtoolsDoc(doc)
  }

  return writeMemoryDoc(doc)
}

async function writeUtoolsDoc(doc: BaseDoc): Promise<BaseDoc> {
  const result = (await window.utools!.db.promises.put(doc)) as DbResult
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
  return cloneDoc(next)!
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
