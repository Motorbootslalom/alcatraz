import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { IDBFactory } from 'fake-indexeddb'
import VerlaufPanel from './VerlaufPanel.vue'
import SettingsView from '../views/SettingsView.vue'
import App from '../App.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { STATE_KEY } from '../persistenz/storage'
import { laufSchluessel } from '../lib/eingaben'
import { lage } from '../betrieb/folge'
import { setLocale } from '../i18n'
import { wkrBetriebsStand, zeigeNaechsten } from '../testHilfen'
import type { ClassId, Starter } from '../types'

// Der Verlauf in den Einstellungen. Die IndexedDB ist eine im Arbeitsspeicher; alle Starter sind erfunden.

const starter = (id: string, klasse: ClassId): Starter => ({ id, startNr: id.toUpperCase(), vorname: 'Test', nachname: id, verein: 'Club', bundesland: 'Land', geburtsdatum: '', klasse, groesse: '' })
const START = [starter('a', '4'), starter('b', '4'), starter('c', '1')]
const eingabe = (store: Store, id: string, wert: string, lauf = 1) =>
  store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', lauf), starter: id, feld: 'zeit1', wert }] })
const wert = (store: Store, id: string) => store.state.value.eingaben[laufSchluessel('manoevrieren', 1)]?.[id]?.zeit1

let store: Store
let fabrik: IDBFactory
const stores: Store[] = []
/** Wartet, bis geschrieben und die Liste neu gelesen ist. */
async function ruhe() {
  await store.zweit.fertig()
  await flushPromises()
  await new Promise((r) => setTimeout(r, 5))
  await flushPromises()
}
/**
 * Wartet auf einen Zustand statt auf eine Zeit: Wiederherstellen liest aus der IndexedDB,
 * schreibt den Stand und liest die Liste neu – unter Last (voller Testlauf) dauert das länger
 * als die feste Pause von `ruhe`.
 */
const bis = (pruefe: () => void) => vi.waitFor(pruefe, { timeout: 10_000, interval: 10 })
const panel = () => mount(VerlaufPanel, { global: { provide: { [storeKey as symbol]: store } } })

beforeEach(async () => {
  localStorage.clear()
  setLocale('de')
  fabrik = new IDBFactory()
  store = createStore({ idb: fabrik })
  stores.push(store)
  store.dispatch({ type: 'ADD_STARTERS', starters: START })
  await store.zweit.fertig()
})
afterEach(() => {
  stores.splice(0).forEach((s) => s.beende())
  vi.unstubAllGlobals()
  setLocale('de')
})

