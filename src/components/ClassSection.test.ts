import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ClassSection from './ClassSection.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { setLocale } from '../i18n'
import type { Starter } from '../types'

// Mit einem Starter gehen seine erfassten Werte, ohne Rückgängig: Das × und „Klasse leeren“
// müssen das sagen, bevor es geschieht. Alle Starter sind erfunden.

const starter = (n: number): Starter => ({ id: `p${n}`, startNr: `40${n}`, vorname: `Vor${n}`, nachname: `Nach${n}`, verein: 'Musterclub', bundesland: '', geburtsdatum: '', klasse: '4', groesse: '' })

describe('Starter entfernen mit erfassten Werten', () => {
  let store: Store
  const confirm = vi.fn(() => false)
  const ansicht = () =>
    mount(ClassSection, {
      props: { classId: '4', starters: store.state.value.starters, duplicates: new Set<string>(), open: true, sortTick: 0 },
      global: { provide: { [storeKey as symbol]: store } },
    })

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    confirm.mockReset().mockReturnValue(false)
    vi.stubGlobal('confirm', confirm)
    store = createStore()
    store.dispatch({ type: 'ADD_STARTERS', starters: [starter(1), starter(2)] })
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: 'p1', feld: 'zeit1', wert: '80' }] })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('das × fragt nur, wenn für den Starter schon Werte erfasst sind', async () => {
    const wrapper = ansicht()
    const knoepfe = wrapper.findAll('button.del')
    expect(knoepfe).toHaveLength(2)
    // Mit Werten: Rückfrage mit Nummer und Name; abgelehnt bleibt alles.
    await knoepfe[0].trigger('click')
    expect(confirm).toHaveBeenCalledOnce()
    expect(confirm.mock.calls[0].join()).toContain('Für 401 Vor1 Nach1 sind schon Zeiten oder Fehler erfasst')
    expect(store.state.value.starters).toHaveLength(2)
    expect(store.state.value.eingaben['manoevrieren/1']).toEqual({ p1: { zeit1: '80' } })
    // Ohne Werte: ein Klick genügt wie bisher.
    await knoepfe[1].trigger('click')
    expect(confirm).toHaveBeenCalledOnce()
    expect(store.state.value.starters.map((p) => p.id)).toEqual(['p1'])
    // Bestätigt: Starter und Werte sind weg.
    confirm.mockReturnValue(true)
    await knoepfe[0].trigger('click')
    expect(store.state.value.starters).toEqual([])
    expect(store.state.value.eingaben).toEqual({})
    wrapper.unmount()
  })

  it('„Klasse leeren“ nennt, wie viele Starter erfasste Werte verlieren', async () => {
    const wrapper = ansicht()
    const leeren = wrapper.find('button.btn.sm.danger')
    await leeren.trigger('click')
    expect(confirm).toHaveBeenCalledOnce()
    expect(confirm.mock.calls[0].join()).toContain('Für 1 dieser Starter sind schon Zeiten oder Fehler erfasst')
    expect(store.state.value.starters).toHaveLength(2)
    wrapper.unmount()
  })
})
