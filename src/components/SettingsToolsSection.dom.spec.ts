import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { buildDefaultSettings } from '../constants/providers'
import SettingsToolsSection from './SettingsToolsSection.vue'

describe('SettingsToolsSection', () => {
  it('links the Qwen image tool to the official API key page', () => {
    const wrapper = mount(SettingsToolsSection, {
      props: {
        settings: buildDefaultSettings(),
      },
    })

    const qwenImageTool = wrapper.findAll('.builtin-tool-item')
      .find((tool) => tool.text().includes('qwen_image'))
    const officialLink = qwenImageTool?.get('a')

    expect(officialLink?.text()).toBe('官网')
    expect(officialLink?.attributes('href')).toBe('https://help.aliyun.com/zh/model-studio/get-api-key')
  })

  it('uses the compact Qwen setup hint, a full-width base URL, and revealable API keys', async () => {
    const wrapper = mount(SettingsToolsSection, {
      props: {
        settings: buildDefaultSettings(),
      },
    })
    const qwenImageTool = wrapper.findAll('.builtin-tool-item')
      .find((tool) => tool.text().includes('qwen_image'))

    expect(qwenImageTool?.text()).toContain('基础地址填写到 compatible-mode/v1即可')
    expect(qwenImageTool?.text()).not.toContain('应用会自动追加 chat/completions')
    expect(qwenImageTool?.find('.qwen-image-base-url').exists()).toBe(true)
    expect(wrapper.findAll('.api-key-visibility')).toHaveLength(2)

    await wrapper.findAll('.api-key-visibility')[1]?.trigger('click')
    expect(qwenImageTool?.get('input[placeholder="DashScope API Key"]').attributes('type')).toBe('text')
  })
})
