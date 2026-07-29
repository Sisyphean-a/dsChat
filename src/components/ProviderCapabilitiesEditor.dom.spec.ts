import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { getDefaultProviderCapabilities } from '../constants/providerCapabilities'
import ProviderCapabilitiesEditor from './ProviderCapabilitiesEditor.vue'
import type { ProviderSettings } from '../types/chat'

describe('ProviderCapabilitiesEditor', () => {
  it('shows local tool calling as unavailable on responses protocol', () => {
    const wrapper = mount(ProviderCapabilitiesEditor, {
      props: {
        expanded: true,
        provider: 'openai',
        settings: createProviderSettings({
          capabilities: {
            ...getDefaultProviderCapabilities('openai'),
            nativeWebSearch: false,
            toolCalling: true,
          },
        }),
      },
    })

    const toolInput = wrapper.findAll('label.switch-row')
      .find((item) => item.text().includes('工具调用'))
      ?.find('input')
    expect(toolInput?.attributes('disabled')).toBeDefined()
    expect(toolInput?.element.checked).toBe(false)
  })

  it('clears native web search when switching to Chat Completions', async () => {
    const wrapper = mount(ProviderCapabilitiesEditor, {
      props: {
        expanded: true,
        provider: 'openai',
        settings: createProviderSettings(),
      },
    })

    await wrapper.get('select').setValue('chat_completions')

    expect(wrapper.emitted('updateCapability')).toContainEqual(['protocol', 'chat_completions'])
    expect(wrapper.emitted('updateCapability')).toContainEqual(['nativeWebSearch', false])
  })

  it('hides the fixed DeepSeek protocol', () => {
    const wrapper = mount(ProviderCapabilitiesEditor, {
      props: {
        expanded: true,
        provider: 'deepseek',
        settings: createProviderSettings({
          capabilities: getDefaultProviderCapabilities('deepseek'),
          model: 'deepseek-v4-pro',
        }),
      },
    })

    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('协议')
  })
})

function createProviderSettings(overrides: Partial<ProviderSettings> = {}): ProviderSettings {
  return {
    apiKey: 'sk-test',
    baseUrl: 'https://proxy.example.com/v1',
    capabilities: getDefaultProviderCapabilities('openai'),
    model: 'gpt-5.4',
    modelOptions: ['gpt-5.4'],
    reasoningLevel: 'medium',
    temperature: 1,
    ...overrides,
  }
}
