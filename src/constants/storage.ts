import type { UtoolsUploadMode } from '../types/chat'

export const DEFAULT_UTOOLS_UPLOAD_MODE: UtoolsUploadMode = 'settings-only'
export const DEFAULT_UTOOLS_SESSION_IDLE_TIMEOUT_MINUTES = 1
export const UTOOLS_SESSION_IDLE_TIMEOUT_OPTIONS = [
  { label: '1 分钟', value: 1 },
  { label: '5 分钟', value: 5 },
  { label: '15 分钟', value: 15 },
  { label: '30 分钟', value: 30 },
  { label: '1 小时', value: 60 },
] as const
export const UTOOLS_UPLOAD_MODES: UtoolsUploadMode[] = [
  'local-only',
  'settings-only',
  'all-data',
]

export const UTOOLS_UPLOAD_MODE_OPTIONS: Array<{
  label: string
  value: UtoolsUploadMode
}> = [
  { label: '数据不上传utools', value: 'local-only' },
  { label: '上传模型API数据', value: 'settings-only' },
  { label: '上传模型API以及对话数据', value: 'all-data' },
]
