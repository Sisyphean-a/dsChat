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
├── composables/                  应用状态、回合计划、宿主生命周期、会话持久化与设置规范化
├── constants/                    默认配置、Provider/模型画像、能力和存储策略
├── services/
│   ├── ai/                       HTTP、协议适配、SSE、流式/非流式请求、工具编排
│   ├── tools/                    当前时间、Tavily、工具注册表与本回合工具解析
│   ├── utools.ts                 本地/远端文档的选择与同步策略
│   └── *.ts                      Markdown、主题、附件、链接等独立服务
├── types/                        聊天和 uTools 边界类型
└── utils/                        无副作用的数据构造、排序和小型状态判断
```

### UI 与应用状态

`App.vue` 组装 `SidebarPanel`、`MessageBubble`、`ChatComposer`、两个 `ModelPicker` 和 `SettingsPanel`。`useChatApp.ts` 持有响应式状态，负责初始化、当前会话切换及设置动作的接线；uTools 进入/退出由 `utoolsHostLifecycle.ts` 接管。

- 主界面是嵌入 uTools 的小窗工作区；视觉调整以紧凑、专注和快速提问为准，不按独立全屏网页或营销页扩张内容与留白。
- uTools 的划词入口 `ask-ds` 使用 `over` 命令；进入参数中的选中文本只会填入草稿第二行起的三反引号代码块，首行留给用户补充问题，光标定位在首行，绝不自动发送。
- 发送期间或已有消息时禁止切换 Provider 配置，避免同一会话的请求上下文和配置混用。
- 首个用户消息创建会话；标题先使用默认值，随后由独立的非流式请求异步更新。
- `useMessageListAutoScroll.ts` 用显式状态机处理用户上滚后的自动滚动锁定；不要在组件中临时滚动到底部。
- 推理只在消息的「过程」面板展示：推理条目保存完整推理文本，不得压缩成摘要或截断；展开态按内容自然展开（`process-panel` 用 `grid-template-rows` 动画），不加固定高度上限或内部滚动。工具条目仍只展示阶段状态、工具名和结果条数这类摘要文本（`toolTimelineNarration.ts`），不展示原始参数与工具结果原文。
- 设置面板的各领域子页面只发结构化 `SettingsEdit`；`SettingsPanel.vue` 统一转发一个 `edit` 事件，`useChatApp.ts` 只暴露 `applySettingsEdit`，设置动作模块负责按领域分发，避免字段级事件穿过组合根。

### 会话与持久化

`ChatMessage` 是展示和持久化的统一消息；它可带附件、推理内容、流式状态、工具轨迹和过程时间线。`ConversationDoc` 保存消息、标题、创建/更新时间和当时的 Provider 配置 ID。`chatAppConversationPersistence.ts` 对每个会话串行写入，避免回复结束、标题生成和删除之间的覆盖。

`services/utools.ts` 始终先保存本地副本：

- 浏览器预览只读写 `localStorage`。
- uTools 的 `local-only` 不上传任何内容；`settings-only` 只同步设置；`all-data` 同步设置、会话和恢复用 session。
- 设置本地缺失时才从远端恢复并回写本地；切出 `all-data` 时清理远端会话和 session。

`utoolsHostLifecycle.ts` 只在 uTools 环境注册宿主回调：初始化完成前收到的进入事件先缓存、就绪后补发；进入时恢复上次会话，并把 `ask-ds` 划词写成草稿代码块（`utils/askDsPayload.ts`）；离开时中断进行中的回复并记录离开时间。再次进入时仅在“对话”设置的会话恢复时长内恢复上次会话，超时后从新会话开始。

### 设置与 Provider

`SettingsForm` 由 `chatAppSettings.ts` 规范化，旧持久化形状通过 `settingsDocMigration.ts` 迁移。全局系统提示词属于设置，不从属于单一 Provider。DeepSeek 是内置默认配置；OpenAI、Kimi、MiniMax 与 custom 作为可添加配置。每份 Provider 设置都包含模型、地址、密钥、温度、思考等级与能力开关。

Provider 与模型事实集中在 `constants/providerProfiles.ts`；新增或调整模型时只改画像并同步适配器与测试：

- `constants/providerProfiles.ts`：Provider 可选协议、能力默认值、图片输入策略、温度范围、模型表（预设标记、非预设模型、前缀族）与模型别名、思考档案（可选等级、默认等级、请求形状）。
- `constants/providers.ts`：Provider 展示信息（名称、文档、占位符、默认 Base URL）与设置草稿；默认模型与默认能力来自画像。
- `constants/providerCapabilities.ts`：能力归一化、协议互斥校正（切换协议时关闭不可用能力）、图片/联网/工具支持判断。
- `constants/thinking.ts`：按画像生成可选思考等级与请求参数。
- `services/ai/providerAdapter.ts`：按 `chat_completions` 或 `responses` 选择适配器。

模型 ID 解析忽略大小写并先按别名归一到当前模型；别名只影响能力与参数解析，不改写已保存的模型 ID。

详见 [ADR-0001](../../requirements/adrs/0001-provider-protocol-and-tool-boundaries.md)。

### 回复、Provider 与工具

- `chatAppReplyLifecycle.ts` 是发送、重试、停止和中断的唯一回复生命周期；先持久化占位助手消息，再消费事件，最后写入终态。停止通过同一个 `AbortController` 传播到网络或工具调用；失败不会伪装为成功。
- `chatAppTurnPlan.ts` 在每次请求开始时消费已解析工具，形成本回合的附件去向、Provider 消息、系统提示词和编排判断；生命周期只消费计划。`AiTool` 通过元数据声明图片附件要求，不再用工具名称前缀承载路由规则。
- 时效性 Tavily 查询依靠工具说明要求模型先调用 `get_current_time`，再用时间结果构造搜索条件；普通问题不调用时间工具，也不引入时间信息。

- `providerStream.ts`：负责 HTTP 状态、SSE 缓冲、协议错误和空结果判断，不理解会话 UI。
- `providerCompletion.ts`：只用于非流式标题生成。
- `providerAdapters/chatCompletionsAdapter.ts`：处理兼容 Chat Completions 的文本、推理、图片和函数工具调用；请求地址和图片附件在序列化边界再次校验。
- `providerAdapters/openAiResponsesAdapter.ts`：处理 Responses 事件和 OpenAI 原生 `web_search` 状态；它不参与本地工具轮次，且复用 HTTPS endpoint 与图片附件校验。
- `toolOrchestrator.ts`：只执行工具轮次——接收本回合工具与执行上下文，创建多轮上下文，追加 assistant tool-call 与 tool result 消息，把单次工具执行失败作为工具结果交回模型继续本轮，阻止重复调用，并让最终回答缺失显式失败；不再解析工具配置。
- `services/ai/systemPrompt.ts`：在每次回复启动时根据原生联网、直接图片输入、当前工具定义和当前附件动态组装默认系统提示词，再追加用户自定义规则。
- `services/conversationTitle.ts`：标题请求只使用首条用户文字和“是否带图片”提示，不把图片 Data URL 发给标题模型；模型返回请求补充内容等非标题文本时回退到用户问题或“图片分析”。
- `services/tools/toolRegistry.ts`：登记 `get_current_time`、`tavily_search` 以及三个受控阿里云 Qwen 图片工具，并用 `getTurnTools` 解析本回合可用工具（凭据校验加按附件元数据筛选图片工具）。Qwen 工具只接收模型给出的 `attachment_id` 和任务参数，由运行时从当前附件解析图片，不接受模型提供的 URL、路径或 Base64；它们仅在支持本地 Chat Completions 工具轮次的配置中启用。`customTools` 是预留数据形状，设置规范化会清空它；执行引擎仍会拒绝任何非空且启用的自定义工具，因为没有执行实现。

## 关键不变量

- Provider 请求、流式事件和工具执行必须分别位于 `services/ai/` 与 `services/tools/`；UI 与 composable 不得拼接协议请求。
- Provider 与模型的能力、协议、思考等级、温度与默认模型只能来自 `constants/providerProfiles.ts`；不得在设置归一化、界面或适配器中重复硬编码，也不得从模型名称猜测能力。
- 本回合工具只由 `services/tools/toolRegistry.ts` 的 `getTurnTools` 解析；`toolOrchestrator` 只执行传入的工具与执行上下文。
- 回复请求的附件筛选和图片能力描述必须读取 `AiTool` 元数据；工具名称（包括 `qwen_` 名称）只作为模型协议标识，不得用于路由或执行策略判断。
- 标题生成不得把图片 Data URL 或图片附件直接交给文本标题模型；图片问题优先从用户文字生成标题，标题模型输出拒答或请求补充内容时必须回退为稳定的本地标题。
- 回复启动时快照 Provider 配置、思考等级、工具设置与全局系统提示词；后续编辑设置不能改变正在进行的回复。动态提示词不得暴露图片 Data URL 或其他内部附件内容。
- 工具总开关开启时，必须至少有一个内置工具，且当前配置必须支持本地工具调用，或是支持原生联网的 Responses 配置；不支持时在发送前报错。实际本地工具轮次只在前者运行。
- 所有 Provider、Tavily 和阿里云 Qwen 外部服务地址必须使用 HTTPS，且不得在 URL 中携带用户名或密码；Qwen 图片工具基础地址可填写至 `/compatible-mode/v1`，运行时自动追加 `/chat/completions`，也兼容完整 endpoint；图片 Data URL 在 Qwen 工具和 Provider 序列化边界都要校验类型、Base64 格式和大小。
- 当前 Provider 不支持直接图片输入时，Provider 消息必须剥离图片附件；若当前回合提供了阿里云 Qwen 图片工具，则优先走 Qwen 工具轮次并始终剥离 Provider 图片附件，原始附件仅通过工具执行上下文保留。Qwen 请求使用 HTTPS、非流式 `qwen3-vl-flash` 视觉接口；工具执行遵循统一中止信号，用户可通过停止结束本轮，执行失败按统一工具失败规则作为工具结果回传模型。
- 本地工具调用按照单轮顺序执行；单次工具执行失败（外部服务、传输错误或工具自身参数校验失败）不终止本轮，失败原因作为工具结果回传模型并保留失败轨迹；模型给出的工具参数无法解析、同一签名重复出现、未知工具或空最终回答均应显式失败。
- 仅最终文本回答是成功回复；工具或推理阶段本身不是成功结果。

## 验证

- 快速逻辑：`npm test`
- 组件和 Markdown DOM：`npm run test:dom`
- 离线打包脚本：`npm run test:packaging`
- 类型、全部测试与构建：`npm run check`
