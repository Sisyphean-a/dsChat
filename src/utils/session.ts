export function shouldResetConversation(
  lastOutAt: number | null,
  now = Date.now(),
  timeoutMs = 60_000,
): boolean {
  if (lastOutAt === null) {
    return false
  }

  return now - lastOutAt > timeoutMs
}
