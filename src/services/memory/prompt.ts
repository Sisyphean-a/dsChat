import type { MemoryFact, MemoryKind } from '../../types/memory'
import { isActive } from './project'

const MAX_SECTION_CHARS = 900

const KIND_LABELS: Record<MemoryKind, string> = {
  profile: '身份',
  preference: '偏好',
  background: '背景',
  instruction: '要求',
}

/**
 * Flow: 把选中的事实渲染成一段 system prompt 文本。
 * Rule: 只输出大白话，不输出 JSON、id、置信度等内部字段；超出预算时按重要性截断。
 */
export function renderMemorySection(
  facts: MemoryFact[],
  maxChars = MAX_SECTION_CHARS,
): string {
  const lines: string[] = []
  let used = 0
  for (const fact of facts.filter(isActive)) {
    const line = `- [${KIND_LABELS[fact.kind] ?? '其他'}] ${fact.text.trim()}`
    if (used + line.length > maxChars) break
    lines.push(line)
    used += line.length + 1
  }
  if (!lines.length) {
    return ''
  }
  return [
    '关于用户（来自长期记忆，可能过时；与当前对话冲突时以当前对话为准）：',
    ...lines,
  ].join('\n')
}
