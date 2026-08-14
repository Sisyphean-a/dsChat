# ds-chat

scope: package:ds-chat

## 职责与公开边界

这是一个 Vue 3 + Vite 的 uTools 本地 AI 对话插件。它负责：展示和维护对话、维护本地模型配置、将统一消息转换为 Provider 请求、逐步展示回复，以及在已启用且受支持时编排内置工具。

对外入口只有两类：

- uTools：`plugin.json` 定义 `dist/index.html` 入口、插件指令和开发态地址；`src/services/utools.ts` 是对 uTools 数据库和生命周期的隔离层。
- 构建产物：`npm run build` 产出 `dist/`；`scripts/prepare-offline-package.mjs` 只把该目录、根目录 `logo.png` 和脱离开发态配置的 `plugin.json` 写入 `package/`。

应用内部的组合根是 `src/App.vue` → `src/composables/useChatApp.ts`。组件不能直接调用 Provider 或存储服务；它们通过 `useChatApp` 暴露的状态和动作工作。

## 结构

```text
src/
├── App.vue                       组合界面、消息列表自动滚动和设置面板
├── components/                   纯展示与用户输入组件
├── composables/                  应用状态、会话持久化、回复生命周期和设置规范化
├── constants/                    默认配置、Provider 注册表、能力和存储策略
├── services/
│   ├── ai/                       HTTP、协议适配、SSE、流式/非流式请求、工具编排
│   ├── tools/                    当前时间、Tavily 与工具注册表
│   ├── utools.ts                 本地/远端文档的选择与同步策略
│   └── *.ts                      Markdown、主题、附件、链接等独立服务
├── types/                        聊天和 uTools 边界类型
└── utils/                        无副作用的数据构造、排序和小型状态判断
```

### UI 与应用状态

`App.vue` 组装 `SidebarPanel`、`MessageBubble`、`ChatComposer`、两个 `ModelPicker` 和 `SettingsPanel`。`useChatApp.ts` 持有响应式状态，负责初始化、uTools 进入/退出、当前会话切换及设置动作的接线。

- 主界面是嵌入 uTools 的小窗工作区；视觉调整以紧凑、专注和快速提问为准，不按独立全屏网页或营销页扩张内容与留白。
- uTools 的划词入口 `ask-ds` 使用 `over` 命令；进入参数中的选中文本只会填入草稿第二行起的三反引号代码块，首行留给用户补充问题，光标定位在首行，绝不自动发送。
- 发送期间或已有消息时禁止切换 Provider 配置，避免同一会话的请求上下文和配置混用。
- 首个用户消息创建会话；标题先使用默认值，随后由独立的非流式请求异步更新。
- `useMessageListAutoScroll.ts` 用显式状态机处理用户上滚后的自动滚动锁定；不要在组件中临时滚动到底部。

### 会话与持久化

`ChatMessage` 是展示和持久化的统一消息；它可带附件、推理内容、流式状态、工具轨迹和过程时间线。`ConversationDoc` 保存消息、标题、创建/更新时间和当时的 Provider 配置 ID。`chatAppConversationPersistence.ts` 对每个会话串行写入，避免回复结束、标题生成和删除之间的覆盖。

`services/utools.ts` 始终先保存本地副本：

- 浏览器预览只读写 `localStorage`。
- uTools 的 `local-only` 不上传任何内容；`settings-only` 只同步设置；`all-data` 同步设置、会话和恢复用 session。
- 设置本地缺失时才从远端恢复并回写本地；切出 `all-data` 时清理远端会话和 session。

`useChatApp.ts` 仅在 uTools 环境注册生命周期：离开时中断进行中的回复并记录离开时间；再次进入时仅在“对话”设置的会话恢复时长内恢复上次会话，超时后从新会话开始。

### 设置与 Provider

`SettingsForm` 由 `chatAppSettings.ts` 规范化，旧持久化形状通过 `settingsDocMigration.ts` 迁移。全局系统提示词属于设置，不从属于单一 Provider。DeepSeek 是内置默认配置；OpenAI、Kimi、MiniMax 与 custom 作为可添加配置。每份 Provider 设置都包含模型、地址、密钥、温度、思考等级与能力开关。

Provider 注册表和能力档案是唯一来源：

- `constants/providers.ts`：可添加的 Provider、默认 Base URL、模型预设、温度/图片等模型级差异。
- `constants/providerCapabilities.ts`：每个 Provider 可选的协议，以及原生联网、图片与本地工具编排能力。
- `constants/thinking.ts`：按供应商、协议和模型声明可选思考等级，并生成对应请求参数。
- `services/ai/providerAdapter.ts`：按 `chat_completions` 或 `responses` 选择适配器。

