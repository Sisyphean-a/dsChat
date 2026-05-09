export interface AiToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface ToolSettings {
  enabled: boolean
  tavilyApiKey: string
  maxToolRounds: number
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
