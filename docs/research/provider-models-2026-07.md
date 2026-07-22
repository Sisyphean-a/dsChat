# 内置模型提供商清单调研（2026-07-22）

## 范围和结论

本项目当前有一等配置的厂商只有 DeepSeek、OpenAI、Kimi（Moonshot）和 MiniMax；`custom` 只是一个可填写 OpenAI 兼容地址与模型 ID 的通道，不是厂商。因此，本次更新范围是这四家，不应把 Claude、Gemini、Qwen 等尚未接入的厂商误加为内置选项。

项目已有两种协议：`chat_completions` 和 `responses`。除 OpenAI 外，三家厂商的官方文档都提供 OpenAI Chat Completions 兼容调用，可复用现有适配器。OpenAI 的新模型应继续使用现有 Responses 适配器；官方虽仍支持 Chat Completions，但把 Responses API 作为新项目的推荐接口。[OpenAI Responses 迁移指南](https://developers.openai.com/api/docs/guides/migrate-to-responses)

| 厂商 | 应列入“常用/最新”的模型 ID | 现有 Chat Completions | 现有 Responses | 说明与官方依据 |
| --- | --- | --- | --- | --- |
| OpenAI | `gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-5.6-luna`、`gpt-5.6` | 是，但不提供原生联网状态展示 | 是，推荐 | `gpt-5.6` 是指向 `gpt-5.6-sol` 的别名；Sol、Terra、Luna 分别面向旗舰复杂任务、均衡成本与高吞吐。[模型目录](https://developers.openai.com/api/docs/models) [最新模型指引](https://developers.openai.com/api/docs/guides/latest-model) |
| DeepSeek | `deepseek-v4-pro`、`deepseek-v4-flash` | 是 | 否，官方未提供兼容说明 | 两个模型均为官方 Chat Completions 可用值，支持思考开关、工具调用和 JSON 输出。[创建对话补全](https://api-docs.deepseek.com/api/create-chat-completion) |
| Kimi / Moonshot | `kimi-k3`、`kimi-k2.7-code`、`kimi-k2.7-code-highspeed`、`kimi-k2.6` | 是 | 否，官方未提供兼容说明 | `kimi-k3` 是当前旗舰；K2.7 Code 的两个版本适合编码；`kimi-k2.6` 是仍在列的多模态选项。[模型列表](https://platform.kimi.com/docs/models) [K3 快速开始](https://platform.kimi.com/docs/guide/kimi-k3-quickstart) [创建对话补全](https://platform.kimi.com/docs/api/chat) |
| MiniMax | `MiniMax-M3`、`MiniMax-M2.7`、`MiniMax-M2.7-highspeed`、`MiniMax-M2.5`、`MiniMax-M2.5-highspeed` | 是 | 否，官方未提供兼容说明 | `MiniMax-M3` 是当前最新 M 系列；M2.7/M2.5 及高速版本仍是常用文本/Agent 选项。官方同时列出更早的 M2.1、M2 和 `M2-her`，不宜作为“常用/最新”默认项。[模型调用](https://platform.minimaxi.com/docs/guides/text-generation) |

## 接口兼容性

### OpenAI

- 应使用 `/responses`。项目已支持该接口，且可保留图片输入与 OpenAI 原生联网。
- 官方仍支持 `/chat/completions`，所以技术上可切换到项目的通用适配器；但该路径不能使用项目为 Responses 实现的原生联网流程。[OpenAI Responses 迁移指南](https://developers.openai.com/api/docs/guides/migrate-to-responses)
- 新增 5.6 系列时，原生联网模型白名单也必须同步更新；否则模型虽可聊天，却不能在界面中启用 OpenAI 联网。

### DeepSeek

- 官方接口为 OpenAI 兼容 Chat Completions，可直接使用现有 `{baseUrl}/chat/completions` 适配器。[创建对话补全](https://api-docs.deepseek.com/api/create-chat-completion)
- 不应使用 Responses 适配器，因为官方文档没有列出 `/responses` 兼容性。
- `deepseek-chat` 和 `deepseek-reasoner` 是旧 ID，官方公告称将在 2026-07-24 15:59 UTC 下线；不得再放进默认预设。[模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)

### Kimi / Moonshot

- 官方对话接口使用 OpenAI Chat Completions 形状，可直接使用现有通用适配器。[创建对话补全](https://platform.kimi.com/docs/api/chat)
- 不应使用 Responses 适配器，因为官方文档没有列出 `/responses` 兼容性。
- `kimi-latest` 已下线，旧 `kimi-k2` 系列也已下线；不要把它们作为新增或默认模型。[模型列表](https://platform.kimi.com/docs/models)

### MiniMax

- 官方提供 OpenAI 兼容调用方式，可直接使用现有通用 Chat Completions 适配器；部分高级 thinking 能力走 Anthropic 兼容路径，当前项目尚不支持该路径。[模型调用](https://platform.minimaxi.com/docs/guides/text-generation)
- 不应使用 Responses 适配器，因为官方文档没有列出 `/responses` 兼容性。

## 实施清单

1. 用上表替换四家厂商的默认模型选项；保持已保存的用户自定义模型 ID 不变。
2. OpenAI 预设新增 5.6 系列，并把三个具体模型加入原生联网白名单。
3. Kimi 的模型能力要区分：`kimi-k2.6` 继续允许图片输入；其余新预设不能仅凭名称假定具备同等多模态能力，应以官方能力表配置。
4. MiniMax 的高级 thinking 若要完整支持，需要单独增加 Anthropic 协议适配器；本轮只更新模型列表时不应伪装成已支持。

## 调研方法

仅使用各厂商官方 API 文档；检索日期为 2026-07-22。模型名称的选择标准是官方当前目录中仍可用、且适合作为界面“常用/最新”预设的 API ID，不是把全部历史兼容 ID 都列入下拉框。
