import { describe, expect, it, vi } from 'vitest'
import { buildDefaultSettings, createAddedModelDraft } from '../constants/providers'
import { messageMapping } from '../services/ai/messageMapping'
import type { ChatMessage, MessageAttachment, ToolSettings } from '../types/chat'
import { getActiveProviderSettings, normalizeSettings } from './chatAppSettings'
import { createTurnPlan, type TurnPlanRequest } from './chatAppTurnPlan'

const attachment: MessageAttachment = {
  dataUrl: 'data:image/png;base64,aW1hZ2U=',
  height: 10,
  id: 'image-1',
  mimeType: 'image/png',
  name: 'screen.png',
  size: 10,
  type: 'image',
  width: 10,
}

describe('createTurnPlan', () => {
  it('sends images straight to a vision model when no image tool is available', () => {
    const tools = vi.fn(() => [])
    const plan = createTurnPlan({
      messageMapping,
      messages: userMessage(attachment),
      request: request({ model: 'deepseek-flash' }),
      resolveTools: tools,
    })

    expect(plan.directImageInput).toBe(true)
    expect(plan.tools).toEqual([])
    expect(plan.useToolOrchestrator).toBe(false)
    expect(plan.messages.at(-1)?.attachments).toEqual([attachment])
    expect(plan.messages[0]?.content).toContain('当前模型可以直接查看')
  })

  it('routes images to the image tool and strips them from provider messages', () => {
    const tools = vi.fn(() => [imageTool()])
    const plan = createTurnPlan({
      messageMapping,
      messages: userMessage(attachment),
      request: request({ toolSettings: enabledToolSettings() }),
      resolveTools: tools,
    })

    expect(tools).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }), [attachment])
    expect(plan.directImageInput).toBe(false)
    expect(plan.useToolOrchestrator).toBe(true)
    expect(plan.messages.at(-1)?.attachments).toBeUndefined()
    expect(plan.messages[0]?.content).toContain('必须调用图片工具')
  })

  it('does not resolve tools when tool calling is disabled', () => {
    const tools = vi.fn(() => [imageTool()])
    const plan = createTurnPlan({
      messageMapping,
      messages: userMessage(attachment),
      request: request({
        model: 'deepseek-flash',
        toolSettings: { ...enabledToolSettings(), enabled: false },
      }),
      resolveTools: tools,
    })

    expect(tools).not.toHaveBeenCalled()
    expect(plan.tools).toEqual([])
    expect(plan.directImageInput).toBe(true)
  })

  it('skips local tools on Responses native web search without failing the turn', () => {
    const tools = vi.fn(() => [imageTool()])
    const openai = createAddedModelDraft('openai', [])
    const plan = createTurnPlan({
      messageMapping,
      messages: userMessage(),
      request: request({
        configId: openai.id,
        customModels: [openai],
        toolSettings: enabledToolSettings(),
      }),
      resolveTools: tools,
    })

    expect(tools).not.toHaveBeenCalled()
    expect(plan.useToolOrchestrator).toBe(false)
    expect(plan.messages[0]?.content).toContain('原生联网搜索')
  })

  it('rejects tool-enabled configs without tool calling or native web search', () => {
    const settings = buildDefaultSettings()
    settings.deepseek.capabilities = {
      ...settings.deepseek.capabilities,
      toolCalling: false,
    }

    expect(() => createTurnPlan({
      messageMapping,
      messages: userMessage(),
      request: {
        settings: getActiveProviderSettings(normalizeSettings(settings)),
        systemPrompt: '',
        thinkingLevel: 'high',
        toolSettings: enabledToolSettings(),
      },
      resolveTools: () => [],
    })).toThrow('当前配置暂不支持工具调用。')
  })
})

function userMessage(messageAttachment?: MessageAttachment): ChatMessage[] {
  return [
    { content: '你好', createdAt: 1, id: 'user-1', role: 'user', status: 'done', attachments: messageAttachment ? [messageAttachment] : undefined },
    { content: '', createdAt: 2, id: 'assistant-1', role: 'assistant', status: 'streaming' },
  ]
}

function request(overrides: {
  configId?: string
  customModels?: ReturnType<typeof createAddedModelDraft>[]
  model?: string
  toolSettings?: ToolSettings
} = {}): TurnPlanRequest {
  const settings = buildDefaultSettings()
  if (overrides.model) {
    settings.deepseek.model = overrides.model
  }
  const normalized = normalizeSettings({
    ...settings,
    activeConfigId: overrides.configId ?? settings.activeConfigId,
    customModels: overrides.customModels ?? settings.customModels,
  })

  return {
    settings: getActiveProviderSettings(normalized),
    systemPrompt: '回答要简短',
    thinkingLevel: 'high',
    toolSettings: overrides.toolSettings ?? normalized.toolSettings,
  }
}

function enabledToolSettings(): ToolSettings {
  const toolSettings = enabledToolSettingsBase()
  return toolSettings
}

function enabledToolSettingsBase(): ToolSettings {
  return {
    enabled: true,
    builtinTools: {
      currentTime: { enabled: false },
      tavilySearch: { apiKey: '', baseUrl: 'https://api.tavily.com/search', enabled: false },
      qwenImage: {
        apiKey: 'qwen-key',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        enabled: true,
        model: 'qwen3-vl-flash',
      },
    },
    customTools: [],
  }
}

function imageTool() {
  return {
    definition: {
      function: { description: '分析图片', name: 'qwen_analyze_image', parameters: {} },
      type: 'function' as const,
    },
    execute: async () => ({ content: '图片结果' }),
    requiresImageAttachment: true,
  }
}
