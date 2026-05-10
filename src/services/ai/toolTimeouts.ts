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
    return await options.operation(scope.signal)
  } catch (error) {
    if (scope.isTimedOut()) {
      throw new ToolFlowError(options.timeoutCode, options.timeoutMessage, error)
    }

    throw error
  } finally {
    scope.clear()
  }
}

function createAbortScope(parentSignal: AbortSignal | undefined, timeoutMs: number): AbortScope {
  const controller = new AbortController()
  let timedOut = false

  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  let unsubscribeParentAbort: () => void = () => undefined
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort()
    } else {
      const onParentAbort = () => controller.abort()
      parentSignal.addEventListener('abort', onParentAbort, { once: true })
      unsubscribeParentAbort = () => parentSignal.removeEventListener('abort', onParentAbort)
    }
  }

  return {
    clear() {
      clearTimeout(timer)
      unsubscribeParentAbort()
    },
    isTimedOut() {
      return timedOut
    },
    signal: controller.signal,
  }
}
