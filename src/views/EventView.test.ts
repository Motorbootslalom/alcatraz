import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import EventView from './EventView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { loadState } from '../persistenz/storage'
import { setLocale } from '../i18n'

function ansicht(store: Store) {
  return mount(EventView, { global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
}

describe('Veranstaltung: WKR-Einteilung', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
  })
  afterEach(() => setLocale('de'))

  it('zeigt je Parcours der Verzahnung eine Spalte mit ihren Klassen und verweist dorthin', () => {
    const wrapper = ansicht(store)
    const panel = wrapper.find('.wkr-einteilung')
    expect(panel.find('h2').text()).toBe('WKR-Einteilung')
    const kopf = panel.findAll('thead th').map((th) => th.text())
    expect(kopf[1]).toContain('Parcours 1')
    expect(kopf[1]).toContain('Klasse 3')
    expect(kopf[2]).toContain('Parcours 2')
    expect(kopf[2]).toContain('Klasse 7')
    expect(panel.find('a[href="#/verzahnung"]').text()).toBe('Verzahnung')
    // Die Klassen werden hier nicht noch einmal abgefragt.
    expect(panel.findAll('input[type="checkbox"], select, button')).toEqual([])
    wrapper.unmount()
  })

  it('speichert Namen je Liste und Parcours; die Felder sind beschriftet', async () => {
    const wrapper = ansicht(store)
    const feld = wrapper.find('input[aria-label="Name für Steg, Parcours 1"]')
    expect(feld.exists()).toBe(true)
    await feld.setValue('Muster')
    await wrapper.find('input[aria-label="Name für Steg, Parcours 2"]').setValue('Beispiel')
    expect(store.state.value.einteilung).toEqual({ par_1: { steg: 'Muster' }, par_2: { steg: 'Beispiel' } })
    // Der Stand liegt im Browser: nach einem Neuladen sind die Namen wieder da.
    await nextTick()
    expect(loadState()?.einteilung).toEqual(store.state.value.einteilung)
    wrapper.unmount()
    const wieder = ansicht(createStore())
    expect((wieder.find('input[aria-label="Name für Steg, Parcours 1"]').element as HTMLInputElement).value).toBe('Muster')
    wieder.unmount()
  })

  it('ein Strich statt Feld, wenn keine Klasse des Parcours die Liste hat', () => {
    const wrapper = ansicht(store)
    // Mann-über-Bord gibt es erst ab Klasse 4: Parcours 1 fährt E bis 3.
    expect(wrapper.find('input[data-feld="par_1|mueb"]').exists()).toBe(false)
    expect(wrapper.find('input[data-feld="par_2|mueb"]').exists()).toBe(true)
    const zeile = wrapper.findAll('tbody tr').find((tr) => tr.find('input[data-feld="par_2|mueb"]').exists())!
    expect(zeile.find('.wkr-entfaellt').text()).toContain('–')
    wrapper.unmount()
  })

  it('Enter springt ins nächste Feld desselben Parcours, am Ende zum nächsten Parcours', async () => {
    const wrapper = ansicht(store)
    const felder = wrapper.findAll('input[data-feld^="par_1|"]')
    await felder[0].trigger('keydown', { key: 'Enter' })
    expect(document.activeElement).toBe(felder[1].element)
    await felder.at(-1)!.trigger('keydown', { key: 'Enter' })
    expect((document.activeElement as HTMLElement).dataset.feld).toMatch(/^par_2\|/)
    wrapper.unmount()
  })

  it('folgt der Verzahnung: ein umbenannter und ein dritter Parcours', async () => {
    const wrapper = ansicht(store)
    store.dispatch({ type: 'RENAME_PARCOURS', id: 'par_1', name: 'Hafenbecken' })
    store.dispatch({ type: 'ADD_PARCOURS', id: 'par_x' })
    await nextTick()
    const kopf = wrapper.findAll('.wkr-einteilung thead th').map((th) => th.text())
    expect(kopf).toHaveLength(4)
    expect(kopf[1]).toContain('Hafenbecken')
    expect(kopf[3]).toContain('keine Klasse')
    expect(wrapper.find('input[aria-label="Name für Steg, Hafenbecken"]').exists()).toBe(true)
    // Ohne Klasse hat der neue Parcours keine Liste.
    expect(wrapper.findAll('input[data-feld^="par_x|"]')).toHaveLength(0)
    wrapper.unmount()
  })

  it('spricht auch Englisch', async () => {
    setLocale('en')
    const wrapper = ansicht(store)
    expect(wrapper.find('.wkr-einteilung h2').text()).toBe('Race officials')
    expect(wrapper.find('input[data-feld="par_1|steg"]').attributes('aria-label')).toMatch(/^Name for .+, Parcours 1$/)
    wrapper.unmount()
  })
})
