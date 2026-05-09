export interface AiToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface RuntimeCurrentTimeToolSettings {
  enabled: boolean
}

export interface RuntimeTavilySearchToolSettings {
  enabled: boolean
  apiKey: string
}

export interface RuntimeBuiltinToolSettings {
  currentTime: RuntimeCurrentTimeToolSettings
  tavilySearch: RuntimeTavilySearchToolSettings
}

export interface RuntimeCustomToolSettings {
  id: string
  name: string
  description: string
  enabled: boolean
  url: string
  method: 'GET' | 'POST'
  headers: Array<{ key: string; value: string }>
}

export interface ToolSettings {
  enabled: boolean
  maxToolRounds: number
  builtinTools: RuntimeBuiltinToolSettings
  customTools: RuntimeCustomToolSettings[]
}

export interface ToolExecutionContext {
  settings: ToolSettings
  signal?: AbortSignal
}

export interface ToolResult {
  content: string
  metadata?: Record<string, unknown>
}

export interface AiTool {
  definition: AiToolDefinition
  execute: (args: unknown, context: ToolExecutionContext) => Promise<ToolResult>
}

export interface NormalizedToolCall {
  id: string
  name: string
  argumentsJson: string
}

export type ProviderStreamDelta =
  | { type: 'content_delta'; content: string }
  | { type: 'reasoning_delta'; content: string }
  | { type: 'status'; status: string }
  | { type: 'tool_calls_done'; calls: NormalizedToolCall[] }
  | { type: 'done' }
