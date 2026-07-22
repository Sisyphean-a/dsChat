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
})

function createProviderSettings(overrides: Partial<ProviderSettings> = {}): ProviderSettings {
  return {
    apiKey: 'sk-test',
    baseUrl: 'https://proxy.example.com/v1',
    capabilities: getDefaultProviderCapabilities('openai'),
    model: 'gpt-5.4',
    modelOptions: ['gpt-5.4'],
    temperature: 1,
    ...overrides,
  }
}
