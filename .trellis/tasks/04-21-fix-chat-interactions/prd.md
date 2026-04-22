# 修复聊天交互与恢复问题

## Goal
修复聊天界面的会话恢复、流式滚动、重复状态提示、思考内容展示与历史删除能力，同时保持现有视觉风格不变。

## Requirements
- 修复插件在响应中被关闭后，重新打开会话卡死在“生成中”的问题。
- 流式输出时消息区域应自动滚动到底部，不要求用户手动拖动。
- “生成中”状态只保留一处展示。
- 支持展示思考型模型返回的思考内容，并尽量复用现成实现思路。
- 历史消息支持删除，并同步更新当前会话状态。

## Acceptance Criteria
- [x] 关闭并重新打开插件后，未完成的响应不会永久卡死，界面可继续使用。
- [x] 流式回复期间，消息列表会自动跟随到底部。
- [x] 页面上不会同时出现两个“生成中”提示。
- [x] 思考型模型的思考内容可见且不破坏当前样式体系。
- [x] 侧边栏支持删除历史会话，删除后状态与持久化一致。

## Completed Implementation
- 已修复流式中断恢复、停止生成、标题写入竞争、历史删除与会话恢复相关问题。
- 已将消息列表自动滚动补强为“底部跟随 + 用户上滑释放 + 高度变化补偿”的确定性行为。
- 已把 assistant 流式可见文本改为基于 chunk 节奏的 UI 层释放，不影响原始消息状态和持久化。
- 已将 assistant 富文本渲染拆为独立组件，并对普通文本与完整 fenced code block 采用分段渲染策略。
- 已验证大面积遮罩 reveal / 整块 markdown 进入动画会导致闪烁和可读性退化，因此已明确回退。

## Current Boundary
- 流式优化不能破坏 markdown、代码高亮、滚动控制和可读性。
- 任何 reveal 动效都必须以“内容稳定优先”为前提，出现闪烁就应直接禁用。
- 代码块与普通文本必须分策略处理，不能继续共享同一套视觉试验逻辑。

## Next Plan
- P1: 为 assistant 富文本分段器补充更细粒度测试，覆盖列表、引用块、混合 prose/code 的长响应。
- P1: 观察 chunk-aware 文本释放在真实供应商返回中的主观观感，决定是否需要进一步调节节奏参数。
- P2: 若继续探索“帷幕感”，只在稳定的 prose 子段上做小范围实验，不再对整块 markdown DOM 做遮罩或重入动画。
- P2: 评估是否将 prose 分段从“完成代码块切分”升级为“段落级切分”，前提是不引入闪烁和重排。
- P3: 若真实体验仍偏“跳字”，考虑把 reveal 逻辑前移到更小的纯文本节点，而不是在 markdown 容器层做动画。

## Technical Notes
- 主要修改 `src/composables/useChatApp.ts`、`src/composables/useMessageListAutoScroll.ts`、`src/composables/useBufferedTextStream.ts`、`src/components/MessageBubble.vue`、`src/components/AssistantMessageContent.vue`、`src/services/streamingMarkdownSegments.ts` 及相关测试。
- 已新增 `streamingMarkdownSegments.spec.ts` 与 `useBufferedTextStream.spec.ts` 覆盖流式显示与 markdown 分段行为。
- 样式实验结论：整块 markdown reveal 不稳定，当前保留最小样式增量，不改变整体视觉语言。
