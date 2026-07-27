import { getCurrentScope, nextTick, onScopeDispose, watch } from 'vue'
import type { Ref } from 'vue'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function useModalFocus(options: {
  close: () => void
  container: Ref<HTMLElement | null>
  initialFocus: Ref<HTMLElement | null>
  isOpen: () => boolean
}) {
  let returnFocus: HTMLElement | null = null

  watch(options.isOpen, async (isOpen) => {
    if (isOpen) {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      await nextTick()
      options.initialFocus.value?.focus()
      return
    }

    const target = returnFocus
    returnFocus = null
    await nextTick()
    target?.focus()
  }, { flush: 'post' })

  if (getCurrentScope()) {
    onScopeDispose(() => {
      returnFocus = null
    })
  }

  return { handleModalKeydown }

  function handleModalKeydown(event: KeyboardEvent): void {
    if (!options.isOpen()) {
      return
    }

    if (event.isComposing || event.keyCode === 229) {
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      options.close()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const container = options.container.value
    if (!container) {
      return
    }

    const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    if (!focusable.length) {
      event.preventDefault()
      container.focus()
      return
    }

    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first || !last) {
      return
    }

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
      return
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
}
