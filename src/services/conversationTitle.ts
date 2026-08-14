import type { ActiveProviderSettings } from '../types/chat'
import type { ProviderCompletion } from './ai/providerCompletion'
import type { ProviderConversationMessage } from './ai/providerAdapter'

const TITLE_PROMPT_PREFIX = `请根据用户消息文字生成六到十二个字的极简会话标题。
只输出标题，不要解释、不要回答用户、不要请求补充内容、不要带标点。
用户消息可能附带图片；你不需要查看图片，只根据文字提炼用户意图。若文字为空但有图片，只输出“图片分析”。
用户消息文字：
`
const TITLE_SANITIZE_PATTERN = /[。！？”“"']/g

export interface ConversationTitleRequestInput {
  content: string
  hasAttachments?: boolean
}

export function createConversationTitleRequester(completion: ProviderCompletion): {
  request: (settings: ActiveProviderSettings, input: ConversationTitleRequestInput) => Promise<string>
} {
  return {
    async request(settings, input) {
      const content = input.content.trim()
      const attachmentHint = input.hasAttachments ? '（用户消息附带图片，但标题只根据文字生成）' : ''
      const messages: ProviderConversationMessage[] = [{
        content: `${TITLE_PROMPT_PREFIX}${content || '（无文字）'}${attachmentHint}`,
        role: 'user',
      }]
      const title = await completion.complete({
        messages,
        settings,
        thinkingLevel: 'off',
      })
      const normalized = normalizeTitle(title)
      return isUsableTitle(normalized) ? normalized : createFallbackTitle(input)
    },
  }
}

function normalizeTitle(title: string): string {
  return title
    .replace(/^```(?:text|markdown)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(TITLE_SANITIZE_PATTERN, '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
}

function isUsableTitle(title: string): boolean {
  if (!title) return false
  return !/(没有提供|请提供|请把|需要.*内容|无法.*(总结|判断)|我会用|作为标题)/.test(title)
}

function createFallbackTitle(input: ConversationTitleRequestInput): string {
  const content = input.content
    .replace(/[\r\n]+/g, ' ')
    .replace(/[，。！？：；、,.!?;:…“”"'‘’（）()【】[\]<>《》]/g, '')
    .trim()
  if (!content) return input.hasAttachments ? '图片分析' : '新对话'
  return content.slice(0, 12)
}
