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

let highlighterPromise: Promise<HighlightJsInstance> | null = null

export function renderMarkdown(content: string): string {
  return DOMPurify.sanitize(marked.parse(content) as string)
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