describe('Verlauf in den Einstellungen', () => {
  it('zeigt die letzten Stände mit dem, was sich geändert hat – der jüngste ist der jetzige', async () => {
    eingabe(store, 'a', '8', 2)
    eingabe(store, 'a', '80', 2)
    const w = panel()
    await ruhe()
    const zeilen = w.findAll('.verlauf-liste li')
    expect(zeilen).toHaveLength(2)
    expect(zeilen[0].text()).toContain('Eingabe Klasse 4, 2. Lauf')
    expect(zeilen[0].text()).toContain('2 Änderungen')
    expect(zeilen[0].find('[data-marke="jetzt"]').exists()).toBe(true)
    expect(zeilen[0].find('[data-action="verlauf-wiederherstellen"]').attributes('disabled')).toBeDefined()
    expect(zeilen[1].text()).toContain('3 Starter hinzugefügt')
    expect(zeilen[1].find('[data-marke="jetzt"]').exists()).toBe(false)
  })

  it('eine Eingabe im Parallelslalom nennt Runde und Attempt, nicht einen Lauf des Manövrierens', async () => {
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'parallel:pre/2', starter: 'a', feld: 'zeit1', wert: '80' }] })
    const w = panel()
    await ruhe()
    expect(w.find('.verlauf-liste li').text()).toContain('Eingabe Klasse 4, Parallel-Slalom Vorlauf, 2. Versuch')
    setLocale('en')
    await ruhe()
    expect(w.find('.verlauf-liste li').text()).toContain('Data entry Class 4, Parallel slalom Preliminary heat, 2nd attempt')
  })

  it('Wiederholung nach Ausfall: eigene Einträge mit Startnummer, Klasse und Lauf – auch „Doch keine Wiederholung“ (27.11.2026)', async () => {
    // Zwei Ausfälle in derselben Klasse und demselben Lauf wären ohne Startnummer nicht zu unterscheiden.
    store.dispatch({ type: 'LOAD_STATE', state: zeigeNaechsten(zeigeNaechsten(wkrBetriebsStand(), 'par_1', 1000), 'par_1', 61_000) })
    await ruhe()
    const ref = lage(store.state.value, 'par_1').aktuell!.key
    store.dispatch({ type: 'WIEDERHOLUNG_AUSFALL', bereich: 'par_1', ref })
    await ruhe()
    store.dispatch({ type: 'WIEDERHOLUNG_AUFHEBEN', bereich: 'par_1', ref })
    await ruhe()
    const w = panel()
    await ruhe()
    const zeilen = w.findAll('.verlauf-liste li').map((z) => z.text())
    expect(zeilen[0]).toContain('Doch keine Wiederholung – Werte zurückgeholt: 101, Klasse 1, 1. Lauf')
    expect(zeilen[1]).toContain('Wiederholung nach Ausfall – Werte verworfen: 101, Klasse 1, 1. Lauf')
  })

  it('folgt der Sprache der Oberfläche', async () => {
    eingabe(store, 'a', '80', 2)
    setLocale('en')
    const w = panel()
    await ruhe()
    expect(w.find('.verlauf-liste li').text()).toContain('Data entry Class 4, Attempt 2')
    expect(w.text()).toContain('3 drivers added')
  })

  it('stellt einen Stand nach Rückfrage wieder her; der vorige steht danach im Verlauf', async () => {
    eingabe(store, 'a', '80')
    const w = panel()
    await ruhe()
    const confirm = vi.fn((_frage: string) => false)
    vi.stubGlobal('confirm', confirm)
    const knopf = () => w.findAll('.verlauf-liste li')[1].find('[data-action="verlauf-wiederherstellen"]')
    await bis(() => expect(w.findAll('.verlauf-liste li')).toHaveLength(2))
    await knopf().trigger('click')
    await bis(() => expect(confirm).toHaveBeenCalledTimes(1))
    await ruhe()
    expect(confirm.mock.calls[0][0]).toContain('Der jetzige Stand geht nicht verloren')
    expect(wert(store, 'a')).toBe('80')

    confirm.mockReturnValue(true)
    await knopf().trigger('click')
    await bis(() => {
      expect(wert(store, 'a')).toBeUndefined()
      expect(w.findAll('.verlauf-liste li')).toHaveLength(3)
      expect(w.find('[data-hinweis="verlauf-meldung"]').exists()).toBe(true)
    })
    expect(store.state.value.starters).toHaveLength(3)
    const zeilen = w.findAll('.verlauf-liste li')
    expect(zeilen).toHaveLength(3)
    expect(zeilen[0].text()).toMatch(/Stand vom .* wiederhergestellt/)
    expect(w.find('[data-hinweis="verlauf-meldung"]').text()).toContain('wiederhergestellt')
    // Wieder nach vorn: der Stand mit der Eingabe.
    await zeilen[1].find('[data-action="verlauf-wiederherstellen"]').trigger('click')
    await bis(() => expect(wert(store, 'a')).toBe('80'))
  })

  it('Wiederherstellen behält den Betrieb am Wettkampftag – die Anzeigetafel springt nicht zurück', async () => {
    eingabe(store, 'a', '80')
    // Je Schritt warten: Was schneller kommt, als der Speicher schreibt, wird ein Eintrag.
    await store.zweit.fertig()
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    await store.zweit.fertig()
    store.dispatch({ type: 'BETRIEB_BEGINNEN', bereich: 'par_2', punkt: 'lauf:1' })
    const naechster = lage(store.state.value, 'par_2').naechster!
    store.dispatch({ type: 'BETRIEB_ZEIGEN', bereich: 'par_2', ref: naechster.key, vorher: null })
    const betrieb = store.state.value.betrieb
    expect(betrieb.bereiche.par_2.gezeigt).toHaveLength(1)
    const w = panel()
    await ruhe()
    // Der Betrieb legt keinen eigenen Eintrag an: Festschreiben, Eingabe, Starter.
    await bis(() => expect(w.findAll('.verlauf-liste li')).toHaveLength(3))
    vi.stubGlobal('confirm', vi.fn(() => true))
    // Zurück zum Stand vor dem Festschreiben: Werte und Verzahnung von damals, der Betrieb von jetzt.
    await w.findAll('.verlauf-liste li')[1].find('[data-action="verlauf-wiederherstellen"]').trigger('click')
    await bis(() => expect(store.state.value.verzahnungLocked).toBe(false))
    expect(wert(store, 'a')).toBe('80')
    expect(store.state.value.betrieb).toEqual(betrieb)
    // Auch im Speicher – ein anderes Fenster (die Anzeigetafel) liest es von dort.
    expect(JSON.parse(localStorage.getItem(STATE_KEY)!).betrieb).toEqual(betrieb)
  })

  it('Wiederherstellen eines Stands einer anderen Veranstaltung bringt deren Betrieb mit, nicht den jetzigen', async () => {
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    await store.zweit.fertig()
    const kennungA = store.state.value.kennung
    // Eine andere Veranstaltung (Sicherung geladen): Läufe 1 und 2 begonnen, eine Meldung auf der Tafel.
    const b = { ...store.state.value, kennung: 'BBBB', eventName: 'Musterregatta' }
    store.dispatch({ type: 'LOAD_STATE', state: b }, { art: 'sicherung' })
    for (const punkt of ['lauf:1', 'lauf:2'] as const) store.dispatch({ type: 'BETRIEB_BEGINNEN', bereich: 'par_2', punkt })
    store.dispatch({ type: 'BETRIEB_MELDUNG', bereich: 'par_2', meldung: { text: 'Pause bei B', art: 'pause' } })
    expect(store.state.value.betrieb.bereiche.par_2.begonnen).toEqual(['lauf:1', 'lauf:2'])
    const w = panel()
    await ruhe()
    await bis(() => expect(w.findAll('.verlauf-liste li')).toHaveLength(3))
    vi.stubGlobal('confirm', vi.fn(() => true))
    // Zurück zum Festschreiben der ersten Veranstaltung: ihr Betrieb von damals (noch nichts), nicht der von B.
    await w.findAll('.verlauf-liste li')[1].find('[data-action="verlauf-wiederherstellen"]').trigger('click')
    await bis(() => expect(store.state.value.kennung).toBe(kennungA))
    expect(store.state.value.betrieb).toEqual({ bereiche: {} })
    expect(JSON.stringify(store.state.value.betrieb)).not.toContain('Pause bei B')
  })

  it('„Stand merken“ legt den jetzigen Stand mit Namen ab; nur gemerkte lassen sich löschen', async () => {
    const w = panel()
    await ruhe()
    expect(w.find('[data-action="verlauf-merken"]').attributes('disabled')).toBeDefined()
    await w.find('[data-feld="verlauf-name"]').setValue('vor dem Test')
    await w.find('form').trigger('submit')
    await ruhe()
    const gemerkt = w.find('.verlauf-liste li.gemerkt')
    expect(gemerkt.text()).toContain('vor dem Test')
    expect(w.findAll('[data-action="verlauf-loeschen"]')).toHaveLength(1)
    expect((w.find('[data-feld="verlauf-name"]').element as HTMLInputElement).value).toBe('')

    vi.stubGlobal('confirm', vi.fn(() => true))
    await gemerkt.find('[data-action="verlauf-loeschen"]').trigger('click')
    await ruhe()
    expect(w.find('.verlauf-liste li.gemerkt').exists()).toBe(false)
  })

  it('ohne zweiten Speicher steht dort nur das – ohne Liste, ohne Fehler', async () => {
    store = createStore({ idb: null })
    stores.push(store)
    const w = panel()
    await ruhe()
    expect(w.find('[data-hinweis="zweiter-speicher"]').text()).toContain('nicht verfügbar')
    expect(w.find('.verlauf-liste').exists()).toBe(false)
    expect(w.find('[data-action="verlauf-merken"]').exists()).toBe(false)
  })

  it('steht bei den Dateien; „Alles zurücksetzen“ sagt, dass der Verlauf mit gelöscht wird, und löscht ihn', async () => {
    await store.zweit.merke('vor dem Test')
    const w = mount(SettingsView, { global: { provide: { [storeKey as symbol]: store } } })
    await ruhe()
    expect(w.find('#dateien #verlauf').exists()).toBe(true)
    const confirm = vi.fn((_frage: string) => true)
    vi.stubGlobal('confirm', confirm)
    await w.find('#dateien button.danger:not([data-action])').trigger('click')
    await ruhe()
    expect(confirm.mock.calls[0][0]).toContain('Auch der Verlauf in diesem Browser wird gelöscht')
    expect(store.state.value.starters).toHaveLength(0)
    const eintraege = await store.zweit.eintraege()
    expect(eintraege.map((e) => e.was.art)).toEqual(['zurueckgesetzt'])
    expect(w.findAll('.verlauf-liste li')).toHaveLength(1)
  })
})

