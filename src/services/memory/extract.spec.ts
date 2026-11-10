import { describe, expect, it } from 'vitest'
import { buildMemoryExtractionPrompt, isSensitiveMemory, parseMemoryExtraction } from './extract'
import type { ChatMessage } from '../../types/chat'

function message(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: `m-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    createdAt: 1,
    status: 'done',
  }
}

describe('memory extraction', () => {
  it('解析被代码块包裹的 JSON，并丢弃非法项', () => {
    const raw = '```json\n{"memories":[{"kind":"preference","subject":"编辑器","text":"用户使用 VSCode","tags":["工具"],"importance":9,"confidence":2},{"kind":"unknown","text":""}]}\n```'
    const candidates = parseMemoryExtraction(raw)

    expect(candidates).toHaveLength(1)
    expect(candidates[0].text).toBe('用户使用 VSCode')
    expect(candidates[0].importance).toBe(5)
    expect(candidates[0].confidence).toBe(1)
  })

  it('过滤敏感信息', () => {
    expect(isSensitiveMemory('用户 API key: sk-abcdefghijklmnopqrst')).toBe(true)
    expect(isSensitiveMemory('用户使用 VSCode')).toBe(false)
    const candidates = parseMemoryExtraction(JSON.stringify({
      memories: [
        { kind: 'background', subject: '密钥', text: '用户密码：123456' },
        { kind: 'background', subject: '编辑器', text: '用户使用 VSCode' },
      ],
    }))
    expect(candidates.map((candidate) => candidate.text)).toEqual(['用户使用 VSCode'])
  })

  it('缺少 JSON 或格式错误时返回空数组', () => {
    expect(parseMemoryExtraction('没有 JSON')).toEqual([])
    expect(parseMemoryExtraction('{"memories":')).toEqual([])
    expect(parseMemoryExtraction('{"memories":[]}')).toEqual([])
  })

  it('把已有记忆与对话片段放进提示词', () => {
    const prompt = buildMemoryExtractionPrompt({
      messages: [message('user', '我一直用 VSCode'), message('assistant', '收到')],
      existingFacts: [],
    })
    expect(prompt.system).toContain('{"memories"')
    expect(prompt.user).toContain('用户：我一直用 VSCode')
    expect(prompt.user).toContain('已有记忆：无')
  })
})
