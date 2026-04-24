export function appendModelOption(current: string[], model: string): string[] {
  const value = model.trim()
  if (!value || current.includes(value)) {
    return current
  }

  return [...current, value]
}

export function replaceModelOption(
  current: string[],
  fromOption: string,
  toOption: string,
): string[] {
  const from = fromOption.trim()
  const to = toOption.trim()
  if (!from || !to || from === to) {
    return current
  }

  const nextOptions: string[] = []
  const visited = new Set<string>()

  for (const item of current) {
    const value = item.trim()
    if (!value) {
      continue
    }

    const nextValue = value === from ? to : value
    if (visited.has(nextValue)) {
      continue
    }

    visited.add(nextValue)
    nextOptions.push(nextValue)
  }

  return nextOptions
}
