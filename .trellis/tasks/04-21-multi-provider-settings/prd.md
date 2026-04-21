# 多提供商模型支持与设置页重构

## Goal
将当前仅支持 DeepSeek 的聊天配置体系重构为支持多提供商的架构，至少覆盖 DeepSeek、OpenAI（ChatGPT）、Claude、MiniMax，并同步升级设置界面；默认提供商仍为 DeepSeek。

## Requirements
- 设置数据结构支持“当前激活提供商 + 各提供商独立配置”，避免切换后覆盖不同平台的 API Key、Base URL、模型和采样参数。
- 聊天请求层从 DeepSeek 专用实现重构为多提供商兼容实现，至少支持 DeepSeek、OpenAI、Claude、MiniMax 的文本对话。
- 维持当前聊天主流程、会话持久化、标题生成、停止生成、恢复会话等现有行为不回退。
- 设置面板重构为多提供商配置工作台，允许切换激活提供商、编辑其模型与连接参数，并保持界面紧凑易读。
- 聊天输入区的模型选择能力需与当前激活提供商联动，默认仍落在 DeepSeek 的默认模型。
- 兼容已有旧版设置文档，旧用户升级后无需手动清空配置即可继续使用。

## Acceptance Criteria
- [ ] 首次启动或无历史设置时，默认提供商为 DeepSeek，默认模型与 Base URL 指向 DeepSeek。
- [ ] 设置界面可以切换 DeepSeek、OpenAI、Claude、MiniMax，并分别保存各自配置。
- [ ] 在聊天发送与标题生成流程中，会按当前激活提供商的配置发起请求。
- [ ] 原有会话发送、停止、恢复、删除、标题生成与主题切换行为保持可用。
- [ ] 旧版仅含扁平 `apiKey/baseUrl/model/temperature/theme` 的设置文档能自动迁移到新结构。
- [ ] 自动化测试覆盖核心多提供商行为，`build` 与 `test` 通过。

## Technical Notes
- 主要涉及 `src/types/chat.ts`、`src/constants/`、`src/composables/chatAppSettings.ts`、`src/composables/useChatApp.ts`、`src/services/`、`src/components/SettingsPanel.vue`、`src/components/ModelPicker.vue` 及相关测试。
- 提供商抽象优先复用 OpenAI Chat Completions 兼容接口；DeepSeek/OpenAI/MiniMax 走兼容层，Claude 走其 OpenAI SDK compatibility 入口。
- MiniMax 需兼容其 `reasoning_split` / `reasoning_details` 流式格式；Claude 兼容层不暴露详细思考内容时不做伪造回退。
