import { copyFileSync, cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const BUILD_DIR = 'dist'
const ENTRY_FILE = 'index.html'
const LOGO_FILE = 'logo.png'
const MANIFEST_FILE = 'plugin.json'
const PACKAGE_DIR = 'package'

main()

function main() {
  const rootDir = process.cwd()
  const buildDir = resolve(rootDir, BUILD_DIR)
  const buildEntryPath = resolve(buildDir, ENTRY_FILE)
  const manifestPath = resolve(rootDir, MANIFEST_FILE)
  const logoPath = resolve(rootDir, LOGO_FILE)
  const packageDir = resolve(rootDir, PACKAGE_DIR)

  ensurePathExists(buildEntryPath, '缺少 dist/index.html，请先执行 npm run build。')
  ensurePathExists(manifestPath, '缺少根目录 plugin.json，无法生成离线打包清单。')
  ensurePathExists(logoPath, '缺少根目录 logo.png，无法生成离线打包目录。')
  resetPackageDir(rootDir, packageDir)

  cpSync(buildDir, packageDir, { recursive: true })
  copyFileSync(logoPath, join(packageDir, LOGO_FILE))

  const manifest = readPluginManifest(manifestPath)
  const offlineManifest = createOfflinePluginManifest(manifest)
  writeFileSync(join(packageDir, MANIFEST_FILE), `${JSON.stringify(offlineManifest, null, 2)}\n`)

  console.info(`离线打包目录已生成：${packageDir}`)
}

function ensurePathExists(path, message) {
  if (!existsSync(path)) {
    throw new Error(message)
  }
}

function resetPackageDir(rootDir, packageDir) {
  const expectedDir = resolve(rootDir, PACKAGE_DIR)
  if (packageDir !== expectedDir) {
    throw new Error(`拒绝清理非预期目录：${packageDir}`)
  }

  rmSync(packageDir, { force: true, recursive: true })
}

function readPluginManifest(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function createOfflinePluginManifest(manifest) {
  const { development: _development, main: _main, ...rest } = manifest
  return {
    ...rest,
    logo: LOGO_FILE,
    main: ENTRY_FILE,
  }
}
