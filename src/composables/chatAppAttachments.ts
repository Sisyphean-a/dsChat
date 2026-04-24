import { MAX_IMAGE_ATTACHMENTS } from '../constants/app'
import { prepareImageAttachment } from '../services/messageAttachments'
import type { MessageAttachment } from '../types/chat'
import { getErrorMessage } from './chatAppErrors'

export async function preparePendingImages(options: {
  files: File[]
  pendingAttachments: MessageAttachment[]
}): Promise<{
  error: string | null
  nextAttachments: MessageAttachment[]
}> {
  const { files, pendingAttachments } = options
  if (!files.length) {
    return {
      error: null,
      nextAttachments: pendingAttachments,
    }
  }

  const availableSlots = MAX_IMAGE_ATTACHMENTS - pendingAttachments.length
  if (availableSlots <= 0) {
    return {
      error: `单条消息最多可添加 ${MAX_IMAGE_ATTACHMENTS} 张图片。`,
      nextAttachments: pendingAttachments,
    }
  }

  const selectedFiles = files.slice(0, availableSlots)
  const nextAttachments = [...pendingAttachments]

  try {
    for (const file of selectedFiles) {
      nextAttachments.push(await prepareImageAttachment(file))
    }
  } catch (error) {
    return {
      error: getErrorMessage(error, '图片处理失败。'),
      nextAttachments: pendingAttachments,
    }
  }

  return {
    error: files.length > availableSlots
      ? `已达到上限：单条消息最多 ${MAX_IMAGE_ATTACHMENTS} 张。`
      : null,
    nextAttachments,
  }
}
