import type { AiTool, ToolSettings } from '../ai/toolTypes'
import { currentTimeTool } from './currentTimeTool'
import { tavilySearchTool } from './tavilySearchTool'

const TOOL_REGISTRY: AiTool[] = [currentTimeTool, tavilySearchTool]

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

  return tools
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
