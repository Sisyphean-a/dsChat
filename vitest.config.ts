import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default defineConfig(async (env) => {
  const resolvedViteConfig = typeof viteConfig === 'function'
    ? await viteConfig(env)
    : viteConfig

  return mergeConfig(resolvedViteConfig, {
    test: {
      environment: 'node',
      include: ['src/**/*.spec.ts'],
      exclude: [
        'src/**/*.dom.spec.ts',
        'scripts/**/*.spec.ts',
      ],
      maxWorkers: 1,
      pool: 'threads',
    },
  })
})
