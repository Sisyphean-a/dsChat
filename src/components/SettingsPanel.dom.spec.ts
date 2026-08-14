import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { buildDefaultSettings } from '../constants/providers'
import SettingsConversationSection from './SettingsConversationSection.vue'
import SettingsPanel from './SettingsPanel.vue'

describe('SettingsPanel', () => {
  it('shows a save failure inside the settings dialog', () => {
    const wrapper = mount(SettingsPanel, {
      props: {
        error: '设置保存失败。',
        isBrowserMode: true,
        open: true,
        saving: false,
        settings: buildDefaultSettings(),
      },
    })

    expect(wrapper.get('[role="alert"]').text()).toBe('设置保存失败。')
  })

  it('shows and forwards the conversation settings', async () => {
    const wrapper = mount(SettingsPanel, {
      props: {
        isBrowserMode: false,
        open: true,
        saving: false,
        settings: buildDefaultSettings(),
      },
    })

    await wrapper.findAll('.settings-nav-item')[1]?.trigger('click')

    expect(wrapper.get('textarea').attributes('placeholder')).toBe('例如：言简意赅，避免大段回复')
    expect(wrapper.text()).toContain('控制离开 uTools 多久后以新对话打开。')
    await wrapper.get('textarea').setValue('言简意赅，避免大段回复')
    wrapper.findComponent(SettingsConversationSection).vm.$emit('edit', {
      domain: 'conversation',
      field: 'utoolsSessionIdleTimeoutMinutes',
      value: 5,
    })
    await nextTick()

    expect(wrapper.emitted('edit')).toEqual([
      [{ domain: 'conversation', field: 'systemPrompt', value: '言简意赅，避免大段回复' }],
      [{ domain: 'conversation', field: 'utoolsSessionIdleTimeoutMinutes', value: 5 }],
    ])
  })

  it('does not close the dialog when Escape cancels active input composition', async () => {
    const wrapper = mount(SettingsPanel, {
      props: {
        isBrowserMode: true,
        open: true,
        saving: false,
        settings: buildDefaultSettings(),
      },
    })
    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Escape',
    })
    Object.defineProperty(event, 'isComposing', { value: true })

    wrapper.get('[role="dialog"]').element.dispatchEvent(event)
    await nextTick()

    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('focuses the dialog and returns focus to its opener after Escape', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()

    const wrapper = mount(SettingsPanel, {
      attachTo: document.body,
      props: {
        isBrowserMode: true,
        open: false,
        saving: false,
        settings: buildDefaultSettings(),
      },
    })

    await wrapper.setProps({ open: true })
    await nextTick()
    await nextTick()

    expect(document.activeElement).toBe(wrapper.get('.ghost-action').element)

    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toEqual([[]])

    await wrapper.setProps({ open: false })
    await nextTick()
    await nextTick()

    expect(document.activeElement).toBe(opener)
    wrapper.unmount()
    opener.remove()
  })
})
