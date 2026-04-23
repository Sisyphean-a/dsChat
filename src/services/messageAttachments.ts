import {
  MAX_IMAGE_EDGE,
  MAX_IMAGE_OUTPUT_BYTES,
  MAX_IMAGE_SOURCE_BYTES,
} from '../constants/app'
import imageCompression from 'browser-image-compression'
import type { ImageAttachment } from '../types/chat'
import { createAttachmentId } from '../utils/chat'

export async function prepareImageAttachment(file: File): Promise<ImageAttachment> {
  const normalizedFile = normalizeFile(file)
  validateImageFile(normalizedFile)
  const sourceDataUrl = await readFileAsDataUrl(normalizedFile)
  const image = await loadImageElement(sourceDataUrl)
  const output = normalizedFile.type === 'image/gif'
    ? {
        dataUrl: sourceDataUrl,
        height: image.naturalHeight,
        mimeType: normalizedFile.type,
        size: normalizedFile.size,
        width: image.naturalWidth,
      }
    : await buildCompressedOutput(normalizedFile)

  return {
    id: createAttachmentId(),
    type: 'image',
    name: normalizedFile.name,
    mimeType: output.mimeType,
    size: output.size,
    width: output.width,
    height: output.height,
    dataUrl: output.dataUrl,
  }
}

function validateImageFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error(`文件 ${file.name} 不是图片，无法发送。`)
  }

  if (file.size > MAX_IMAGE_SOURCE_BYTES) {
    throw new Error(`图片 ${file.name} 超过 ${(MAX_IMAGE_SOURCE_BYTES / 1024 / 1024).toFixed(0)}MB，请先压缩后再发送。`)
  }
}

async function buildCompressedOutput(file: File): Promise<{
  dataUrl: string
  height: number
  mimeType: string
  size: number
  width: number
}> {
  const blob = await imageCompression(file, {
    fileType: resolveOutputMimeType(file.type),
    initialQuality: 0.85,
    maxSizeMB: MAX_IMAGE_OUTPUT_BYTES / 1024 / 1024,
    maxWidthOrHeight: MAX_IMAGE_EDGE,
    useWebWorker: true,
  })

  const dataUrl = await blobToDataUrl(blob)
  const previewImage = await loadImageElement(dataUrl)
  return {
    dataUrl,
    height: previewImage.naturalHeight,
    mimeType: blob.type || resolveOutputMimeType(file.type),
    size: blob.size,
    width: previewImage.naturalWidth,
  }
}

function resolveOutputMimeType(sourceMimeType: string): string {
  if (sourceMimeType === 'image/png' || sourceMimeType === 'image/webp') {
    return sourceMimeType
  }

  return 'image/jpeg'
}

async function readFileAsDataUrl(file: Blob): Promise<string> {
  return blobToDataUrl(file)
}

async function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解析失败，请更换文件后重试。'))
    image.src = dataUrl
  })
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('图片读取失败，请重试。'))
        return
      }

      resolve(reader.result)
    }
    reader.onerror = () => reject(new Error('图片读取失败，请重试。'))
    reader.readAsDataURL(blob)
  })
}

function normalizeFile(file: File): File {
  if (file.name.trim()) {
    return file
  }

  const extension = mimeTypeToExtension(file.type)
  return new File([file], `image-${Date.now()}.${extension}`, {
    type: file.type || 'image/png',
    lastModified: Date.now(),
  })
}

function mimeTypeToExtension(mimeType: string): string {
  const fallback = 'png'
  if (!mimeType.startsWith('image/')) {
    return fallback
  }

  const extension = mimeType.slice('image/'.length).trim()
  return extension || fallback
}
