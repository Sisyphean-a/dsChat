import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.setOptions({
  breaks: true,
  gfm: true,
})

type HighlightJsInstance = typeof import('highlight.js/lib/core').default

const AUTO_DETECT_LANGUAGES = [
  'bash',
  'css',
  'javascript',
  'json',
  'markdown',
  'python',
  'sql',
  'typescript',
  'xml',
  'yaml',
] as const

const LANGUAGE_ALIASES: Record<string, string> = {
  cjs: 'javascript',
  html: 'xml',
  htms: 'xml',
  js: 'javascript',
  jsx: 'javascript',
  md: 'markdown',
  py: 'python',
  shell: 'bash',
  sh: 'bash',
  ts: 'typescript',
  tsx: 'typescript',
  vue: 'xml',
  xhtml: 'xml',
  yml: 'yaml',
  zsh: 'bash',
}

type CopyButtonState = 'idle' | 'success' | 'error'

let highlighterPromise: Promise<HighlightJsInstance> | null = null
const copyResetTimers = new WeakMap<HTMLButtonElement, number>()
const COPY_RESET_DELAY_MS = 1600
const COPY_BUTTON_CLASS = 'code-copy-button'
const COPY_STATUS_CLASS = 'code-copy-status'
const COPY_BUTTON_TEXT: Record<CopyButtonState, string> = {
  idle: '复制',
  success: '已复制',
  error: '复制失败',
}

export function renderMarkdown(content: string): string {
  const sanitized = DOMPurify.sanitize(marked.parse(content) as string)
  return decorateAnchorElements(sanitized)
}

export async function highlightCodeBlocks(container: HTMLElement): Promise<void> {
  const highlighter = await loadHighlighter()
  const blocks = container.querySelectorAll<HTMLElement>('pre code')
  blocks.forEach((block) => {
    const source = block.textContent ?? ''
    if (!source.trim()) {
      return
    }

    const requestedLanguage = resolveRequestedLanguage(block.className)
    const result = requestedLanguage
      ? highlighter.highlight(source, {
        ignoreIllegals: true,
        language: requestedLanguage,
      })
      : highlighter.highlightAuto(source, [...AUTO_DETECT_LANGUAGES])

    block.classList.add('hljs')
    if (result.language) {
      block.dataset.language = result.language
    }
    block.innerHTML = result.value
    upsertCopyButton(block, normalizeCopySource(source))
  })
}

async function loadHighlighter(): Promise<HighlightJsInstance> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter()
  }

  return highlighterPromise
}

async function createHighlighter(): Promise<HighlightJsInstance> {
  const [
    { default: highlighter },
    { default: bash },
    { default: css },
    { default: javascript },
    { default: json },
    { default: markdownLanguage },
    { default: python },
    { default: sql },
    { default: typescript },
    { default: xml },
    { default: yaml },
  ] = await Promise.all([
    import('highlight.js/lib/core'),
    import('highlight.js/lib/languages/bash'),
    import('highlight.js/lib/languages/css'),
    import('highlight.js/lib/languages/javascript'),
    import('highlight.js/lib/languages/json'),
    import('highlight.js/lib/languages/markdown'),
    import('highlight.js/lib/languages/python'),
    import('highlight.js/lib/languages/sql'),
    import('highlight.js/lib/languages/typescript'),
    import('highlight.js/lib/languages/xml'),
    import('highlight.js/lib/languages/yaml'),
  ])

  highlighter.registerLanguage('bash', bash)
  highlighter.registerLanguage('css', css)
  highlighter.registerLanguage('javascript', javascript)
  highlighter.registerLanguage('json', json)
  highlighter.registerLanguage('markdown', markdownLanguage)
  highlighter.registerLanguage('python', python)
  highlighter.registerLanguage('sql', sql)
  highlighter.registerLanguage('typescript', typescript)
  highlighter.registerLanguage('xml', xml)
  highlighter.registerLanguage('yaml', yaml)

  return highlighter
}