describe('Hinweis nach einem Abbruch', () => {
  it('steht oben, nennt den Zeitpunkt und bleibt, bis er bestätigt ist', async () => {
    eingabe(store, 'a', '80')
    await store.zweit.fertig()
    const alt = localStorage.getItem(STATE_KEY)!
    eingabe(store, 'a', '81')
    await store.zweit.fertig()
    localStorage.setItem(STATE_KEY, alt)
    // Derselbe zweite Speicher, ein neuer Start.
    const danach = createStore({ idb: fabrik })
    stores.push(danach)
    const w = mount(App, { global: { provide: { [storeKey as symbol]: danach } } })
    expect(w.find('[data-hinweis="wiederhergestellt"]').exists()).toBe(false)
    await danach.zweit.fertig()
    await flushPromises()
    const hinweis = w.find('[data-hinweis="wiederhergestellt"]')
    expect(hinweis.text()).toContain('Nach einem Abbruch wiederhergestellt')
    expect(hinweis.text()).toContain('Bitte die zuletzt erfassten Werte prüfen')
    expect(hinweis.text()).toMatch(/\d{2}:\d{2}:\d{2}/)
    await hinweis.find('[data-action="wiederhergestellt-ok"]').trigger('click')
    expect(w.find('[data-hinweis="wiederhergestellt"]').exists()).toBe(false)
  })
})
