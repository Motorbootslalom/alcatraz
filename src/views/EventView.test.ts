import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EventView from './EventView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { setLocale } from '../i18n'

describe('Veranstaltung', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
  })
  afterEach(() => setLocale('de'))

  it('die WKR-Einteilung steht nicht mehr hier; beim Aufbau bleibt nur der Weg zu den Einstellungen', () => {
    const wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    expect(wrapper.find('.wkr-einteilung').exists()).toBe(false)
    expect(wrapper.find('.wkr-tabelle').exists()).toBe(false)
    expect(wrapper.find('.bogen').exists()).toBe(false)
    const hinweis = wrapper.find('[data-hinweis="wkr"]')
    expect(hinweis.text()).toContain('Wer an welcher Liste sitzt')
    expect(hinweis.find('a').attributes('href')).toBe('#/einstellungen?wkr')
    expect(hinweis.find('a').text()).toBe('Einstellungen → WKR-Einteilung')
    wrapper.unmount()
  })

  it('der Verweis spricht auch Englisch', () => {
    setLocale('en')
    const wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    expect(wrapper.find('[data-hinweis="wkr"] a').text()).toBe('Settings → Judges')
    wrapper.unmount()
  })
})
