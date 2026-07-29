import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import viteConfig from '../vite.config'

describe('development server configuration', () => {
  it('keeps Vite and the uTools development entry on port 5123', async () => {
    const config = typeof viteConfig === 'function'
      ? await viteConfig({ command: 'serve', mode: 'test' } as never)
      : viteConfig
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'plugin.json'), 'utf8')) as {
      development?: { main?: string }
    }

    expect(config.server).toMatchObject({ port: 5123, strictPort: true })
    expect(manifest.development?.main).toBe('http://127.0.0.1:5123/index.html')
  })
})
