# 注意事项

- 这是单包工作区；开始任务时先读本文件、`architecture/INDEX.md`、`architecture/packages/ds-chat.md`，再按需读 `requirements/CONTEXT.md` 的相关小节。
- `npm test` 只运行快速 Node 套件；提交前完整验证用 `npm run check`。组件和打包覆盖分别在 `npm run test:dom`、`npm run test:packaging`。
- 浏览器预览使用 `localStorage`；uTools 环境才会注册生命周期并按上传模式同步远端数据库。不要把两种模式混为一谈。
- Provider、协议和能力开关的权威配置在 `src/constants/providers.ts` 与 `src/constants/providerCapabilities.ts`；新增模型或协议时必须同时检查请求适配器和测试。
- `customTools` 是预留数据形状，当前设置规范化会清空它，执行引擎也不支持它；不要把自定义工具宣传为可用能力或静默跳过。
