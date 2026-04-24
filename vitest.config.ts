import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['src/components/**/*.spec.ts', 'jsdom'],
      ['src/composables/useChatApp.spec.ts', 'jsdom'],
      ['src/composables/useBufferedTextStream.spec.ts', 'jsdom'],
      ['src/composables/useMessageListAutoScroll.spec.ts', 'jsdom'],
      ['src/services/markdown.spec.ts', 'jsdom'],
      ['src/services/streamingMarkdownSegments.spec.ts', 'jsdom'],
      ['src/services/theme.spec.ts', 'jsdom'],
      ['src/services/utools.spec.ts', 'jsdom'],
    ],
  },
}))
