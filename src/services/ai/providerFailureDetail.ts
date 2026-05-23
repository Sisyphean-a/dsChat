interface ProviderFailurePayload {
  code?: unknown
  detail?: unknown
  error?: {
    code?: unknown
    detail?: unknown
    message?: unknown
    param?: unknown
    type?: unknown
  }
  message?: unknown
  type?: unknown
}

const MAX_PROVIDER_FAILURE_FIELD_LENGTH = 500

export async function readProviderFailureDetail(response: Response): Promise<string> {
  try {
    const payload = await response.clone().json() as ProviderFailurePayload
    return formatProviderFailurePayload(payload)
  } catch {
    return ''
  }
}

function formatProviderFailurePayload(payload: ProviderFailurePayload): string {
  return uniqueNonEmptyStrings([
    payload.error?.message,
    payload.error?.code,
    payload.error?.type,
    payload.error?.param,
    payload.error?.detail,
    payload.message,
    payload.code,
    payload.type,
    payload.detail,
  ]).join(' ')
}

function uniqueNonEmptyStrings(values: unknown[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const text = formatProviderFailureField(value)
    if (!text || seen.has(text)) {
      continue
    }

    seen.add(text)
    result.push(text)
  }

  return result
}

function formatProviderFailureField(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (value === null || typeof value === 'undefined') {
    return ''
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (typeof value === 'object') {
    return compactJsonField(value)
  }

  return ''
}

function compactJsonField(value: object): string {
  try {
    const text = JSON.stringify(value)
    if (!text) {
      return ''
    }

    return text.length > MAX_PROVIDER_FAILURE_FIELD_LENGTH
      ? `${text.slice(0, MAX_PROVIDER_FAILURE_FIELD_LENGTH)}...`
      : text
  } catch {
    return ''
  }
}
