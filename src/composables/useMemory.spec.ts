import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { createMemoryStore } from './useMemory'
import { DEFAULT_SETTINGS } from '../constants/app'
import type { ActiveProviderSettings, ChatMessage, ConversationDoc, SettingsForm } from '../types/chat'
import type { MemoryEvent, MemoryState } from '../types/memory'
import type { MemoryStorage } from '../services/memory/storage'
import type { ProviderCompletion } from '../services/ai/providerCompletion'

const NOW = 1_700_000_000_000

function createStorage(): {
  storage: MemoryStorage
  events: MemoryEvent[]
  getState: () => MemoryState | null
} {
  const events: MemoryEvent[] = []
  let state: MemoryState | null = null
  return {
    events,
    getState: () => state,
    storage: {
      kind: 'memory',
      location: '测试',
      readEvents: async () => [...events],
      appendEvent: async (event) => { events.push(event) },
      readState: async () => state && JSON.parse(JSON.stringify(state)),
      writeState: async (next) => { state = JSON.parse(JSON.stringify(next)) },
      backup: async () => {},
    },
  }
}

function createCompletion(response: string | (() => Promise<string>)): {
  calls: number
  completion: ProviderCompletion
} {
  let calls = 0
  return {
    get calls() { return calls },
    completion: {
      async complete() {
        calls += 1
        return typeof response === 'function' ? response() : response
      },
    },
  }
}

function message(role: ChatMessage['role'], content: string, index: number): ChatMessage {
  return { id: `m-${index}`, role, content, createdAt: NOW + index, status: 'done' }
}

function conversation(messages: ChatMessage[]): ConversationDoc {
  return {
    _id: 'conversation/c1',
    type: 'conversation',
    id: 'c1',
    title: '测试',
    createdAt: NOW,
    updatedAt: NOW,
    messages,
  }
}

function createOptions(input: {
  completion: ProviderCompletion
  storage: MemoryStorage
  messages: ChatMessage[]
  observeEveryTurns?: number
}) {
  const settings = ref<SettingsForm>(structuredClone(DEFAULT_SETTINGS))
  settings.value.memory = {
    enabled: true,
    observeEveryTurns: input.observeEveryTurns ?? 2,
  }
  const conversations = ref<ConversationDoc[]>([conversation(input.messages)])
  return {
    settings,
    conversations,
    options: {
      settings,
      conversations,
      completion: input.completion,
      storage: input.storage,
      now: () => NOW,
      resolveActiveSettings: () => ({ provider: 'deepseek', label: 'DeepSeek' }) as ActiveProviderSettings,
    },
  }
}

describe('memory store', () => {
  it('达到间隔后抽取事实并记录已观察位置', async () => {
    const { storage, events, getState } = createStorage()
    const { completion } = createCompletion(JSON.stringify({
      memories: [{ kind: 'preference', subject: '编辑器', text: '用户使用 VSCode', importance: 4 }],
    }))
    const { options } = createOptions({
      completion,
      storage,
      messages: [
        message('user', '我一直用 VSCode', 0),
        message('assistant', '好的', 1),
        message('user', '前端项目也用它', 2),
        message('assistant', '明白', 3),
      ],
    })
    const store = createMemoryStore(options)

    await store.observeTurn('c1')

    expect(events).toHaveLength(1)
    expect(events[0].op).toBe('observe')
    expect(store.facts.value[0].text).toBe('用户使用 VSCode')
    expect(getState()?.observed.c1).toBe('m-3')
  })

  it('未达到间隔时不发起抽取', async () => {
    const { storage, events } = createStorage()
    const { completion, calls } = createCompletion('{"memories":[]}')
    const { options } = createOptions({
      completion,
      storage,
      messages: [message('user', '你好', 0), message('assistant', '你好', 1)],
      observeEveryTurns: 2,
    })
    const store = createMemoryStore(options)

    await store.observeTurn('c1')

    expect(calls).toBe(0)
    expect(events).toHaveLength(0)
  })

  it('抽取失败只记录错误，不推进已观察位置', async () => {
    const { storage, events, getState } = createStorage()
    const { completion } = createCompletion(async () => {
      throw new Error('模型不可用')
    })
    const { options } = createOptions({
      completion,
      storage,
      messages: [
        message('user', '记住我用 VSCode', 0),
        message('assistant', '好', 1),
        message('user', '还有 Cursor', 2),
        message('assistant', '好', 3),
      ],
    })
    const store = createMemoryStore(options)

    await store.observeTurn('c1')

    expect(events).toHaveLength(0)
    expect(store.status.value.lastError).toBe('模型不可用')
    expect(getState()?.observed.c1).toBeUndefined()
  })

  it('检索命中后渲染进提示词', async () => {
    const { storage } = createStorage()
    const { completion } = createCompletion(JSON.stringify({
      memories: [{ kind: 'preference', subject: '编辑器', text: '用户使用 VSCode 写前端', importance: 3 }],
    }))
    const { options } = createOptions({
      completion,
      storage,
      messages: [
        message('user', '我一直用 VSCode', 0),
        message('assistant', '好', 1),
        message('user', '前端项目也用它', 2),
        message('assistant', '好', 3),
      ],
    })
    const store = createMemoryStore(options)
    await store.observeTurn('c1')

    const prompt = await store.buildPromptSection('前端项目用哪个编辑器')
    expect(prompt).toContain('关于用户')
    expect(prompt).toContain('VSCode')
    expect(await store.buildPromptSection('今天天气')).toBe('')
  })
})
