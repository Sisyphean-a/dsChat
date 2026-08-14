# ADR-0002：将阿里云 Qwen 图片能力作为受控本地工具接入

status: accepted
scope: package:ds-chat

## 背景

dsChat 需要在不支持直接图片输入的 Provider 上处理当前消息中的截图，并为 OCR、错误截图诊断和通用图片分析提供清晰边界。阿里云百炼的 Qwen 视觉模型通过 OpenAI 兼容 Chat Completions 提供 `qwen3-vl-flash`，可以复用现有 HTTP、工具编排和附件边界；不引入 MCP Client，避免连接生命周期、动态工具发现和额外权限边界。同时，模型不应获得本地文件、Data URL 或任意远程图片源的控制权。

## 决定

1. 不引入 MCP Client；将阿里云 Qwen 能力实现为 `services/tools/` 下的三个受控普通 `AiTool`：`qwen_extract_text_from_screenshot`、`qwen_diagnose_error_screenshot`、`qwen_analyze_image`。
2. 模型只能传 `attachment_id` 和任务参数。运行时从当前回复的附件执行上下文解析图片，并在工具边界校验 Data URL、图片类型和大小；模型不能传 URL、路径或 Base64 作为图片源。
3. 阿里云请求由独立 `qwenClient` 负责，基础地址默认使用 `https://dashscope.aliyuncs.com/compatible-mode/v1`，运行时自动追加 `/chat/completions`；默认模型为 `qwen3-vl-flash`，使用 Bearer API Key 和非流式多模态 Chat Completions，并显式关闭 Qwen 思考模式以优先保证图片工具响应速度。工具执行沿用现有中止、超时、轨迹和显式失败契约，Qwen 图片工具单次执行上限为 60 秒。
4. Qwen 工具只对支持本地 Chat Completions 工具轮次且已配置阿里云 DashScope API Key 的设置开放。当前回合提供 Qwen 图片工具时优先走该工具轮次，并从 Provider 消息剥离图片，即使 Provider 能力配置声称支持图片；工具执行上下文保留原始附件。Responses 原生联网不转成本地图片工具轮次。
5. 旧版本的 `zaiImage` 设置只迁移“是否启用”意图，不迁移 Z.AI API Key 或服务地址；用户必须重新配置阿里云 DashScope API Key。这样避免把旧供应商凭据发送到新供应商。
6. 每次回复启动时动态构造系统提示词，说明当前回合真实的联网、直接图片和工具能力；系统提示词只暴露附件 ID，不暴露图片内容。

## 备选方案

- **继续使用 Z.AI**：不能满足当前对供应商和模型的变更需求，且已有视觉请求延迟不符合使用体验。
- **引入 MCP Client**：能力发现和复用更通用，但会扩大运行时生命周期、权限和连接管理边界，超出当前三个固定图片能力的必要范围。
- **让模型直接传图片 URL、路径或 Data URL**：调用实现简单，但会允许模型越过本地附件边界读取任意资源，无法满足隐私和可控数据流要求。
- **把图片能力写进 Provider 或回复生命周期**：会把 Qwen 协议和图片任务分支污染通用 Provider/会话流程，无法复用现有工具轨迹与超时策略。

## 后果

- 新增图片任务优先扩展受控 `AiTool` 和 `qwenClient`，不得绕过附件执行上下文。
- Qwen 工具不能用于 Responses 本地工具轮次，也不能替代 Provider 原生联网搜索。
- 用户配置的阿里云服务地址会接收 API Key 和选定图片；Qwen、Tavily 和 Provider 地址统一强制 HTTPS，使用自定义网关时责任由用户配置承担。
- 旧 Z.AI 设置不会继续作为运行时能力；迁移后需要填写新的 DashScope API Key。
- 未来若引入 MCP，必须重新评估连接生命周期、权限范围和工具发现契约，不能把它作为当前工具的隐式实现细节。

## 代码锚点

- `src/services/tools/qwenClient.ts`
- `src/services/tools/qwenImageTools.ts`
- `src/services/tools/toolRegistry.ts`
- `src/services/ai/toolOrchestrator.ts`
- `src/services/ai/systemPrompt.ts`
- `src/composables/chatAppReplyLifecycle.ts`
- `src/composables/chatAppRequestPreparation.ts`
- `src/composables/chatAppToolSettings.ts`

## 相关决定与历史

- [ADR-0001：按 Provider 协议隔离请求，保留本地工具编排边界](0001-provider-protocol-and-tool-boundaries.md)
- `.codestable/history/2026-08.md`
