import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { createEmptyUsageStatistics } from '../services/usageStatistics'
import { buildDefaultSettings } from '../constants/providers'
import SettingsConversationSection from './SettingsConversationSection.vue'
import SettingsPanel from './SettingsPanel.vue'

describe('SettingsPanel', () => {
  it('shows usage totals and per-tool calls under the statistics navigation item', async () => {
    const statistics = createEmptyUsageStatistics()
    statistics.deepseek = { requests: 4, usageReports: 3, cacheReports: 2, inputTokens: 1234, outputTokens: 56, cacheHitTokens: 1000, cacheMissTokens: 234 }
    statistics.tools = { deepseek_search: 2, deepseek_fetch: 1, get_current_time: 3 }
    const wrapper = mount(SettingsPanel, {
      props: { isBrowserMode: true, open: true, saving: false, settings: buildDefaultSettings(), statistics },
    })
    await wrapper.findAll('.settings-nav-item').find(item => item.text() === '统计')!.trigger('click')
    expect(wrapper.get('#settings-statistics-title').text()).toBe('统计')
    const metrics = Object.fromEntries(wrapper.findAll('.usage-metrics > div').map(item => [item.get('dt').text(), item.get('dd').text()]))
    expect(metrics).toEqual({ 'API 请求': '4 次', '输入': '1,234 Token', '输出': '56 Token', '缓存命中': '1,000 Token', '缓存未命中': '234 Token' })
    expect(wrapper.findAll('.usage-tools tbody tr').map(row => row.text())).toEqual(['get_current_time3', 'deepseek_search2', 'deepseek_fetch1'])
    expect(wrapper.text()).toContain('6 次')
    expect(wrapper.text()).toContain('1 次请求未返回用量')
    expect(wrapper.text()).toContain('1 次用量缺少缓存明细')
    await wrapper.setProps({ statistics: createEmptyUsageStatistics(), statisticsError: '统计保存失败' })
    expect(wrapper.text()).toContain('暂无工具调用')
    expect(wrapper.get('[role="alert"]').text()).toBe('统计保存失败')
  })

  it('offers DeepSeek web access without another key input and forwards the switch', async () => {
    const wrapper = mount(SettingsPanel, {
      props: { isBrowserMode: true, open: true, saving: false, settings: buildDefaultSettings() },
    })
    await wrapper.findAll('.settings-nav-item')[3]?.trigger('click')
    const toggle = wrapper.get('input[aria-label="DeepSeek 网页搜索与抓取"]')
    const section = toggle.element.closest('section')!
    expect(section.textContent).toContain('复用 DeepSeek')
    expect(section.querySelectorAll('input')).toHaveLength(1)
    expect((toggle.element as HTMLInputElement).checked).toBe(true)
    expect(section.textContent).not.toContain('需要工具总开关')
    expect(section.textContent).not.toContain('按次计费')
    await toggle.setValue(false)
    expect(wrapper.emitted('edit')).toContainEqual([{ domain: 'tools', action: 'toggleBuiltin', tool: 'deepseekWeb', enabled: false }])
  })

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
