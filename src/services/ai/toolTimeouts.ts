import { ToolFlowError } from './toolFlowErrors'

interface AbortScope {
  clear: () => void
  isTimedOut: () => boolean
  signal: AbortSignal
}

interface RunWithAbortTimeoutOptions<T> {
  operation: (signal: AbortSignal) => Promise<T>
  parentSignal?: AbortSignal
  timeoutMs: number
  timeoutMessage: string
  timeoutCode: ToolFlowError['code']
}

export async function runWithAbortTimeout<T>(options: RunWithAbortTimeoutOptions<T>): Promise<T> {
  const scope = createAbortScope(options.parentSignal, options.timeoutMs)
  try {
    if (scope.signal.aborted) {
      throw createAbortError()
    }
    return await raceWithAbort(options.operation(scope.signal), scope.signal)
  } catch (error) {
    if (scope.isTimedOut()) {
      throw new ToolFlowError(options.timeoutCode, options.timeoutMessage, error)
    }
    throw error
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

function createAbortScope(parentSignal: AbortSignal | undefined, timeoutMs: number): AbortScope {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  const onParentAbort = () => controller.abort()
  if (parentSignal?.aborted) {
    controller.abort()
  } else {
    parentSignal?.addEventListener('abort', onParentAbort, { once: true })
  }

  return {
    clear() {
      clearTimeout(timer)
      parentSignal?.removeEventListener('abort', onParentAbort)
    },
    isTimedOut: () => timedOut,
    signal: controller.signal,
  }
}

function createAbortError(): Error {
  const error = new Error('操作已停止。')
  error.name = 'AbortError'
  return error
}
