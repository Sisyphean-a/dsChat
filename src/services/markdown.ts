import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import typescript from 'highlight.js/lib/languages/typescript'
import { marked } from 'marked'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('python', python)
hljs.registerLanguage('typescript', typescript)

marked.setOptions({
  breaks: true,
  gfm: true,
})

export function renderMarkdown(content: string): string {
  return DOMPurify.sanitize(marked.parse(content) as string)
}

export function highlightCodeBlocks(container: HTMLElement): void {
  const blocks = container.querySelectorAll<HTMLElement>('pre code')
  blocks.forEach((block) => hljs.highlightElement(block))
}