function resolveRequestedLanguage(className: string): string | null {
  const match = className.match(/\blanguage-([\w-]+)\b/i)
  if (!match?.[1]) {
    return null
  }

  const normalized = match[1].toLowerCase()
  return LANGUAGE_ALIASES[normalized] ?? normalized
}

function normalizeCopySource(source: string): string {
  return source.replace(/\r?\n$/, '')
}

function upsertCopyButton(block: HTMLElement, source: string): void {
  const pre = block.closest('pre')
  if (!pre) {
    return
  }

  const button = ensureCopyButton(pre)
  ensureCopyStatusNode(pre)
  button.dataset.copySource = source
}

function ensureCopyButton(pre: HTMLPreElement): HTMLButtonElement {
  const existed = pre.querySelector<HTMLButtonElement>(`:scope > .${COPY_BUTTON_CLASS}`)
  if (existed) {
    return existed
  }

  const button = document.createElement('button')
  button.type = 'button'
  button.className = COPY_BUTTON_CLASS
  button.setAttribute('aria-label', '复制代码')
  button.dataset.copyState = 'idle'
  button.dataset.copySource = ''
  button.textContent = COPY_BUTTON_TEXT.idle
  button.addEventListener('click', () => {
    void handleCopyClick(button)
  })
  pre.append(button)
  return button
}

function ensureCopyStatusNode(pre: HTMLPreElement): HTMLSpanElement {
  const existed = pre.querySelector<HTMLSpanElement>(`:scope > .${COPY_STATUS_CLASS}`)
  if (existed) {
    return existed
  }

  const status = document.createElement('span')
  status.className = COPY_STATUS_CLASS
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  status.setAttribute('aria-atomic', 'true')
  pre.append(status)
  return status
}

async function handleCopyClick(button: HTMLButtonElement): Promise<void> {
  const source = button.dataset.copySource ?? ''
  if (!source.trim()) {
    setCopyButtonState(button, 'error')
    announceCopyStatus(button, '当前代码块为空，无法复制。')
    scheduleCopyButtonReset(button)
    return
  }

  try {
    await copyText(source)
    setCopyButtonState(button, 'success')
    announceCopyStatus(button, '代码已复制到剪贴板。')
  } catch (error) {
    console.error('Copy code failed.', error)
    setCopyButtonState(button, 'error')
    announceCopyStatus(button, '复制失败，请检查剪贴板权限。')
  }

  scheduleCopyButtonReset(button)
}

async function copyText(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard API is not available.')
  }

  await navigator.clipboard.writeText(text)
}

function setCopyButtonState(button: HTMLButtonElement, state: CopyButtonState): void {
  button.dataset.copyState = state
  button.textContent = COPY_BUTTON_TEXT[state]
}

function announceCopyStatus(button: HTMLButtonElement, message: string): void {
  const pre = button.parentElement
  if (!pre) {
    return
  }

  const status = pre.querySelector<HTMLSpanElement>(`:scope > .${COPY_STATUS_CLASS}`)
  if (!status) {
    return
  }

  status.textContent = message
}

function scheduleCopyButtonReset(button: HTMLButtonElement): void {
  const activeTimer = copyResetTimers.get(button)
  if (activeTimer) {
    window.clearTimeout(activeTimer)
  }

  const timerId = window.setTimeout(() => {
    setCopyButtonState(button, 'idle')
    announceCopyStatus(button, '')
    copyResetTimers.delete(button)
  }, COPY_RESET_DELAY_MS)

  copyResetTimers.set(button, timerId)
}

function decorateAnchorElements(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return html
  }

  const documentNode = new DOMParser().parseFromString(html, 'text/html')
  const links = documentNode.body.querySelectorAll<HTMLAnchorElement>('a[href]')
  links.forEach((link) => {
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener noreferrer nofollow')
  })

  return documentNode.body.innerHTML
}
