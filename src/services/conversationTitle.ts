import type { ActiveProviderSettings, ChatMessage } from '../types/chat'
import { requestChatCompletion } from './chatCompletion'

const TITLE_PROMPT_PREFIX = '请用六到十二个字总结以下内容的意图作为极简标题，不要带标点：\n'
const TITLE_SANITIZE_PATTERN = /[。！？”“"']/g

export async function requestConversationTitle(
  settings: ActiveProviderSettings,
  firstMessageContent: string,
): Promise<string> {
  const messages: ChatMessage[] = [{
    id: 'title-req',
    role: 'user',
    content: `${TITLE_PROMPT_PREFIX}${firstMessageContent}`,
    createdAt: Date.now(),
    status: 'done',
  }]

  const title = await requestChatCompletion(messages, settings)
  return title.replace(TITLE_SANITIZE_PATTERN, '').trim()
}