详见 [ADR-0001](../../requirements/adrs/0001-provider-protocol-and-tool-boundaries.md)。

### 回复、Provider 与工具

`chatAppProduction.ts` 把生产依赖组装一次：`ProviderStream`、`ProviderCompletion`、标题请求器与 `ToolOrchestrator`。`chatAppReplyLifecycle.ts` 是发送、重试、停止和中断的唯一回复生命周期：先持久化占位助手消息，再消费事件，最后写入终态。停止通过同一个 `AbortController` 传播到网络或工具调用；失败不会伪装为成功。

- `providerStream.ts`：负责 HTTP 状态、SSE 缓冲、协议错误和空结果判断，不理解会话 UI。
- `providerCompletion.ts`：只用于非流式标题生成。
- `providerAdapters/chatCompletionsAdapter.ts`：处理兼容 Chat Completions 的文本、推理、图片和函数工具调用；请求地址和图片附件在序列化边界再次校验。
- `providerAdapters/openAiResponsesAdapter.ts`：处理 Responses 事件和 OpenAI 原生 `web_search` 状态；它不参与本地工具轮次，且复用 HTTPS endpoint 与图片附件校验。
- `toolOrchestrator.ts`：针对本地工具创建多轮上下文，追加 assistant tool-call 与 tool result 消息，阻止重复调用，并让最终回答缺失显式失败；工具执行上下文可携带当前回合附件。
- `services/ai/systemPrompt.ts`：在每次回复启动时根据原生联网、直接图片输入、当前工具定义和当前附件动态组装默认系统提示词，再追加用户自定义规则。
- `services/conversationTitle.ts`：标题请求只使用首条用户文字和“是否带图片”提示，不把图片 Data URL 发给标题模型；模型返回请求补充内容等非标题文本时回退到用户问题或“图片分析”。
- `services/tools/toolRegistry.ts`：登记 `get_current_time`、`tavily_search` 以及三个受控阿里云 Qwen 图片工具。Qwen 工具只接收模型给出的 `attachment_id` 和任务参数，由运行时从当前附件解析图片，不接受模型提供的 URL、路径或 Base64；它们仅在支持本地 Chat Completions 工具轮次的配置中启用。`customTools` 是预留数据形状，设置规范化会清空它；执行引擎仍会拒绝任何非空且启用的自定义工具，因为没有执行实现。

## 关键不变量

- Provider 请求、流式事件和工具执行必须分别位于 `services/ai/` 与 `services/tools/`；UI 与 composable 不得拼接协议请求。
- 标题生成不得把图片 Data URL 或图片附件直接交给文本标题模型；图片问题优先从用户文字生成标题，标题模型输出拒答或请求补充内容时必须回退为稳定的本地标题。
- 回复启动时快照 Provider 配置、思考等级、工具设置与全局系统提示词；后续编辑设置不能改变正在进行的回复。动态提示词不得暴露图片 Data URL 或其他内部附件内容。
- 工具总开关开启时，必须至少有一个内置工具，且当前配置必须支持本地工具调用，或是支持原生联网的 Responses 配置；不支持时在发送前报错。实际本地工具轮次只在前者运行。
- 所有 Provider、Tavily 和阿里云 Qwen 外部服务地址必须使用 HTTPS，且不得在 URL 中携带用户名或密码；Qwen 图片工具基础地址可填写至 `/compatible-mode/v1`，运行时自动追加 `/chat/completions`，也兼容完整 endpoint；图片 Data URL 在 Qwen 工具和 Provider 序列化边界都要校验类型、Base64 格式和大小。
- 当前 Provider 不支持直接图片输入时，Provider 消息必须剥离图片附件；若当前回合提供了阿里云 Qwen 图片工具，则优先走 Qwen 工具轮次并始终剥离 Provider 图片附件，原始附件仅通过工具执行上下文保留。Qwen 请求使用 HTTPS、非流式 `qwen3-vl-flash` 视觉接口；图片工具单次执行允许 60 秒，普通工具仍为 20 秒，失败、超时和空结果必须显式失败。
- 本地工具调用按照单轮顺序执行；同一签名重复出现、超时、参数错误、未知工具或空最终回答均应显式失败。
- 仅最终文本回答是成功回复；工具或推理阶段本身不是成功结果。

## 验证

- 快速逻辑：`npm test`
- 组件和 Markdown DOM：`npm run test:dom`
- 离线打包脚本：`npm run test:packaging`
- 类型、全部测试与构建：`npm run check`
