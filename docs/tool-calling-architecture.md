# Tool Calling Architecture Design

## 目标

为 dsChat 引入通用 Tool Calling 架构，让模型可以主动决定是否调用外部工具。Tavily 网页搜索是第一个工具，但架构必须支持继续添加 `fetch_url`、`calculator`、`local_doc_search`、`weather` 等工具。

首版实现原生路线 A：

1. 向支持工具调用的模型发送 `tools` 定义。
2. 模型自主返回 `tool_calls`。
3. 应用执行对应工具。
4. 将工具结果以 `role: "tool"` 消息回填给模型。
5. 循环直到模型输出最终回答。

不做伪自动搜索，不把 Tavily 当成模型提供商，不在 provider 请求代码中硬编码 Tavily 特判。

## 当前背景

现有聊天请求主入口在 `src/services/chatCompletion.ts`。普通供应商走 `/chat/completions`，OpenAI 单独走 `/responses`，SSE 解析、payload 创建、错误处理都集中在同一文件。

发送链路：

```text
useChatApp -> createChatAppSendActions -> streamAssistantReply -> streamChatCompletion
```

相关设置与类型：

- `src/types/chat.ts`
- `src/composables/chatAppSettings.ts`
- `src/components/SettingsPanel.vue`
- `src/constants/providers.ts`

## 设计原则

- Tool 是独立能力，不属于 provider。
- Provider Adapter 只处理供应商协议差异。
- Tool Runtime 只执行工具，不理解模型协议。
- Tool Orchestrator 负责多轮工具调用循环。
- 不支持原生 tools 的模型必须显式报错或禁用工具调用。
- 工具失败必须暴露为错误，不伪装成功。
- 首版限制最大工具轮数，默认 3。
- 首版只保存用户问题和最终助手回复，工具中间态可先不作为独立消息落盘。

## 目标目录

```text
src/services/ai/
  providerAdapter.ts
  providerAdapters/chatCompletionsAdapter.ts
  providerAdapters/openAiResponsesAdapter.ts
  toolOrchestrator.ts
  toolTypes.ts

src/services/tools/
  toolRegistry.ts
  tavilyClient.ts
  tavilySearchTool.ts
```

后续新增工具只应新增 `src/services/tools/*Tool.ts` 并注册到 `toolRegistry.ts`。

## 核心类型

新增 `src/services/ai/toolTypes.ts`：

```ts
export interface AiToolDefinition {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
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

export interface NormalizedToolCall { id: string; name: string; argumentsJson: string }
```

Provider 流事件统一成：

```ts
export type ProviderStreamDelta =
  | { type: 'content_delta'; content: string }
  | { type: 'reasoning_delta'; content: string }
  | { type: 'status'; status: string }
  | { type: 'tool_calls_done'; calls: NormalizedToolCall[] }
  | { type: 'done' }
```

`ToolSettings` 最终进入 `SettingsForm` / `SettingsDoc`，由设置面板编辑。

## Provider Adapter

新增 `ProviderAdapter` 隔离供应商差异：

```ts
export interface ProviderAdapter {
  supportsTools: boolean
  createRequestUrl: (baseUrl: string) => string
  createPayload: (input: ProviderPayloadInput) => Record<string, unknown>
  parseSseEvent: (event: string, state: ProviderStreamState) => ProviderStreamDelta[]
}
```

`chatCompletionsAdapter.ts` 适用于 DeepSeek、Kimi、MiniMax、custom 和其他 OpenAI-compatible `/chat/completions` 供应商。请求体在原有字段基础上增加 `tools` 与 `tool_choice: "auto"`。流式解析要累积 `delta.tool_calls`，当 `finish_reason: "tool_calls"` 或等价信号出现时输出 `tool_calls_done`。

工具上下文必须追加两类消息：assistant tool call 消息，以及带 `tool_call_id` 的 tool result 消息。

`openAiResponsesAdapter.ts` 首版可以存在但标记 `supportsTools: false`。OpenAI 当前走 `/responses`，协议不同，建议后续单独实现 Responses function tools，再决定是否移除现有内置 `web_search` 特判。

## Tool Orchestrator

新增 `src/services/ai/toolOrchestrator.ts`，由发送链路调用它，而不是直接调用 `streamChatCompletion`。

职责：

1. 根据 active provider 选择 adapter。
2. 从 registry 读取启用工具。
3. 发起模型请求。
4. 普通文本流式写入 assistant。
5. 遇到工具调用时暂停文本输出，执行工具。
6. 将 assistant tool call 消息和 tool result 消息追加进本轮上下文。
7. 再次请求模型。
8. 达到 `maxToolRounds` 后抛出错误。

