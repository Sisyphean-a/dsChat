import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/**/*.spec.ts'],
    maxWorkers: 1,
    pool: 'threads',
  },
}))
