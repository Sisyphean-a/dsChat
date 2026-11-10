// 插件应用运行期需要长期保留、且不进入 uTools 同步数据库的本地数据，
// 统一放在 utools.getPluginLocalDataPath() 返回的插件本地数据目录中。
// 该目录随插件应用存在，市场更新后仍保留，且不会跨设备同步。
const fs = require('node:fs')
const path = require('node:path')

const ROOT_DIR = resolveRootDir()
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/

function resolveRootDir() {
  if (typeof utools.getPluginLocalDataPath === 'function') {
    return utools.getPluginLocalDataPath()
  }
  return path.join(utools.getPath('userData'), 'ds-chat-local')
}

// Rule: 只接受以 / 分隔的相对路径，禁止绝对路径、.. 与盘符，解析后必须仍在根目录内。
function resolvePath(relativePath) {
  const segments = String(relativePath ?? '')
    .split('/')
    .filter((segment) => segment && segment !== '.')
  if (!segments.length || segments.some((segment) => segment === '..' || !SAFE_SEGMENT.test(segment))) {
    throw new Error('非法的记忆文件路径')
  }
  return path.join(ROOT_DIR, ...segments)
}

function readText(relativePath) {
  try {
    return fs.readFileSync(resolvePath(relativePath), 'utf8')
  } catch {
    return null
  }
}

function writeText(relativePath, text) {
  try {
    const target = resolvePath(relativePath)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, String(text ?? ''), 'utf8')
    return true
  } catch {
    return false
  }
}

function appendText(relativePath, text) {
  try {
    const target = resolvePath(relativePath)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.appendFileSync(target, String(text ?? ''), 'utf8')
    return true
  } catch {
    return false
  }
}

function listFiles(relativeDir) {
  try {
    return fs
      .readdirSync(resolvePath(relativeDir))
      .filter((name) => SAFE_SEGMENT.test(name))
      .sort()
  } catch {
    return []
  }
}

window.dsChatMemory = { rootDir: ROOT_DIR, readText, writeText, appendText, listFiles }
