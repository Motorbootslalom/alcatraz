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
