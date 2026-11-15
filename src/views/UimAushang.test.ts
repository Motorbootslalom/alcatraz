import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListsView from './ListsView.vue'
import SettingsView from './SettingsView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { laufSchluessel } from '../lib/eingaben'
import { vergissAlles } from '../lib/merken'
import { setLocale } from '../i18n'
import type { ClassId, Starter } from '../types'
import { knotenHaken } from '../testHilfen'

// Aushang nach UIM 960, Pkt. 5.2 / 5.2.1: Spalte „UIM points“, Unterschrift des O.O.D. und
// Uhrzeit des Aushangs, Versuche direkt nacheinander, Hinweis auf der Mannschaftswertung –
// und dass sich an den Listen der DM nichts ändert. Alle Starter und Länder sind erfunden.

const LAENDER = ['Nordland', 'Südland', 'Ostland']
function starter(klassen: ClassId[]): Starter[] {
  return klassen.flatMap((klasse) =>
    LAENDER.map((land, i) => ({
      id: `id-${klasse}-${i + 1}`,
      startNr: `${klasse}${String(i + 1).padStart(2, '0')}`,
      vorname: `Vor${klasse}${i + 1}`,
      nachname: `Nach${klasse}${i + 1}`,
      verein: land,
      bundesland: 'Musterland',
      land,
      geburtsdatum: '2014-05-01',
      groesse: '',
      klasse,
    })),
  )
}
const zeit = (store: Store, lauf: number, id: string, sekunden: number) =>
  store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', lauf), starter: id, feld: 'zeit1', wert: String(sekunden) }], zeit: Date.UTC(2026, 8, 26, 12, 0, lauf) })
