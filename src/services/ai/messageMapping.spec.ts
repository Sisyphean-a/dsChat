import { describe, expect, it } from 'vitest'
import { messageMapping } from './messageMapping'

describe('messageMapping', () => {
  it('maps chat attachments without sharing mutable message data', () => {
    const messages = [{
      attachments: [{
        dataUrl: 'data:image/png;base64,abc', height: 1, id: 'image', mimeType: 'image/png', name: 'a.png', size: 1, type: 'image' as const, width: 1,
      }],
      content: '看图', createdAt: 0, id: 'user', role: 'user' as const, status: 'done' as const,
    }]

    const mapped = messageMapping.toProviderConversationMessages(messages)
    messages[0]?.attachments?.[0] && (messages[0].attachments[0].name = 'changed.png')

    expect(mapped[0]).toMatchObject({
      attachments: [expect.objectContaining({ name: 'a.png' })],
      content: '看图',
      role: 'user',
    })
  })

  it('creates assistant tool and tool result messages', () => {
    expect(messageMapping.createToolAssistantMessage({
      content: '', reasoningContent: '先推理', toolCalls: [{ argumentsJson: '{}', id: 'call-1', name: 'get_current_time' }],
    })).toMatchObject({ role: 'assistant', reasoningContent: '先推理' })
    expect(messageMapping.createToolResultMessage('call-1', '{"time":"now"}')).toEqual({
      content: '{"time":"now"}', role: 'tool', toolCallId: 'call-1',
    })
  })
})
