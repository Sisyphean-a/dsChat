# ADR-0001：按 Provider 协议隔离请求，保留本地工具编排边界

status: accepted
scope: package:ds-chat

## 背景

dsChat 同时需要兼容 OpenAI 风格的 Chat Completions、OpenAI Responses，以及可扩展的本地工具。不同 Provider 的请求地址、负载、SSE 事件和能力不相同；若把这些差异放进回复生命周期或工具实现，新增协议会污染会话逻辑，且容易把 Provider 原生联网误当成本地工具调用。

## 决定

1. 用 `ProviderAdapter` 表示协议差异。适配器负责创建 URL、headers、body，维护流状态并把 SSE 转为统一事件；`providerAdapter.ts` 按能力配置选择 Chat Completions 或 Responses。
2. `ProviderStream` 只处理一次请求的 HTTP/SSE 生命周期，`ProviderCompletion` 只处理非流式标题请求。两者都不维护会话状态或执行工具。
3. `ToolOrchestrator` 只在启用了本地工具且当前配置支持 Chat Completions 工具调用时运行。它追加 assistant tool-call 和 tool result 上下文，顺序执行调用，并把最终文本交给回复生命周期。
4. OpenAI Responses 的 `web_search` 是 Provider 原生联网：由 Responses 适配器放进请求并转成状态事件，不进入本地工具注册表和工具轮次。
5. 内置工具从 `services/tools/toolRegistry.ts` 显式登记。当前支持当前时间和 Tavily；`customTools` 是预留数据形状，当前规范化会清空它，执行引擎对任何非空且启用的配置仍必须显式拒绝，不能静默忽略。

## 备选方案

- **在 `useChatApp` 或回复生命周期中按 Provider 写分支**：会把协议细节、会话状态和 UI 错误处理耦在一起，新增 Provider 的影响面大。
- **把 Tavily 或原生联网写成 Provider 特判**：工具无法独立验证或扩展，且会混淆本地工具和 Provider 原生能力。
- **让不支持函数工具的模型输出 JSON 来模拟调用**：模型输出不能形成可靠协议；失败会被误当成回答，且违背显式失败原则。
- **把 Responses 当作本地函数工具适配器**：当前实现没有 Responses function-tool 轮次支持，声明支持会制造错误能力。

## 后果

- 新增 Chat Completions 兼容 Provider 通常更新注册表/能力档案，不应改会话或工具主流程。
- 新增协议需要一个适配器及其流测试；它明确支持本地工具前，不能进入本地编排。
- 新增内置工具实现后注册即可；它仍必须遵守中止、错误和工具轨迹契约。
- 工具流程受总时限、单次 Provider 请求时限与重复调用保护约束；这些保护失败会显式显示为失败，而非降级回答。

## 代码锚点

- `src/services/ai/providerAdapter.ts`
- `src/services/ai/providerStream.ts`
- `src/services/ai/providerCompletion.ts`
- `src/services/ai/providerAdapters/chatCompletionsAdapter.ts`
- `src/services/ai/providerAdapters/openAiResponsesAdapter.ts`
- `src/services/ai/toolOrchestrator.ts`
- `src/services/tools/toolRegistry.ts`
- `src/composables/chatAppReplyLifecycle.ts`

## 相关历史

- `.codestable/history/2026-07.md`
- 历史设计证据：Git 中的 `.codestable/features/2026-05-24-tool-calling/tool-calling-design.md`