const global = (store: Store) => ({ global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
async function listen(store: Store, art: 'ergebnis' | 'pokal') {
  const wrapper = mount(ListsView, global(store))
  await wrapper.find(`.list-kinds button[data-kind="${art}"]`).trigger('click')
  await nextTick()
  return wrapper
}
const blaetter = (wrapper: VueWrapper, art: string) => wrapper.findAll(`.ergebnis-blatt[data-art="${art}"]`)
/** Die Spalte „UIM points“ einer Gesamtliste: Startnummer → Zelle. */
const punkte = (wrapper: VueWrapper) =>
  Object.fromEntries(
    blaetter(wrapper, 'gesamt')[0]
      .findAll('tbody tr')
      .map((r) => [r.findAll('td')[1].text(), r.find('td[data-spalte="uim-punkte"]').text()]),
  )

describe('Aushang nach UIM 960, Pkt. 5.2', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vergissAlles()
    location.hash = ''
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Hafenpokal' } })
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'land' })
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1']) })
  })
  afterEach(() => {
    setLocale('de')
    document.body.innerHTML = ''
  })

  it('Gesamtliste: Spalte „UIM points“ – leer, bis die Klasse vollständig ist; geteilter Platz mit vollen Punkten, disq. mit 0', async () => {
    // 1. Versuch: 101 und 102 gleich schnell, 103 langsamer. 2. Versuch: nur 101 und 102.
    zeit(store, 1, 'id-1-1', 60)
    zeit(store, 1, 'id-1-2', 60)
    zeit(store, 1, 'id-1-3', 70)
    zeit(store, 2, 'id-1-1', 65)
    zeit(store, 2, 'id-1-2', 65)
    store.dispatch({ type: 'SET_EINGABEN', zellen: knotenHaken(['id-1-1', 'id-1-2']) })
    const wrapper = await listen(store, 'ergebnis')
    await wrapper.find('select[data-feld="erg-umfang"]').setValue('gesamt')
    await nextTick()
    const kopf = blaetter(wrapper, 'gesamt')[0].findAll('.erg-spaltenkopf th').map((t) => t.text())
    // Pkt. 5.2.1: „knots test penalties“, „best times including knots test penalties“, „UIM points“ –
    // keine Spalte „Result“ (bester Versuch ohne Knoten; Entscheidung des Nutzers vom 15.11.2026):
    // Hinter den Attempts folgen gleich die Knoten, mit der kräftigen Linie davor.
    expect(kopf.slice(-5)).toEqual(['Attempt 1', 'Attempt 2', 'Knots pen.', 'Best time incl. knots pen.', 'UIM points'])
    expect(kopf).not.toContain('Result')
    const blatt = blaetter(wrapper, 'gesamt')[0]
    expect(blatt.find('th[data-spalte="knoten"]').classes()).toContain('erg-gruppe')
    expect(blatt.find('tbody td[data-spalte="knoten"]').classes()).toContain('erg-gruppe')
    // Der Kopf überspannt genau die Spalten.
    expect(blatt.find('th.erg-kopfzelle').attributes('colspan')).toBe(String(blatt.findAll('colgroup col').length))
    // 103 holt den 2. Versuch noch nach: keine Punkte auf dem Aushang.
    expect(punkte(wrapper)).toEqual({ '101': '', '102': '', '103': '' })
    // 103 wird im 2. Versuch disqualifiziert; der Streichlauf nimmt das auf – er bleibt gewertet.
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 2), starter: 'id-1-3', feld: 'disq@vorsteg', wert: 'X' }], zeit: 5 })
    await nextTick()
    // Alle gefahren – die Punkte stehen trotzdem erst da, wenn auch die Knoten von 103 erfasst sind (Pkt. 5.2.1).
    expect(punkte(wrapper)).toEqual({ '101': '', '102': '', '103': '' })
    store.dispatch({ type: 'SET_EINGABEN', zellen: knotenHaken(['id-1-3']) })
    await nextTick()
    // 101 und 102 sind in allem gleich: geteilter 1. Platz, beide 400 Punkte; der 2. Platz entfällt.
    expect(punkte(wrapper)).toEqual({ '101': '400', '102': '400', '103': '225' })
    // In beiden Versuchen disqualifiziert: 0 Punkte.
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 1), starter: 'id-1-3', feld: 'disq@vorsteg', wert: 'X' }], zeit: 6 })
    await nextTick()
    expect(punkte(wrapper)).toEqual({ '101': '400', '102': '400', '103': '0' })
    wrapper.unmount()
  })

  it('Fuß jeder Wertungsliste: Unterschriftszeile „O.O.D.“ und leeres Feld „Time of posting“ – der Zeitstempel bleibt', async () => {
    for (const lauf of [1, 2]) [1, 2, 3].forEach((i) => zeit(store, lauf, `id-1-${i}`, 60 + i))
    const wrapper = await listen(store, 'ergebnis')
    const seiten = wrapper.findAll('.ergebnis-blatt')
    // Zwei Listen je Versuch und die Gesamtliste.
    expect(seiten.map((s) => s.attributes('data-art'))).toEqual(['lauf', 'lauf', 'gesamt'])
    for (const s of seiten) {
      const zeile = s.find('.erg-fuss.erg-fuss--unterschrift [data-feld="unterschrift"]')
      expect(zeile.find('.erg-unterschrift-wer').text()).toBe('O.O.D.')
      expect(zeile.find('[data-feld="aushang-zeit"]').text()).toBe('Time of posting')
      // Zum Eintragen von Hand: Linie und Feld sind leer.
      expect(zeile.find('.erg-unterschrift-linie').text()).toBe('')
      expect(zeile.find('.erg-unterschrift-feld').text()).toBe('')
      expect(s.find('.erg-stand').text()).toMatch(/^Last change: 2026-09-26 \d\d:00:0\d$/)
      // Der höhere Fuß zählt bei der Seitenteilung mit (lib/seiten.ts).
      expect(s.find('.listen-fuss').attributes('style')).toContain('height: 22mm')
    }
    wrapper.unmount()
  })

  it('Mannschaftswertung: Unterschrift auf jedem Blatt; das UIM-Blatt sagt, dass es nur aus dem Manövrieren rechnet – ohne Nummer einer Stage', async () => {
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['2']) })
    store.dispatch({ type: 'SET_POKAL_UIM', patch: { mindestens: 2 } })
    store.dispatch({ type: 'SET_POKAL_VARIANTE', variante: 'plaetze3', an: true })
    for (const k of ['1', '2']) for (const lauf of [1, 2]) [1, 2, 3].forEach((i) => zeit(store, lauf, `id-${k}-${i}`, 60 + i))
    store.dispatch({ type: 'SET_EINGABEN', zellen: knotenHaken(['1', '2'].flatMap((k) => [1, 2, 3].map((i) => `id-${k}-${i}`))) })
    const wrapper = await listen(store, 'pokal')
    const uim = blaetter(wrapper, 'pokal-uim')
    expect(uim.length).toBeGreaterThan(0)
    for (const s of uim) {
      expect(s.find('thead [data-hinweis="grundlage"]').text()).toBe('Manoeuvring only – nothing has been recorded for Parallel slalom yet.')
      expect(s.text()).not.toMatch(/stage/i)
      expect(s.find('[data-feld="unterschrift"]').text()).toContain('O.O.D.')
      expect(s.find('[data-feld="aushang-zeit"]').text()).toBe('Time of posting')
    }
    await wrapper.find('.cup-wahl button[data-variante="plaetze3"]').trigger('click')
    await nextTick()
    const plaetze = blaetter(wrapper, 'pokal-plaetze')
    expect(plaetze.length).toBeGreaterThan(0)
    for (const s of plaetze) expect(s.find('[data-feld="unterschrift"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('unter der DM ändert sich nichts: keine Punktspalte, kein höherer Fuß, kein Hinweis – auch die UIM-Mannschaftswertung der DM nicht', async () => {
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'dm-2026' })
    store.dispatch({ type: 'SET_EVENT', patch: { laufCount: 2 } })
    store.dispatch({ type: 'SET_POKAL_VARIANTE', variante: 'uim', an: true })
    store.dispatch({ type: 'SET_POKAL_UIM', patch: { mindestens: 1 } })
    for (const lauf of [1, 2]) [1, 2, 3].forEach((i) => zeit(store, lauf, `id-1-${i}`, 60 + i))
    const ergebnis = await listen(store, 'ergebnis')
    expect(ergebnis.findAll('.ergebnis-blatt').length).toBeGreaterThan(0)
    expect(ergebnis.find('[data-spalte="uim-punkte"]').exists()).toBe(false)
    // Die Gesamtliste der DM behält die Spalte „Ergebnis“ (bester Lauf ohne Knoten) vor den Knoten.
    const gesamt = blaetter(ergebnis, 'gesamt')[0].findAll('.erg-spaltenkopf th').map((t) => t.text())
    expect(gesamt.slice(-3)).toEqual(['Ergebnis', 'Knoten', 'Gesamt'])
    expect(ergebnis.find('[data-feld="unterschrift"]').exists()).toBe(false)
    expect(ergebnis.find('.erg-fuss--unterschrift').exists()).toBe(false)
    for (const f of ergebnis.findAll('.listen-fuss')) expect(f.attributes('style')).toContain('height: 12mm')
    expect(ergebnis.find('[data-hinweis="versuche-nacheinander"]').exists()).toBe(false)
    ergebnis.unmount()
    const pokal = await listen(store, 'pokal')
    await pokal.find('.cup-wahl button[data-variante="uim"]').trigger('click')
    await nextTick()
    expect(blaetter(pokal, 'pokal-uim').length).toBeGreaterThan(0)
    expect(pokal.find('[data-hinweis="grundlage"]').exists()).toBe(false)
    expect(pokal.find('[data-feld="unterschrift"]').exists()).toBe(false)
    pokal.unmount()
  })

  it('Einstellungen: „Versuche direkt nacheinander“ steht nur unter einem Regelwerk, das den Schalter kennt', async () => {
    const wrapper = mount(SettingsView, global(store))
    const schalter = () => wrapper.find('input[data-feld="versuche-nacheinander"]')
    expect(schalter().exists()).toBe(true)
    // Eine Option, nicht vorgewählt (Entscheidung des Nutzers).
    expect((schalter().element as HTMLInputElement).checked).toBe(false)
    expect(wrapper.find('[data-hinweis="versuche-nacheinander"]').text()).toContain('UIM 2026')
    await schalter().setValue(true)
    expect(store.state.value.versucheNacheinander).toBe(true)
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'dm-2026' })
    await nextTick()
    expect(schalter().exists()).toBe(false)
    wrapper.unmount()
  })

  it('Wertungslisten: Hinweis, dass zwischen den Versuchen nichts ausgehängt wird – nur solange der Schalter an ist', async () => {
    zeit(store, 1, 'id-1-1', 60)
    const wrapper = await listen(store, 'ergebnis')
    expect(wrapper.find('[data-hinweis="versuche-nacheinander"]').exists()).toBe(false)
    store.dispatch({ type: 'SET_VERSUCHE_NACHEINANDER', on: true })
    await nextTick()
    expect(wrapper.find('[data-hinweis="versuche-nacheinander"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
