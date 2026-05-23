import { readProviderFailureDetail } from './providerFailureDetail'

export async function createProviderFailureMessage(label: string, response: Response): Promise<string> {
  const detail = await readProviderFailureDetail(response)
  if (!detail) {
    const statusText = response.statusText.trim()
    return statusText
      ? `${label} 请求失败：${response.status} ${statusText}`
      : `${label} 请求失败：${response.status}`
  }

  return `${label} 请求失败：${response.status} ${detail}`
}
