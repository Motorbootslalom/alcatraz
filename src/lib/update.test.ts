import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { IDBFactory } from 'fake-indexeddb'
import App from '../App.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { offline, starteOffline, type OfflineUmgebung, type SpeicherStand } from './offline'
import { fassungsText } from './update'
import { standLeer } from './eingaben'
import { setLocale } from '../i18n'
import type { Starter } from '../types'

// Der Knopf „Update“ in der Kopfzeile: nur da, wenn eine neue Fassung bereitliegt; ein Klick legt
// den Stand zuerst im Verlauf ab und schaltet dann um. Die IndexedDB ist eine im Arbeitsspeicher,
// der Service Worker ein Nachbau; alle Starter sind erfunden.

const ALT = { kennung: 'k-alt', fassung: 'abc1234', commitZeit: '2026-05-01T10:00:00+02:00', zeit: '2026-05-01T08:05:00.000Z', dateien: 7, fehlend: 0 }
const NEU = { kennung: 'k-neu', fassung: 'def5678', commitZeit: '2026-06-01T10:00:00+02:00', zeit: '2026-06-01T08:05:00.000Z', dateien: 8, fehlend: 0 }

class Worker extends EventTarget {
  state = 'activated'
  nachrichten: string[] = []
  constructor(public stand: SpeicherStand) {
    super()
  }
  postMessage(nachricht: { typ: string }, ports?: MessagePort[]) {
    this.nachrichten.push(nachricht.typ)
    if (nachricht.typ === 'stand') ports?.[0]?.postMessage({ typ: 'stand', ...this.stand })
    if (nachricht.typ === 'uebernehmen') ports?.[0]?.postMessage({ typ: 'uebernommen', ok: true })
  }
}

/** Der Browser nach einem Neustart: Der neue Service Worker läuft, ausgeliefert wird die alte Fassung. */
function browser(neu: boolean, mehr: Partial<OfflineUmgebung> = {}) {
  const aktiv = new Worker(neu ? { gueltig: ALT, eigen: NEU } : { gueltig: ALT, eigen: ALT })
  const anmeldung = Object.assign(new EventTarget(), { installing: null, waiting: null, active: aktiv, update: async () => {} })
  const speicher = Object.assign(new EventTarget(), { controller: aktiv, register: async () => anmeldung })
  const neuLaden = vi.fn()
  const u: OfflineUmgebung = { protokoll: 'https:', entwicklung: false, speicher: speicher as unknown as ServiceWorkerContainer, neuLaden, geduld: 30, ...mehr }
  return { u, aktiv, neuLaden }
}

const starter: Starter = { id: 'a', startNr: '401', vorname: 'Test', nachname: 'Eins', verein: 'Club', bundesland: 'Land', geburtsdatum: '', klasse: '4', groesse: '' }
const ruhe = async () => {
  await flushPromises()
  await new Promise((r) => setTimeout(r, 50))
  await flushPromises()
}

let store: Store
beforeEach(() => {
  localStorage.clear()
  setLocale('de')
  store = createStore({ idb: new IDBFactory() })
})
afterEach(async () => {
  await store.zweit.fertig()
  store.beende()
  await starteOffline({ protokoll: 'file:', entwicklung: false, speicher: undefined, neuLaden: () => {} })
})

const app = () => mount(App, { global: { provide: { [storeKey as symbol]: store } } })

describe('standLeer', () => {
  it('ist leer ohne Starter und ohne erfasste Werte – eine eingerichtete Veranstaltung ohne Starter zählt als leer', () => {
    expect(standLeer(store.state.value)).toBe(true)
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Hafenpokal' } })
    expect(standLeer(store.state.value)).toBe(true)
    store.dispatch({ type: 'ADD_STARTERS', starters: [starter] })
    expect(standLeer(store.state.value)).toBe(false)
    store.dispatch({ type: 'RESET_ALL' })
    expect(standLeer(store.state.value)).toBe(true)
  })
})

