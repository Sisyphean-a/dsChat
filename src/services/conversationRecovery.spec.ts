import { describe, expect, it } from 'vitest'
import { mergeRecoveredConversations } from './conversationRecovery'
import type { ChatMessage, ConversationDoc } from '../types/chat'

function message(index: number, content: string, status: ChatMessage['status'] = 'done'): ChatMessage {
  return {
    id: `m-${index}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    content,
    createdAt: index,
    status,
  }
}

function conversation(id: string, messages: ChatMessage[], updatedAt = 10): ConversationDoc {
  return {
    _id: `conversation/${id}`,
    type: 'conversation',
    id,
    title: id,
    createdAt: 1,
    updatedAt,
    messages,
  }
}

describe('conversation recovery', () => {
  it('加入远端独有的会话', () => {
    const result = mergeRecoveredConversations(
      [],
      [conversation('remote', [message(0, '旧问题'), message(1, '旧回答')])],
    )

    expect(result.conversations).toHaveLength(1)
    expect(result.recoveredConversations).toBe(1)
    expect(result.recoveredMessages).toBe(2)
  })

  it('同一会话按消息 id 取并集', () => {
    const result = mergeRecoveredConversations(
      [conversation('c1', [message(0, '问题')])],
      [conversation('c1', [message(0, '问题'), message(1, '回答'), message(2, '追问')], 20)],
    )

    expect(result.conversations[0].messages.map((item) => item.id)).toEqual(['m-0', 'm-1', 'm-2'])
    expect(result.conversations[0].updatedAt).toBe(20)
    expect(result.recoveredConversations).toBe(1)
    expect(result.recoveredMessages).toBe(2)
  })

  it('已有消息以本地为准，流式消息可被远端终态替换', () => {
    const local = conversation('c1', [
      message(0, '本地内容'),
      message(1, '正在生成', 'streaming'),
    ])
    const remote = conversation('c1', [
      message(0, '远端旧内容'),
      message(1, '已经生成完', 'done'),
    ])
    const result = mergeRecoveredConversations([local], [remote])

    expect(result.conversations[0].messages[0].content).toBe('本地内容')
    expect(result.conversations[0].messages[1].content).toBe('已经生成完')
    expect(result.recoveredMessages).toBe(0)
  })

  it('本地独有会话保持原样，空远端不产生恢复量', () => {
    const local = [conversation('local', [message(0, '本地')])]
    const result = mergeRecoveredConversations(local, [])

    expect(result.conversations).toEqual(local)
    expect(result.recoveredConversations).toBe(0)
    expect(result.recoveredMessages).toBe(0)
  })
})
