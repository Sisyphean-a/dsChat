import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatComposer from './ChatComposer.vue'

describe('ChatComposer', () => {
  it('keeps the textarea editable while sending', async () => {
    const wrapper = mount(ChatComposer, {
      props: {
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
})
