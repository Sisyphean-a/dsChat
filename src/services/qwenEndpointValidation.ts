import { normalizeHttpsEndpoint } from './endpointValidation'

const QWEN_BASE_PATH = '/compatible-mode/v1'
const QWEN_CHAT_COMPLETIONS_PATH = `${QWEN_BASE_PATH}/chat/completions`

export function normalizeQwenImageEndpoint(value: string): string {
  const endpoint = normalizeHttpsEndpoint(value, '阿里云 Qwen 图片工具服务地址')
  const url = new URL(endpoint)
  const path = url.pathname.replace(/\/+$/, '')

  if (path === QWEN_CHAT_COMPLETIONS_PATH) {
    return endpoint
  }
  if (path === QWEN_BASE_PATH) {
    url.pathname = QWEN_CHAT_COMPLETIONS_PATH
    return url.toString()
  }

  throw new Error(`阿里云 Qwen 图片工具服务地址必须填写到 ${QWEN_BASE_PATH}，或包含完整 ${QWEN_CHAT_COMPLETIONS_PATH}。`)
}

export function getQwenImageEndpointError(value: string): string | null {
  try {
    normalizeQwenImageEndpoint(value)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : '阿里云 Qwen 图片工具服务地址无效。'
  }
}
