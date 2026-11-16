import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { IDBFactory } from 'fake-indexeddb'
import { nextTick } from 'vue'
import AnzeigeApp from './AnzeigeApp.vue'
import { createLeseStore, leseStoreKey, type LeseStore } from './state/leseStore'
import { createStore, type Store } from './state/store'
import { STATE_KEY } from './persistenz/storage'
import { lage } from './betrieb/folge'
import { laufSchluessel } from './lib/eingaben'
import { reducer } from './state/reducer'
import { betriebsStand, festgeschrieben, zeigeNaechsten } from './testHilfen'
import { hoereAufScanner } from './lib/scanner'
import { starteOffline } from './lib/offline'
import { setLocale } from './i18n'

// Das Fenster der Anzeigetafel (`#/anzeige`): eigene Wurzel mit Nur-Lese-Store, neben einem Bedienfenster mit
// vollem Store – zwei Fenster desselben Browsers, verbunden über localStorage und storage-Ereignis.
// Alle Starter sind erfunden (Vor<id>/Nach<id>, Musterclub).

vi.mock('./lib/scanner', async (original) => ({ ...(await original<typeof import('./lib/scanner')>()), hoereAufScanner: vi.fn(() => () => {}) }))
vi.mock('./lib/offline', async (original) => ({ ...(await original<typeof import('./lib/offline')>()), starteOffline: vi.fn() }))

const P1 = 'par_1'
const P2 = 'par_2'

const offen: { beende: () => void }[] = []
let wrapper: VueWrapper | undefined

function bedienfenster(): Store {
  const s = createStore({ idb: new IDBFactory() })
  offen.push(s)
  return s
}
/** Was ein anderes Fenster beim Speichern auslöst (im eigenen gibt es das Ereignis nicht). */
const ereignis = () => window.dispatchEvent(new StorageEvent('storage', { key: STATE_KEY }))

function anzeigefenster(): { lese: LeseStore; w: VueWrapper } {
  const lese = createLeseStore()
  offen.push(lese)
  wrapper = mount(AnzeigeApp, { attachTo: document.body, global: { provide: { [leseStoreKey as symbol]: lese } } })
  return { lese, w: wrapper }
}

/** „Nächster Start“, wie die Start-Freigabe ihn schickt. */
function naechster(bedienung: Store, bereich = P1) {
  const l = lage(bedienung.state.value, bereich)
  bedienung.dispatch({ type: 'BETRIEB_ZEIGEN', bereich, ref: l.naechster!.key, vorher: l.aktuell?.key ?? null })
}

beforeEach(() => {
  localStorage.clear()
  setLocale('de')
  location.hash = '#/anzeige'
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  offen.splice(0).forEach((s) => s.beende())
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  location.hash = ''
})

/** Bedienfenster mit festgeschriebener Verzahnung, Lauf 1 auf Parcours 1 begonnen, e1 im Boot. */
async function imBetrieb() {
  const bedienung = bedienfenster()
  bedienung.dispatch({ type: 'LOAD_STATE', state: festgeschrieben(betriebsStand()) })
  bedienung.dispatch({ type: 'BETRIEB_BEGINNEN', bereich: P1, punkt: 'lauf:1' })
  naechster(bedienung)
  const { lese, w } = anzeigefenster()
  await nextTick()
  return { bedienung, lese, w }
}

const startNr = (w: VueWrapper, bereich = P1) => w.find(`[data-bereich="${bereich}"] [data-startnr]`).text()

