import type { UtoolsUploadMode } from '../types/chat'

export const DEFAULT_UTOOLS_UPLOAD_MODE: UtoolsUploadMode = 'settings-only'
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
