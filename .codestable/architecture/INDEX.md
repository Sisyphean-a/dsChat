# 架构索引

scope: workspace

## 范围地图

| 范围 | 职责 | 当前页面 | 代码锚点 |
| --- | --- | --- | --- |
| `package:ds-chat` | uTools 本地 AI 对话插件的界面、会话、配置、流式回复、Provider 与内置工具 | [ds-chat](packages/ds-chat.md) | `src/main.ts`、`src/App.vue`、`src/composables/useChatApp.ts` |

本仓库只有一个 Vite 包，不存在独立工作区包。`src/` 是运行时代码，`scripts/prepare-offline-package.mjs` 生成 uTools 离线导入目录，`plugin.json` 定义插件入口和开发态地址。

## 按主题定位

| 主题 | 先读 | 代码锚点 |
| --- | --- | --- |
| 界面与交互 | [ds-chat](packages/ds-chat.md) | `src/App.vue`、`src/components/`、`src/composables/useMessageListAutoScroll.ts` |
| 会话和存储 | [ds-chat](packages/ds-chat.md)、[领域上下文](../requirements/CONTEXT.md#会话与持久化) | `src/composables/chatAppConversationPersistence.ts`、`src/services/utools.ts` |
| 模型、协议和能力 | [ds-chat](packages/ds-chat.md)、[ADR-0001](../requirements/adrs/0001-provider-protocol-and-tool-boundaries.md) | `src/constants/providers.ts`、`src/constants/providerCapabilities.ts`、`src/services/ai/providerAdapter.ts` |
| 流式回复与工具 | [ds-chat](packages/ds-chat.md)、[ADR-0001](../requirements/adrs/0001-provider-protocol-and-tool-boundaries.md)、[ADR-0002](../requirements/adrs/0002-zai-image-tools.md) | `src/composables/chatAppReplyLifecycle.ts`、`src/services/ai/toolOrchestrator.ts`、`src/services/tools/` |
| 打包与运行 | [ds-chat](packages/ds-chat.md) | `plugin.json`、`vite.config.ts`、`scripts/prepare-offline-package.mjs` |

## 当前决定

- [ADR-0001：按 Provider 协议隔离请求，保留本地工具编排边界](../requirements/adrs/0001-provider-protocol-and-tool-boundaries.md)（accepted）
- [ADR-0002：将阿里云 Qwen 图片能力作为受控本地工具接入](../requirements/adrs/0002-zai-image-tools.md)（accepted）

没有跨包共享页：当前仅有一个运行包，尚无可复用的跨包契约。
