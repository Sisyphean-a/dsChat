# dsChat

基于 Vue 3 + Vite 的 uTools 本地 AI 对话插件，现已支持多提供商接入，默认仍为 DeepSeek。当前支持：

- 侧边栏历史会话与新对话切换
- DeepSeek / OpenAI / Claude / MiniMax 独立配置持久化
- 当前 provider 模型快速切换
- uTools 生命周期驱动的 1 分钟会话恢复
- 多提供商 SSE/兼容流式输出
- Markdown 渲染与 `highlight.js` 代码高亮

## 开发

```bash
npm install
npm run dev
```

开发态通过 `plugin.json > development.main` 指向 `http://127.0.0.1:5173/index.html`，可在 uTools 开发者工具中直接预览。

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
- SSE 分帧解析与尾帧回收
