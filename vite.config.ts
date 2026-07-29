import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { codeInspectorPlugin } from 'code-inspector-plugin'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: './',
  server: {
    port: 5123,
    strictPort: true,
  },
  plugins: [
    vue(),
    ...(command === 'serve'
      ? [codeInspectorPlugin({ bundler: 'vite' })]
      : []),
  ],
  test: {
    environment: 'jsdom',
    fileParallelism: false,
    globals: true,
  },
}))