核心循环：选择 adapter 与 tools，发起一轮 provider 请求；如果没有 tool calls 就返回最终文本；如果有 tool calls，就执行工具、追加 assistant tool call 与 tool result 消息，再进入下一轮；超过 `maxToolRounds` 时抛错。

## Tavily 工具

新增 `src/services/tools/tavilyClient.ts`，用原生 `fetch` 调用：

```text
POST https://api.tavily.com/search
Authorization: Bearer <tavilyApiKey>
Content-Type: application/json
```

默认 body：

```ts
{
  query,
  search_depth: 'basic',
  max_results: 5,
  include_answer: false,
  include_raw_content: false,
  include_favicon: true,
  topic
}
```

新增 `src/services/tools/tavilySearchTool.ts`，工具名为 `tavily_search`，参数包含：

- `query: string`，必填。
- `topic?: 'general' | 'news' | 'finance'`。
- `timeRange?: 'day' | 'week' | 'month' | 'year'`。

返回给模型的 `ToolResult.content` 使用紧凑 JSON 字符串，只保留 `query`、`results[].title`、`results[].url`、`results[].content`、`results[].score`。不要把 Tavily 原始响应完整塞回模型，避免 token 膨胀和无关字段污染上下文。

## 设置设计

`src/types/chat.ts` 增加 `ToolSettings`，并在 `SettingsForm` / `SettingsDoc` 增加 `toolSettings: ToolSettings`。

默认值：`{ enabled: false, tavilyApiKey: '', maxToolRounds: 3 }`。

`SettingsPanel.vue` 增加工具设置区：启用工具调用、Tavily API Key 输入框。最大工具轮数首版可固定为 3，不暴露 UI。

发送前校验：

- 启用工具调用时必须填写 Tavily API Key。
- 当前 provider adapter 不支持 tools 时给出明确错误。

## UI 状态

沿用现有 `ChatMessage.streamingStatus`。

建议状态文案：

- `正在判断是否需要调用工具...`
- `正在调用 tavily_search：<query>`
- `已获得 Tavily 搜索结果，正在继续思考...`
- `正在生成回答...`

不要展示完整模型内部思维链，只展示工具阶段状态和工具名。

## 错误处理

必须显式失败：

- Tavily key 缺失：发送前阻止。
- Tavily 401 / 429 / 5xx：抛出包含状态码的错误。
- 工具名不存在：抛出 `未知工具：<name>`。
- 工具参数不是合法 JSON：抛出参数解析错误。
- 超过最大工具轮数：抛出轮数错误。
- provider 不支持工具调用：抛出不支持错误。

不要 fallback 成“无搜索直接回答”，除非后续明确增加可关闭的回退策略。

## 测试计划

新增或调整测试：

- `tavilyClient.spec.ts`：请求 URL、header、body、错误处理、响应压缩。
- `tavilySearchTool.spec.ts`：参数校验、缺少 query 报错、topic/timeRange 映射。
- `toolOrchestrator.spec.ts`：无工具调用、单次工具调用、多工具调用、最大轮数、中断。
- adapter 测试：`delta.tool_calls` 累积，`finish_reason: "tool_calls"` 触发工具执行。
- `chatAppSendActions.spec.ts`：发送链路调用 orchestrator，工具状态写入 assistant，失败标记 error。

验证命令：

```bash
npm test
npm run test:dom
npm run typecheck
npm run check
```

## 分阶段实施

第一阶段：新增 `toolTypes.ts`、`toolRegistry.ts`、`toolOrchestrator.ts`，只注册 Tavily，保持无工具调用路径不变。

第二阶段：从 `chatCompletion.ts` 抽出 Chat Completions adapter，支持 `tools`、`tool_choice`、`tool_calls` 累积，DeepSeek 先打通。

第三阶段：新增 Tavily client 与 Tavily tool，接入 settings 校验。

第四阶段：`streamAssistantReply` 改为调用 orchestrator，确保停止生成能 abort 当前模型请求或 Tavily 请求。

第五阶段：评估 OpenAI Responses 内置 `web_search`。若保留，明确它是 OpenAI provider 内置能力；若统一，补 Responses adapter 后移除特判。

## 非目标

首版不做 MCP 协议、工具市场、并行工具调度优化、工具调用历史完整 UI、非原生 tools 模型 JSON 伪调用降级、后端代理服务。

## 交付验收

完成后应满足：

1. DeepSeek 或任一 Chat Completions 兼容模型可以主动调用 `tavily_search`。
2. Tavily 搜索结果会回填给模型，并用于最终回答。
3. UI 能显示工具调用阶段状态。
4. 工具关闭时现有聊天行为不变。
5. 工具失败时错误显式显示，不静默降级。
6. 后续新增工具只需新增 tool 文件并注册，不需要改 provider 主流程。
