import type { BaseDoc } from '../types/chat'
import type { DbResult, UtoolsApi } from '../types/utools'

export function hasUtools(): boolean {
  return typeof window !== 'undefined' && typeof window.utools !== 'undefined'
}

export async function loadRemoteDoc<T extends BaseDoc>(id: string): Promise<T | null> {
  if (!hasUtools()) {
    return null
  }

  return getUtoolsApi().db.promises.get(id) as Promise<T | null>
}

export async function loadAllRemoteDocs<T extends BaseDoc>(prefix: string): Promise<T[]> {
  if (!hasUtools()) {
    return []
  }

  return getUtoolsApi().db.promises.allDocs(prefix) as Promise<T[]>
}

export async function saveRemoteDoc<T extends BaseDoc>(doc: T): Promise<T> {
  const result = (await getUtoolsApi().db.promises.put(doc)) as DbResult
  if (!result.ok || !result.rev) {
    throw new Error(result.message ?? 'uTools 数据库存储失败。')
  }

  return {
    ...doc,
    _rev: result.rev,
  }
}

export async function removeRemoteDoc(id: string): Promise<void> {
  if (!hasUtools()) {
    return
  }

  const result = await getUtoolsApi().db.promises.remove(id)
  if (!result.ok && !isMissingDocError(result)) {
    throw new Error(result.message ?? 'uTools 数据库删除失败。')
  }
}

function getUtoolsApi(): UtoolsApi {
  if (!window.utools) {
    throw new Error('uTools API 不可用。')
  }

  return window.utools
}

function isMissingDocError(result: DbResult): boolean {
  return Boolean(result.error && result.message?.includes('not found'))
}
