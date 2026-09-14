import type { MessageAttachment } from '../../types/chat'
import type { AiTool, ToolSettings } from '../ai/toolTypes'
import { currentTimeTool } from './currentTimeTool'
import { tavilySearchTool } from './tavilySearchTool'
import { qwenImageTools } from './qwenImageTools'

const TOOL_REGISTRY: AiTool[] = [currentTimeTool, tavilySearchTool, ...qwenImageTools]

export function getRegisteredTools(): AiTool[] {
  return [...TOOL_REGISTRY]
}

export function getEnabledTools(settings: ToolSettings): AiTool[] {
  if (!settings.enabled) {
    return []
  }

  assertCustomToolsAreNotEnabled(settings)

  const tools: AiTool[] = []
  if (settings.builtinTools.currentTime.enabled) {
    tools.push(currentTimeTool)
  }

  if (settings.builtinTools.tavilySearch.enabled) {
    if (!settings.builtinTools.tavilySearch.apiKey.trim()) {
      throw new Error('请先填写 Tavily API Key。')
    }
    tools.push(tavilySearchTool)
  }

  const qwenImage = settings.builtinTools.qwenImage
  if (qwenImage?.enabled) {
    if (!qwenImage.apiKey.trim()) {
      throw new Error('请先填写阿里云 Qwen 图片工具 API Key。')
    }
    tools.push(...qwenImageTools)
  }

  return tools
}

/**
 * Flow: 解析已启用工具，再按本回合附件筛选需要图片的工具。
 * Rule: 依赖图片的工具只在当前回合带图时提供；筛选依据工具元数据而不是名称。
 */
export function getTurnTools(
  settings: ToolSettings,
  attachments: MessageAttachment[],
): AiTool[] {
  const tools = getEnabledTools(structuredClone(settings))
  if (attachments.length) {
    return tools
  }

  return tools.filter((tool) => !tool.requiresImageAttachment)
}

function assertCustomToolsAreNotEnabled(settings: ToolSettings): void {
  const enabledCustomTools = settings.customTools.filter((item) => item.enabled)
  if (!enabledCustomTools.length) {
    return
  }

  const labels = enabledCustomTools
    .map((item) => item.name.trim() || item.id)
    .join('、')
  throw new Error(`自定义工具暂未接入执行引擎：${labels}`)
}
