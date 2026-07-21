export interface HttpRequest {
  body: string
  headers: Record<string, string>
  signal?: AbortSignal
  url: string
}

export interface HttpResponse {
  body: ReadableStream<Uint8Array> | null
  status: number
  statusText: string
}

export interface HttpAdapter {
  send: (request: HttpRequest) => Promise<HttpResponse>
}

export const fetchHttpAdapter: HttpAdapter = {
  async send(request) {
    const response = await fetch(request.url, {
      body: request.body,
      headers: request.headers,
      method: 'POST',
      signal: request.signal,
    })

    return {
      body: response.body,
      status: response.status,
      statusText: response.statusText,
    }
  },
}
