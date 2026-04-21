import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const scriptPath = resolve(process.cwd(), 'scripts/prepare-offline-package.mjs')
const tempDirs: string[] = []

afterEach(() => {
  tempDirs.forEach((dir) => rmSync(dir, { force: true, recursive: true }))
  tempDirs.length = 0
})

describe('prepare-offline-package', () => {
  it('creates a minimal offline plugin directory from dist output', () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), 'dschat-package-'))
    tempDirs.push(fixtureDir)

    mkdirSync(join(fixtureDir, 'dist', 'assets'), { recursive: true })
    writeFileSync(join(fixtureDir, 'dist', 'index.html'), '<!doctype html><title>dsChat</title>')
    writeFileSync(join(fixtureDir, 'dist', 'assets', 'index.js'), 'console.log("ready")')
    writeFileSync(
      join(fixtureDir, 'plugin.json'),
      JSON.stringify(
        {
          main: 'dist/index.html',
          logo: 'logo.png',
          development: {
            main: 'http://127.0.0.1:5173/index.html',
          },
          features: [
            {
              code: 'ds-chat',
              cmds: ['dschat'],
              explain: '多提供商 AI 对话插件',
            },
          ],
        },
        null,
        2,
      ),
    )
    writeFileSync(join(fixtureDir, 'logo.png'), 'fake-png-content')

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: fixtureDir,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(existsSync(join(fixtureDir, 'package', 'plugin.json'))).toBe(true)
    expect(readFileSync(join(fixtureDir, 'package', 'index.html'), 'utf8')).toContain('dsChat')
    expect(readFileSync(join(fixtureDir, 'package', 'logo.png'), 'utf8')).toContain('fake-png-content')

    const manifest = JSON.parse(
      readFileSync(join(fixtureDir, 'package', 'plugin.json'), 'utf8'),
    ) as Record<string, unknown>

    expect(manifest.main).toBe('index.html')
    expect(manifest.logo).toBe('logo.png')
    expect(manifest.development).toBeUndefined()
  })
})