describe('Knopf „Update“', () => {
  it('ohne neue Fassung gibt es ihn nicht – auch nicht am Entwicklungsserver oder in der Ein-Datei-Fassung', async () => {
    store.dispatch({ type: 'ADD_STARTERS', starters: [starter] })
    for (const u of [browser(false).u, browser(true, { entwicklung: true }).u, browser(true, { protokoll: 'file:' }).u]) {
      await starteOffline(u)
      const w = app()
      await ruhe()
      expect(w.find('[data-action="update"]').exists()).toBe(false)
      w.unmount()
    }
  })

  it('liegt eine neue Fassung bereit, steht er in der Kopfzeile unmittelbar vor „Einstellungen“ – deutsch wie englisch', async () => {
    store.dispatch({ type: 'ADD_STARTERS', starters: [starter] })
    await starteOffline(browser(true).u)
    const w = app()
    await ruhe()
    const knopf = w.find('nav.tabs [data-action="update"]')
    expect(knopf.text()).toBe('Update')
    expect(knopf.attributes('title')).toContain('def5678')
    expect(knopf.element.nextElementSibling?.classList.contains('settings')).toBe(true)
    setLocale('en')
    await ruhe()
    expect(w.find('[data-action="update"]').text()).toBe('Update')
    expect(w.find('[data-action="update"]').attributes('title')).toContain('A new version is ready')
    w.unmount()
  })

  it('Klick: legt den Stand unter einem Namen im Verlauf ab, schaltet dann um und lädt neu – die Daten bleiben', async () => {
    store.dispatch({ type: 'ADD_STARTERS', starters: [starter] })
    await store.zweit.fertig()
    const { u, aktiv, neuLaden } = browser(true, { darfVonSelbst: () => false })
    await starteOffline(u)
    const w = app()
    await ruhe()
    expect(neuLaden).not.toHaveBeenCalled()
    expect(aktiv.nachrichten).not.toContain('uebernehmen')

    const vorher = JSON.stringify(store.state.value)
    await w.find('[data-action="update"]').trigger('click')
    await ruhe()
    const eintraege = await store.zweit.eintraege()
    const gemerkt = eintraege.find((e) => e.name?.startsWith('vor dem Update auf def5678'))
    expect(gemerkt).toBeDefined()
    expect(aktiv.nachrichten).toContain('uebernehmen')
    expect(neuLaden).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(store.state.value)).toBe(vorher)
    // Der gemerkte Stand ist der von vor dem Update.
    expect(await store.zweit.stand(gemerkt!.id)).toContain('"nachname":"Eins"')
    w.unmount()
  })

  it('leerer Stand: kein Eintrag im Verlauf nötig', async () => {
    const { u, aktiv, neuLaden } = browser(true)
    await starteOffline(u)
    const w = app()
    await ruhe()
    await w.find('[data-action="update"]').trigger('click')
    await ruhe()
    expect(aktiv.nachrichten).toContain('uebernehmen')
    expect(neuLaden).toHaveBeenCalledTimes(1)
    expect((await store.zweit.eintraege()).some((e) => e.name !== undefined)).toBe(false)
    w.unmount()
  })

  it('in einem anderen Fenster umgeschaltet: Hinweis zum Neuladen statt des Knopfs', async () => {
    store.dispatch({ type: 'ADD_STARTERS', starters: [starter] })
    await starteOffline(browser(true).u)
    const w = app()
    await ruhe()
    Object.assign(offline, { ersetzt: true })
    await ruhe()
    expect(w.find('[data-action="update"]').exists()).toBe(false)
    expect(w.find('[data-hinweis="fassung-ersetzt"]').text()).toContain('bitte neu laden')
    w.unmount()
  })
})

describe('fassungsText', () => {
  it('nennt Codestand mit Zeitpunkt und den Build – wie die Fußzeile, den Build mit Sekunden', () => {
    const text = fassungsText('def5678', '2026-06-01T10:00:00+02:00', '2026-06-01T08:05:37.000Z')
    expect(text).toMatch(/^Codestand def5678 \(.*2026, \d\d:\d\d\) · gebaut .*2026, \d\d:\d\d:37$/)
    // Zwei Builds derselben Minute unterscheiden sich.
    expect(fassungsText('def5678', '', '2026-06-01T08:05:12.000Z')).not.toBe(fassungsText('def5678', '', '2026-06-01T08:05:37.000Z'))
    expect(fassungsText('', '', '')).toBe('Codestand unbekannt · gebaut unbekannt')
  })
})