describe('Fenster der Anzeigetafel', () => {
  it('ohne Kopf, Reiter, Banner und Fuß; kein Handscanner, kein Offline-Start, kein Schreiben', async () => {
    // Der Stand liegt schon im Speicher (ohne Bedienfenster, das selbst schriebe); ohne Kennung – ein voller
    // Store vergäbe eine und speicherte. Die Spione hängen an der Instanz (localStorage ist in den Tests eine
    // eigene Klasse, kein Storage) und VOR dem Einhängen: Auch der Start des Fensters darf nichts schreiben.
    const stand = zeigeNaechsten(reducer(festgeschrieben(betriebsStand()), { type: 'BETRIEB_BEGINNEN', bereich: P1, punkt: 'lauf:1' }), P1)
    localStorage.setItem(STATE_KEY, JSON.stringify({ ...stand, kennung: '' }))
    const gespeichert = localStorage.getItem(STATE_KEY)
    const setItem = vi.spyOn(localStorage, 'setItem')
    const removeItem = vi.spyOn(localStorage, 'removeItem')
    const { w } = anzeigefenster()
    await nextTick()
    expect(startNr(w)).toBe('E01')
    expect(w.find('.topbar').exists()).toBe(false)
    expect(w.find('nav').exists()).toBe(false)
    expect(w.find('footer').exists()).toBe(false)
    expect(w.find('.boat-banner').exists()).toBe(false)
    expect(w.find('.anzeige').exists()).toBe(true)
    expect(hoereAufScanner).not.toHaveBeenCalled()
    expect(starteOffline).not.toHaveBeenCalled()
    // Eingaben, Klicks und Tasten im Fenster schreiben nichts (der Nur-Lese-Store hat kein dispatch).
    await w.trigger('dblclick')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }))
    await flushPromises()
    expect(setItem).not.toHaveBeenCalled()
    expect(removeItem).not.toHaveBeenCalled()
    expect(localStorage.getItem(STATE_KEY)).toBe(gespeichert)
    expect(document.documentElement.classList.contains('anzeige-fenster')).toBe(true)
    expect(document.title).toBe('Anzeigetafel – Musterpokal 2026')
    w.unmount()
    wrapper = undefined
    expect(document.documentElement.classList.contains('anzeige-fenster')).toBe(false)
  })

  it('zwei Fenster: Eine Eingabe im Bedienfenster lässt das DOM der Tafel unberührt, „Nächster Start“ ändert es', async () => {
    const { bedienung, lese, w } = await imBetrieb()
    expect(startNr(w)).toBe('E01')
    const block = w.find(`[data-bereich="${P1}"] .anzeige-inhalt`).element

    const aenderungen: MutationRecord[] = []
    const beobachter = new MutationObserver((r) => aenderungen.push(...r))
    beobachter.observe(w.element, { subtree: true, childList: true, characterData: true, attributes: true })

    // Ein Wert in der Erfassung: neuer Stand im Nur-Lese-Store, aber dieselbe Sicht – nichts wird gezeichnet.
    const vorher = lese.state.value
    bedienung.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 1), starter: 'e1', feld: 'zeit1', wert: '83.4' }] })
    ereignis()
    await flushPromises()
    expect(lese.state.value).not.toBe(vorher)
    expect(aenderungen).toEqual([])
    expect(w.find(`[data-bereich="${P1}"] .anzeige-inhalt`).element).toBe(block)
    expect(w.html()).not.toContain('83.4')

    // Der nächste Start: ein neuer Block mit k1.
    naechster(bedienung)
    ereignis()
    await flushPromises()
    expect(startNr(w)).toBe('101')
    expect(w.find(`[data-bereich="${P1}"] .anzeige-inhalt`).element).not.toBe(block)
    expect(aenderungen.length).toBeGreaterThan(0)
    beobachter.disconnect()
  })

  it('Neuladen zeigt sofort den Stand; gleicher Stand bleibt dieselbe Sicht', async () => {
    const { bedienung } = await imBetrieb()
    naechster(bedienung)
    wrapper?.unmount()
    const { w } = anzeigefenster()
    expect(startNr(w)).toBe('101')
  })

  it('Rückfall ohne storage-Ereignis (file://): Das Bedienfenster stößt per postMessage an – nur vom opener', async () => {
    const opener = { postMessage: vi.fn() }
    vi.stubGlobal('opener', opener)
    const { bedienung, w } = await imBetrieb()
    // Beim Start meldet sich die Tafel beim Bedienfenster.
    expect(opener.postMessage).toHaveBeenCalledWith({ alcatraz: 'alcatraz-anzeige-da' }, '*')
    naechster(bedienung)
    await flushPromises()
    expect(startNr(w)).toBe('E01')
    // Von einem fremden Absender: kein Nachlesen.
    window.dispatchEvent(new MessageEvent('message', { data: { alcatraz: 'alcatraz-stand' }, source: null }))
    await flushPromises()
    expect(startNr(w)).toBe('E01')
    window.dispatchEvent(new MessageEvent('message', { data: { alcatraz: 'alcatraz-stand' }, source: opener as unknown as Window }))
    await flushPromises()
    expect(startNr(w)).toBe('101')
  })

  it('#/anzeige/<bereich> zeigt nur diesen Parcours; ein unbekannter zeigt die gemeinsame Tafel', async () => {
    location.hash = `#/anzeige/${P2}`
    const { w } = await imBetrieb()
    expect(w.findAll('.anzeige-bereich').map((b) => b.attributes('data-bereich'))).toEqual([P2])
    expect(document.title).toBe('Anzeigetafel – Parcours 2 – Musterpokal 2026')
    location.hash = '#/display/gibt-es-nicht'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await nextTick()
    expect(w.findAll('.anzeige-bereich').map((b) => b.attributes('data-bereich'))).toEqual([P1, P2])
  })

  it('Taste F schaltet Vollbild, mit Strg nicht', async () => {
    const requestFullscreen = vi.fn(async () => {})
    Object.defineProperty(document.documentElement, 'requestFullscreen', { value: requestFullscreen, configurable: true })
    await imBetrieb()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true }))
    expect(requestFullscreen).not.toHaveBeenCalled()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }))
    await flushPromises()
    expect(requestFullscreen).toHaveBeenCalledTimes(1)
  })
})
