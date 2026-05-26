import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default defineConfig(async (env) => {
  const resolvedViteConfig = typeof viteConfig === 'function'
    ? await viteConfig(env)
    : viteConfig

  return mergeConfig(resolvedViteConfig, {
    test: {
      environment: 'jsdom',
      include: ['src/**/*.dom.spec.ts'],
      maxWorkers: 1,
      pool: 'threads',
    },
  })
})
