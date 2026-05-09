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

async function readProviderFailureDetail(response: Response): Promise<string> {
  try {
    const payload = await response.clone().json() as {
      error?: { message?: string | null }
      message?: string | null
    }
    const message = payload.error?.message ?? payload.message ?? ''
    return typeof message === 'string' ? message.trim() : ''
  } catch {
    return ''
  }
}
