interface AbortScope {
  clear: () => void
  signal: AbortSignal
}

interface RunWithAbortOptions<T> {
  operation: (signal: AbortSignal) => Promise<T>
  parentSignal?: AbortSignal
}

export async function runWithAbort<T>(options: RunWithAbortOptions<T>): Promise<T> {
  const scope = createAbortScope(options.parentSignal)
  try {
    if (scope.signal.aborted) {
      throw createAbortError()
    }
    return await raceWithAbort(options.operation(scope.signal), scope.signal)
  } finally {
    scope.clear()
  }
}

function raceWithAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(createAbortError())
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false
    const cleanup = () => signal.removeEventListener('abort', onAbort)
    const onAbort = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(createAbortError())
    }
    signal.addEventListener('abort', onAbort, { once: true })
    operation.then(
      (value) => {
        if (settled) return
        settled = true
        cleanup()
        resolve(value)
      },
      (error) => {
        if (settled) return
        settled = true
        cleanup()
        reject(error)
      },
    )
  })
}

function createAbortScope(parentSignal: AbortSignal | undefined): AbortScope {
  const controller = new AbortController()
  const onParentAbort = () => controller.abort()
  if (parentSignal?.aborted) {
    controller.abort()
  } else {
    parentSignal?.addEventListener('abort', onParentAbort, { once: true })
  }

  return {
    clear() {
      parentSignal?.removeEventListener('abort', onParentAbort)
    },
    signal: controller.signal,
  }
}

function createAbortError(): Error {
  const error = new Error('操作已停止。')
  error.name = 'AbortError'
  return error
}
