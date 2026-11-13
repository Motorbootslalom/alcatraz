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

  it('zugeklappte Beispielansicht beim Aufbau: Sie folgt dem gewählten Aufbau und nimmt Namen an', async () => {
    const wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    const klappe = wrapper.find('details[data-vorschau]')
    expect(klappe.find('summary').text()).toContain('So sehen die Listen dieses Aufbaus aus')
    // Zugeklappt wird nichts gebaut.
    expect(klappe.find('.wkr-vorschau').exists()).toBe(false)
    ;(klappe.element as HTMLDetailsElement).open = true
    await klappe.trigger('toggle')
    const reiter = () => klappe.findAll('.wkr-vorschau-tabs button').map((b) => b.attributes('data-liste'))
    expect(reiter()).toContain('gate135')
    expect(klappe.findAll('.bogen')).toHaveLength(1)
    await wrapper.find('#ev-aufbau').setValue('berlin')
    expect(reiter()).toEqual(['steg', 'bstartziel', 'brechts', 'blinks'])
    await klappe.find('.bogen[data-liste="steg"] input.bk-wkr-input').setValue('A. Muster')
    expect(store.state.value.einteilung).toEqual({ par_2: { steg: 'A. Muster' } })
    wrapper.unmount()
  })

})
