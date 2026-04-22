# dsChat

基于 Vue 3 + Vite 的 uTools 本地 AI 对话插件，默认内置 DeepSeek，同时支持按模型配置接入多个兼容 `/chat/completions` 的提供商。当前支持：

- 侧边栏历史会话、新对话切换与删除
- DeepSeek 内置配置 + OpenAI / MiniMax / Kimi / 自定义模型扩展
- 当前活动模型快速切换与本地设置持久化
- 首条用户消息驱动的会话标题自动生成
- uTools 生命周期驱动的 1 分钟会话恢复
- 多提供商 SSE / 兼容流式输出
- 用户上滚释放、回到底部恢复的确定性自动滚动
- Markdown 渲染与 `highlight.js` 代码高亮

## 开发

```bash
npm install
npm run dev
```

开发态通过 `plugin.json > development.main` 指向 `http://127.0.0.1:5173/index.html`，可在 uTools 开发者工具中直接预览。

说明：

- 浏览器预览模式不接入 uTools 本地数据库，使用内存存储模拟会话与设置
- 标题生成请求、流式输出和大部分交互在浏览器预览模式下仍可直接调试
- 涉及插件生命周期恢复的行为，需在 uTools 内验证

## 构建

```bash
npm run build
node scripts/prepare-offline-package.mjs
```

生产构建输出到 `dist/`，随后脚本会生成一个最小离线打包目录 `package/`：

- `package/index.html` 与 `package/assets/*` 来自 `dist/`
- `package/plugin.json` 会移除开发态 `development` 配置，并把入口改为 `index.html`
- `package/logo.svg` 会复制根目录图标

在 uTools 开发者工具中导入 `package/plugin.json` 后，即可继续执行离线打包生成离线安装包。

## 测试

```bash
npm test
```

当前单测覆盖：

- 1 分钟会话重置规则
- SSE 分帧解析、尾帧回收与多提供商流式差异
- 停止生成 / 中断恢复 / 错误落盘
- 会话标题并发生成、标题持久化与后续消息保存不互相覆盖
- 自动滚动锁定 / 解锁状态机与快速滚轮场景
