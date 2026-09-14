import type { PluginEnterPayload } from '../types/utools'

/**
 * Flow: uTools 划词入口 `ask-ds` 的选中文本转为草稿代码块，首行保留给用户补充问题。
 * Rule: 只有 ask-ds 且 payload 为非空字符串时才生成草稿；文本按原样写入代码块，不做 trim。
 */
export function formatAskDsDraft(payload: PluginEnterPayload | null): string | null {
  if (payload?.code !== 'ask-ds' || typeof payload.payload !== 'string' || !payload.payload.trim()) {
    return null
  }

  return `\n\`\`\`\n${payload.payload}\n\`\`\``
}
