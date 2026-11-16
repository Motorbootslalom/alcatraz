import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { createLeseStore, type LeseStore } from './leseStore'
import { createStore, type Store } from './store'
import { STATE_KEY } from '../persistenz/storage'
import { BETRIEB_STARTER, betriebsStand, festgeschrieben } from '../testHilfen'

// Nur-Lese-Store der Anzeigetafel im zweiten Fenster: liest, folgt anderen Fenstern, schreibt nie.
// Alle Starter sind erfunden.

const offen: { beende: () => void }[] = []
const lese = (): LeseStore => {
  const s = createLeseStore()
  offen.push(s)
  return s
}
const voll = (): Store => {
  const s = createStore({ idb: new IDBFactory() })
  offen.push(s)
  return s
}
/** Was ein anderes Fenster beim Speichern auslöst (im eigenen Fenster gibt es das Ereignis nicht). */
const ereignis = (key: string | null = STATE_KEY) => window.dispatchEvent(new StorageEvent('storage', { key }))

beforeEach(() => localStorage.clear())
afterEach(() => {
  offen.splice(0).forEach((s) => s.beende())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Nur-Lese-Store (Anzeigetafel im zweiten Fenster)', () => {
  it('liest den gespeicherten Stand; ohne einen ist er leer', () => {
    expect(lese().state.value.starters).toEqual([])
    const bedienung = voll()
    bedienung.dispatch({ type: 'ADD_STARTERS', starters: [...BETRIEB_STARTER] })
    expect(lese().state.value.starters.map((s) => s.id)).toEqual(BETRIEB_STARTER.map((s) => s.id))
  })

  it('folgt dem Bedienfenster über das storage-Ereignis; gleicher Text = derselbe Stand', () => {
    const bedienung = voll()
    const tafel = lese()
    bedienung.dispatch({ type: 'LOAD_STATE', state: festgeschrieben(betriebsStand()) })
    expect(tafel.state.value.starters).toEqual([])
    ereignis()
    const nachher = tafel.state.value
    expect(nachher.verzahnungLocked).toBe(true)
    // Ein Ereignis ohne neuen Inhalt (oder für einen anderen Schlüssel) legt keinen neuen Stand an.
    ereignis()
    ereignis('alcatraz:ui-locale')
    expect(tafel.state.value).toBe(nachher)
    bedienung.dispatch({ type: 'BETRIEB_BEGINNEN', bereich: 'par_1', punkt: 'lauf:1' })
    ereignis()
    expect(tafel.state.value.betrieb.bereiche.par_1.begonnen).toEqual(['lauf:1'])
    // Ein anderes Fenster leert den ganzen Speicher (key = null): leer.
    localStorage.clear()
    ereignis(null)
    expect(tafel.state.value.starters).toEqual([])
  })

  it('schreibt nie – keine Kennung, kein Speichern, kein zweiter Speicher', () => {
    // Gäbe es eine IndexedDB, bliebe sie unberührt (der volle Store legte dort den Verlauf an).
    const fabrik = new IDBFactory()
    vi.stubGlobal('indexedDB', fabrik)
    const idb = vi.spyOn(fabrik, 'open')
    // Ein Stand ohne Kennung: Der volle Store vergäbe hier eine und speicherte (SET_KENNUNG).
    localStorage.setItem(STATE_KEY, JSON.stringify({ ...betriebsStand(), kennung: '' }))
    const vorher = localStorage.getItem(STATE_KEY)
    // An der Instanz spionieren: In den Tests ist localStorage eine eigene Klasse (test-setup.ts), kein
    // Storage – ein Spion an Storage.prototype sähe nichts (Prüfung E1, 16.11.2026).
    const setItem = vi.spyOn(localStorage, 'setItem')
    const removeItem = vi.spyOn(localStorage, 'removeItem')
    const clear = vi.spyOn(localStorage, 'clear')
    const tafel = lese()
    ereignis()
    tafel.lies()
    expect(tafel.state.value.kennung).toBe('')
    expect(setItem).not.toHaveBeenCalled()
    expect(removeItem).not.toHaveBeenCalled()
    expect(clear).not.toHaveBeenCalled()
    expect(localStorage.getItem(STATE_KEY)).toBe(vorher)
    expect(idb).not.toHaveBeenCalled()
  })

  it('der Spion sieht ein Schreiben – Gegenprobe zum Test davor', () => {
    const setItem = vi.spyOn(localStorage, 'setItem')
    voll().dispatch({ type: 'ADD_STARTERS', starters: [...BETRIEB_STARTER] })
    expect(setItem).toHaveBeenCalledWith(STATE_KEY, expect.any(String))
  })

  it('ein unlesbarer Stand ergibt den leeren – und bleibt im Speicher, wie er ist', () => {
    localStorage.setItem(STATE_KEY, '{kaputt')
    expect(lese().state.value.starters).toEqual([])
    expect(localStorage.getItem(STATE_KEY)).toBe('{kaputt')
  })
})
