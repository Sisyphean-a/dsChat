import type { ActiveProviderSettings } from '../types/chat'
import type { ProviderCompletion } from './ai/providerCompletion'
import type { ProviderConversationMessage } from './ai/providerAdapter'

const TITLE_PROMPT_PREFIX = '请用六到十二个字总结以下内容的意图作为极简标题，不要带标点：\n'
const TITLE_SANITIZE_PATTERN = /[。！？”“"']/g

export function createConversationTitleRequester(completion: ProviderCompletion): {
  request: (settings: ActiveProviderSettings, firstMessageContent: string) => Promise<string>
} {
  return {
    async request(settings, firstMessageContent) {
      const messages: ProviderConversationMessage[] = [{
        content: `${TITLE_PROMPT_PREFIX}${firstMessageContent}`,
        role: 'user',
      }]
      const title = await completion.complete({
        messages,
        settings,
        thinkingEnabled: false,
      })
      const normalized = title.replace(TITLE_SANITIZE_PATTERN, '').trim()
      if (!normalized) {
        throw new Error('会话标题生成失败。')
      }
      return normalized
    },
  }
}
