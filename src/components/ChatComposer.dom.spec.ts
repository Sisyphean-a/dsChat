import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ChatComposer from './ChatComposer.vue'
import type { MessageAttachment } from '../types/chat'

describe('ChatComposer', () => {
  it('focuses the textarea when the focus signal is set on mount', async () => {
    const wrapper = mount(ChatComposer as any, {
      attachTo: document.body,
      props: {
        attachments: [],
        canSend: true,
        focusSignal: 1,
        isSending: false,
        modelValue: '',
        sendDisabled: false,
      },
    })

    await nextTick()

    expect(document.activeElement).toBe(wrapper.get('textarea').element)
  })

  it('moves the caret to the start when requested', async () => {
    const wrapper = mount(ChatComposer, {
      attachTo: document.body,
      props: {
        attachments: [],
        canSend: true,
        focusPosition: 'start',
        focusSignal: 1,
        isSending: false,
        modelValue: '\n```\nselected text\n```',
        sendDisabled: false,
      },
    })

    await nextTick()

    const textarea = wrapper.get('textarea').element as HTMLTextAreaElement
    expect(textarea.selectionStart).toBe(0)
    expect(textarea.selectionEnd).toBe(0)
    wrapper.unmount()
  })

  it('moves the caret to the end when focus is requested', async () => {
    const wrapper = mount(ChatComposer, {
      attachTo: document.body,
      props: {
        attachments: [],
        canSend: true,
        focusSignal: 1,
        isSending: false,
        modelValue: '```\nselected text\n```\n',
        sendDisabled: false,
      },
    })

    await nextTick()

    const textarea = wrapper.get('textarea').element as HTMLTextAreaElement
    expect(textarea.selectionStart).toBe(textarea.value.length)
    expect(textarea.selectionEnd).toBe(textarea.value.length)
    wrapper.unmount()
  })

  it('keeps the textarea editable while sending', async () => {
    const wrapper = mount(ChatComposer, {
      props: {
        attachments: [],
        canSend: true,
        isSending: true,
        modelValue: '正在输入',
        sendDisabled: true,
      },
    })

    const textarea = wrapper.get('textarea')
    expect(textarea.attributes('disabled')).toBeUndefined()

    await textarea.setValue('等待响应时继续编辑')

    expect(wrapper.emitted('update:modelValue')).toEqual([['等待响应时继续编辑']])
  })

  it('blocks send events while sending even if Enter is pressed', async () => {
    const wrapper = mount(ChatComposer, {
      props: {
        attachments: [],
        canSend: true,
        isSending: true,
        modelValue: '等待响应',
        sendDisabled: true,
      },
    })

    await wrapper.get('textarea').trigger('keydown', {
      key: 'Enter',
      shiftKey: false,
    })

    expect(wrapper.emitted('send')).toBeUndefined()
  })

  it('keeps Enter available for input method candidate selection', async () => {
    const wrapper = mount(ChatComposer, {
      props: {
        attachments: [],
        canSend: true,
        isSending: false,
        modelValue: 'ni',
        sendDisabled: false,
      },
    })
    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
    })
    Object.defineProperty(event, 'isComposing', { value: true })

    wrapper.get('textarea').element.dispatchEvent(event)
    await nextTick()

    expect(event.defaultPrevented).toBe(false)
    expect(wrapper.emitted('send')).toBeUndefined()
  })

  it('keeps focus inside an image preview and restores it after Escape', async () => {
    const wrapper = mount(ChatComposer, {
      attachTo: document.body,
      props: {
        attachments: [{
          id: 'img-1',
          type: 'image',
          name: 'preview.png',
          mimeType: 'image/png',
          size: 128,
          width: 100,
          height: 80,
          dataUrl: 'data:image/png;base64,xxx',
        }],
        canSend: true,
        isSending: false,
        modelValue: '',
        sendDisabled: false,
      },
    })
    const trigger = wrapper.get('.attachment-preview-button')
    ;(trigger.element as HTMLButtonElement).focus()

    await trigger.trigger('click')
    await nextTick()
    await nextTick()

    expect(document.activeElement).toBe(wrapper.get('.image-preview-close').element)
    expect(wrapper.get('.image-preview-details').text()).toBe('100 × 80')

    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    await nextTick()
    await nextTick()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })

  it('allows sending with image attachments even when text is empty', async () => {
    const attachments: MessageAttachment[] = [{
      id: 'img-1',
      type: 'image',
      name: 'demo.png',
      mimeType: 'image/png',
      size: 128,
      width: 100,
      height: 80,
      dataUrl: 'data:image/png;base64,xxx',
    }]

    const wrapper = mount(ChatComposer, {
      props: {
        attachments,
        canSend: true,
        isSending: false,
        modelValue: '',
        sendDisabled: false,
      },
    })

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('send')).toEqual([[]])
  })

  it('emits addImages when pasting an image into textarea', async () => {
    const wrapper = mount(ChatComposer, {
      props: {
        attachments: [],
        canSend: false,
        isSending: false,
        modelValue: '',
        sendDisabled: false,
      },
    })

    const imageFile = new File(['x'], 'paste.png', { type: 'image/png' })
    await wrapper.get('textarea').trigger('paste', {
      clipboardData: {
        items: [{
          kind: 'file',
          type: 'image/png',
          getAsFile: () => imageFile,
        }],
      },
      preventDefault: () => undefined,
    })

    expect(wrapper.emitted('addImages')).toEqual([[[imageFile]]])
  })

  it('restores utools main window after selecting images', async () => {
    const wrapper = mount(ChatComposer, {
      props: {
        attachments: [],
        canSend: false,
        isSending: false,
        modelValue: '',
        sendDisabled: false,
      },
    })
    const originalUtools = window.utools
    const showMainWindow = vi.fn()
    window.utools = {
      db: {
        promises: {
          allDocs: vi.fn(),
          get: vi.fn(),
          put: vi.fn(),
          remove: vi.fn(),
        },
      },
      onPluginEnter: vi.fn(),
      onPluginOut: vi.fn(),
      showMainWindow,
    }

    try {
      const inputWrapper = wrapper.get('input[type="file"]')
      const input = inputWrapper.element as HTMLInputElement
      const imageFile = new File(['x'], 'pick.png', { type: 'image/png' })
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [imageFile],
      })

      await inputWrapper.trigger('change')

      expect(showMainWindow).toHaveBeenCalledTimes(1)
    } finally {
      window.utools = originalUtools
    }
  })

  it('emits thinking level updates', async () => {
    const wrapper = mount(ChatComposer, {
      props: {
        attachments: [],
        canSend: true,
        isSending: false,
        modelValue: 'hi',
        sendDisabled: false,
        thinkingLevel: 'high',
        thinkingOptions: [
          { label: '关闭', value: 'off' },
          { label: '高', value: 'high' },
        ],
      },
    })

    await wrapper.get('.thinking-level-label').trigger('click')
    expect(wrapper.find('.thinking-level-picker .picker-panel').exists()).toBe(true)
    await wrapper.get('.thinking-level-picker .picker-option').trigger('click')

    expect(wrapper.emitted('updateThinkingLevel')).toEqual([['off']])
  })

  it('resets textarea height after draft is cleared', async () => {
    const wrapper = mount(ChatComposer, {
      props: {
        attachments: [],
        canSend: true,
        isSending: false,
        modelValue: '长文本',
        sendDisabled: false,
      },
    })

    const textareaWrapper = wrapper.get('textarea')
    const textarea = textareaWrapper.element as HTMLTextAreaElement
    let mockScrollHeight = 260

    Object.defineProperty(textarea, 'scrollHeight', {
      configurable: true,
      get: () => mockScrollHeight,
    })

    textarea.value = 'line\n'.repeat(20)
    await textareaWrapper.trigger('input')
    expect(textarea.style.height).toBe('200px')
    expect(textarea.style.overflowY).toBe('auto')

    mockScrollHeight = 260
    await wrapper.setProps({ modelValue: '' })
    await nextTick()

    expect(textarea.style.height).toBe('44px')
    expect(textarea.style.overflowY).toBe('hidden')
  })
})
