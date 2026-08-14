import { DEFAULT_QWEN_IMAGE_BASE_URL, DEFAULT_QWEN_IMAGE_MODEL } from '../../constants/tools'
import { normalizeQwenImageEndpoint } from '../qwenEndpointValidation'

interface QwenVisionRequest {
  apiKey: string
  baseUrl?: string
  imageDataUrl: string
  model?: string
  prompt: string
  signal?: AbortSignal
  systemPrompt: string
}

interface QwenRawResponse {
  choices?: Array<{
    message?: {
      content?: unknown
    }
  }>
  error?: {
    message?: unknown
  }
  message?: unknown
}

export async function analyzeImageWithQwen(request: QwenVisionRequest): Promise<string> {
  const apiKey = request.apiKey.trim()
  const baseUrl = request.baseUrl?.trim() || DEFAULT_QWEN_IMAGE_BASE_URL
  const model = request.model?.trim() || DEFAULT_QWEN_IMAGE_MODEL
  const prompt = request.prompt.trim()

  if (!apiKey) throw new Error('阿里云 Qwen 图片工具 API Key 缺失。')
  if (!baseUrl) throw new Error('阿里云 Qwen 图片工具服务地址缺失。')
  if (!request.imageDataUrl.trim()) throw new Error('阿里云 Qwen 图片工具缺少图片内容。')
  if (!prompt) throw new Error('阿里云 Qwen 图片工具提示词不能为空。')

  const endpoint = normalizeQwenImageEndpoint(baseUrl)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { content: request.systemPrompt, role: 'system' },
        {
          content: [
            { image_url: { url: request.imageDataUrl }, type: 'image_url' },
            { text: prompt, type: 'text' },
          ],
          role: 'user',
        },
      ],
      model,
      stream: false,
      enable_thinking: false,
    }),
    signal: request.signal,
  })

  const payload = await readJsonResponse(response)
  if (!response.ok) {
    throw new Error(`阿里云 Qwen 图片分析失败：HTTP ${response.status}${formatErrorSuffix(payload)}`)
  }

  const content = resolveContent(payload)
  if (!content) throw new Error('阿里云 Qwen 图片分析失败：返回结果为空。')
  return content
}

async function readJsonResponse(response: Response): Promise<QwenRawResponse | null> {
  const raw = await response.text()
  if (!raw.trim()) return null
  try {
    return JSON.parse(raw) as QwenRawResponse
  } catch {
    return { message: raw }
  }
}

function resolveContent(payload: QwenRawResponse | null): string {
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    return content.map((item) => {
      if (typeof item === 'string') return item
      if (typeof item !== 'object' || item === null) return ''
      const text = (item as { text?: unknown }).text
      return typeof text === 'string' ? text : ''
    }).join('').trim()
  }
  return ''
}

function formatErrorSuffix(payload: QwenRawResponse | null): string {
  const message = resolveErrorMessage(payload)
  return message ? `：${message}` : ''
}

function resolveErrorMessage(payload: QwenRawResponse | null): string {
  const candidates = [payload?.error?.message, payload?.message]
  const message = candidates.find((item): item is string => typeof item === 'string' && Boolean(item.trim()))
  return message?.trim() ?? ''
}
