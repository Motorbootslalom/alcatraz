import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VerzahnungView from './VerzahnungView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { wkrName } from '../lib/einteilung'
import { setLocale } from '../i18n'

describe('Verzahnung: Schnellauswahl', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
  })

  it('behält die Kennungen der Parcours – und damit die WKR-Einteilung, die daran hängt', async () => {
    // Erfundene Namen – keine echten Personen.
    store.dispatch({ type: 'SET_WKR_NAME', parcoursId: 'par_1', typeId: 'steg', name: 'Muster' })
    store.dispatch({ type: 'SET_WKR_NAME', parcoursId: 'par_2', typeId: 'steg', name: 'Beispiel' })
    const wrapper = mount(VerzahnungView, { global: { provide: { [storeKey as symbol]: store } } })
    const knoepfe = wrapper.findAll('.preset-row .segmented button')
    const aktiv = knoepfe.findIndex((b) => b.classes('active'))
    expect(aktiv).toBeGreaterThanOrEqual(0)
    const anderer = knoepfe.findIndex((_, i) => i !== aktiv)

    await knoepfe[anderer].trigger('click')
    expect(store.state.value.parcoursList[0].id).toBe('par_1')
    await knoepfe[aktiv].trigger('click')

    const stand = store.state.value
    expect(stand.parcoursList.map((p) => p.id).slice(0, 1)).toEqual(['par_1'])
    expect(wkrName(stand, 'steg', stand.parcoursList[0].classIds[0])).toBe('Muster')
    // Nichts hängt an einem Parcours, den es nicht gibt.
    for (const id of Object.keys(stand.einteilung)) expect(stand.parcoursList.map((p) => p.id)).toContain(id)
    wrapper.unmount()
  })
})

describe('Verzahnung: klassische Startnummern neu vergeben', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
    // Erfundene Starter in zwei Klassen desselben Parcours.
    store.dispatch({
      type: 'ADD_STARTERS',
      starters: ['1', '1', '3', '3'].map((klasse, i) => ({
        id: `id-${i}`,
        startNr: '',
        vorname: 'V',
        nachname: `N${i}`,
        verein: 'Musterclub',
        bundesland: 'Musterland',
        geburtsdatum: '',
        groesse: '',
        klasse: klasse as '1' | '3',
      })),
    })
  })

  const ansicht = () => mount(VerzahnungView, { global: { provide: { [storeKey as symbol]: store } } })
  const nummern = () => store.state.value.starters.map((s) => s.startNr)

  it('nur bei klassischen Startnummern gibt es die Leiste mit dem Knopf', async () => {
    const wrapper = ansicht()
    expect(wrapper.find('[data-leiste="nummern"]').exists()).toBe(false)
    store.dispatch({ type: 'SET_START_NR_MODE', mode: 'klassisch' })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-action="renumber"]').text()).toContain('Startnummern neu vergeben')
    wrapper.unmount()
  })

  it('eine geänderte Verzahnung vergibt nichts von selbst – erst der Knopf, nach Rückfrage', async () => {
    store.dispatch({ type: 'SET_START_NR_MODE', mode: 'klassisch' })
    store.dispatch({ type: 'ASSIGN_START_NUMBERS' })
    const vorher = nummern()
    const wrapper = ansicht()
    const leiste = () => wrapper.find('[data-leiste="nummern"]')
    expect(leiste().classes()).not.toContain('stale')
    expect(leiste().text()).toContain('folgen der Verzahnung')
    // Anderer Wechsel-Faktor: andere Startreihenfolge.
    const p = store.state.value.parcoursList.find((x) => x.classIds.includes('1'))!
    store.dispatch({ type: 'SET_PARCOURS_FACTOR', id: p.id, wechselFaktor: p.wechselFaktor === 2 ? 1 : 2 })
    await wrapper.vm.$nextTick()
    expect(nummern()).toEqual(vorher)
    expect(leiste().classes()).toContain('stale')
    expect(leiste().text()).toContain('passen nicht zur Verzahnung')
    // Ablehnen lässt alles, wie es ist; Bestätigen vergibt neu.
    const frage = window.confirm
    try {
      window.confirm = () => false
      await wrapper.find('[data-action="renumber"]').trigger('click')
      expect(nummern()).toEqual(vorher)
      window.confirm = () => true
      await wrapper.find('[data-action="renumber"]').trigger('click')
      expect(nummern()).not.toEqual(vorher)
      expect(leiste().classes()).not.toContain('stale')
    } finally {
      window.confirm = frage
    }
    wrapper.unmount()
  })
})
