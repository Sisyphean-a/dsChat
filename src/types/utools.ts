import type { BaseDoc } from './chat'

export interface DbResult {
  id: string
  ok?: boolean
  error?: boolean
  message?: string
  rev?: string
}

export interface UtoolsDb {
  promises: {
    allDocs(prefix?: string): Promise<BaseDoc[]>
    get(id: string): Promise<BaseDoc | null>
    put(doc: BaseDoc): Promise<DbResult>
    remove(doc: BaseDoc | string): Promise<DbResult>
  }
}

export interface PluginEnterPayload {
  code: string
  from?: 'main' | 'panel' | 'hotkey' | 'redirect'
  option?: Record<string, unknown>
  payload?: unknown
  type?: string
}

export interface UtoolsApi {
  db: UtoolsDb
  onPluginEnter(callback: (payload: PluginEnterPayload) => void): void
  onPluginOut(callback: (isKill: boolean) => void): void
}
