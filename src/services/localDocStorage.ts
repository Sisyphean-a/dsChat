import type { BaseDoc } from '../types/chat'

const LOCAL_DOC_KEY_PREFIX = 'dsChat/doc/'
const memoryStore = new Map<string, BaseDoc>()

export async function loadLocalDoc<T extends BaseDoc>(id: string): Promise<T | null> {
  const doc = readLocalDoc(id)
  return doc ? cloneSerializable(doc as T) : null
}

export async function loadAllLocalDocs<T extends BaseDoc>(prefix: string): Promise<T[]> {
  const docs = listLocalDocs(prefix)
  return docs.map((doc) => cloneSerializable(doc as T))
}

export async function saveLocalDoc<T extends BaseDoc>(doc: T): Promise<T> {
  const current = readLocalDoc(doc._id)
  const next = cloneSerializable({
    ...doc,
    _rev: createLocalRevision(current?._rev),
  }) as T

  writeLocalDoc(next)
  return cloneSerializable(next)
}

export async function removeLocalDoc(id: string): Promise<void> {
  if (hasWindowLocalStorage()) {
    window.localStorage.removeItem(createLocalDocKey(id))
    return
  }

  memoryStore.delete(id)
}

function listLocalDocs(prefix: string): BaseDoc[] {
  if (!hasWindowLocalStorage()) {
    return [...memoryStore.values()]
      .filter((doc) => doc._id.startsWith(prefix))
  }

  const docs: BaseDoc[] = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key?.startsWith(LOCAL_DOC_KEY_PREFIX)) {
      continue
    }

    const raw = window.localStorage.getItem(key)
    if (!raw) {
      continue
    }

    const doc = JSON.parse(raw) as BaseDoc
    if (doc._id.startsWith(prefix)) {
      docs.push(doc)
    }
  }

  return docs
}

function readLocalDoc(id: string): BaseDoc | null {
  if (!hasWindowLocalStorage()) {
    return memoryStore.get(id) ?? null
  }

  const raw = window.localStorage.getItem(createLocalDocKey(id))
  if (!raw) {
    return null
  }

  return JSON.parse(raw) as BaseDoc
}

function writeLocalDoc(doc: BaseDoc): void {
  if (hasWindowLocalStorage()) {
    window.localStorage.setItem(createLocalDocKey(doc._id), JSON.stringify(doc))
    return
  }

  memoryStore.set(doc._id, cloneSerializable(doc))
}

function createLocalDocKey(id: string): string {
  return `${LOCAL_DOC_KEY_PREFIX}${id}`
}

function createLocalRevision(revision?: string): string {
  if (!revision) {
    return '1-local'
  }

  const current = Number.parseInt(revision, 10) || 1
  return `${current + 1}-local`
}

function hasWindowLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function cloneSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
