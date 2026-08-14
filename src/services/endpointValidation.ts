export function normalizeHttpsEndpoint(value: string, label: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new Error(`${label}缺失。`)
  }

  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new Error(`${label}无效。`)
  }

  if (url.protocol !== 'https:') {
    throw new Error(`${label}必须使用 HTTPS。`)
  }
  if (url.username || url.password) {
    throw new Error(`${label}不能包含用户名或密码。`)
  }
  if (url.search || url.hash) {
    throw new Error(`${label}不能包含查询参数或片段。`)
  }

  return url.toString()
}

export function getHttpsEndpointError(value: string, label: string): string | null {
  try {
    normalizeHttpsEndpoint(value, label)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : `${label}无效。`
  }
}
