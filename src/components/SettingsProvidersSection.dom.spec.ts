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
})
