import type { MessageAttachment } from '../types/chat'

const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/gif', 'image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_BASE64_LENGTH = 1_400_000
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

export function validateImageAttachment(attachment: MessageAttachment): void {
  const dataUrl = attachment?.dataUrl
  const match = typeof dataUrl === 'string'
    ? /^data:(image\/[^;]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataUrl)
    : null
  if (!match) {
    throw new Error(`图片附件格式无效：${attachment?.id ?? 'unknown'}`)
  }

  const mimeType = match[1]
  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error(`图片附件类型不受支持：${mimeType}`)
  }

  const encoded = match[2]
  if (!encoded || encoded.length % 4 === 1 || !BASE64_PATTERN.test(encoded)) {
    throw new Error(`图片附件内容无效：${attachment?.id ?? 'unknown'}`)
  }
  if (encoded.length > MAX_IMAGE_BASE64_LENGTH) {
    throw new Error(`图片附件过大：${attachment?.id ?? 'unknown'}`)
  }
}
