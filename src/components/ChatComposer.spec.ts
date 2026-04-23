import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatComposer from './ChatComposer.vue'
import type { MessageAttachment } from '../types/chat'

describe('ChatComposer', () => {
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
})
