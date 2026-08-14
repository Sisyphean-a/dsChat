import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { buildDefaultSettings, createAddedModelDraft } from '../constants/providers'
import SettingsProvidersSection from './SettingsProvidersSection.vue'

describe('SettingsProvidersSection', () => {
  it('renders delete confirmation as an alert dialog overlay instead of an inline card', async () => {
    const settings = buildDefaultSettings()
    settings.customModels = [createAddedModelDraft('openai', [])]

    const wrapper = mount(SettingsProvidersSection, {
      props: {
        saving: false,
        settings,
      },
    })

    await wrapper.get('.danger-text').trigger('click')

    const dialog = wrapper.get('[role="alertdialog"]')

    expect(wrapper.find('.settings-grid [role="alertdialog"]').exists()).toBe(false)
    expect(dialog.text()).toContain('确认删除')
  })

  it('lets every provider API key be revealed independently', async () => {
    const settings = buildDefaultSettings()
    settings.deepseek.apiKey = 'deepseek-key'
    const customModel = createAddedModelDraft('openai', [])
    customModel.apiKey = 'openai-key'
    settings.customModels = [customModel]

    const wrapper = mount(SettingsProvidersSection, {
      props: {
        saving: false,
        settings,
      },
    })
    const visibilityButtons = wrapper.findAll('.api-key-visibility')

    expect(visibilityButtons).toHaveLength(2)
    await visibilityButtons[1]?.trigger('click')

    const apiKeyInputs = wrapper.findAll('.api-key-control input')
    expect(apiKeyInputs[0]?.attributes('type')).toBe('password')
    expect(apiKeyInputs[1]?.attributes('type')).toBe('text')
  })
})
