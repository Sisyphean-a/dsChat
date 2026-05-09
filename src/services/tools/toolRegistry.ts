import type { AiTool, ToolSettings } from '../ai/toolTypes'
import { tavilySearchTool } from './tavilySearchTool'

const TOOL_REGISTRY: AiTool[] = [tavilySearchTool]

export function getRegisteredTools(): AiTool[] {
  return [...TOOL_REGISTRY]
}

export function getEnabledTools(settings: ToolSettings): AiTool[] {
  if (!settings.enabled) {
    return []
  }

  if (!settings.tavilyApiKey.trim()) {
    throw new Error('请先填写 Tavily API Key。')
  }

  return [tavilySearchTool]
}
