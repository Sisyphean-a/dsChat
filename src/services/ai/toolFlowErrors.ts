import type { ToolTraceErrorCode } from '../../types/chat'

export class ToolFlowError extends Error {
  readonly code: ToolTraceErrorCode

  constructor(
    code: ToolTraceErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message)
    this.name = 'ToolFlowError'
    this.code = code
    if (cause !== undefined) {
      ;(this as { cause?: unknown }).cause = cause
    }
  }
}

export function isToolFlowError(error: unknown): error is ToolFlowError {
  return error instanceof ToolFlowError
}

export function toToolFlowError(
  error: unknown,
  fallbackCode: ToolTraceErrorCode,
  fallbackMessage: string,
): ToolFlowError {
  if (isToolFlowError(error)) {
    return error
  }

  if (error instanceof Error && error.message.trim()) {
    return new ToolFlowError(fallbackCode, error.message.trim(), error)
  }

  return new ToolFlowError(fallbackCode, fallbackMessage, error)
}
