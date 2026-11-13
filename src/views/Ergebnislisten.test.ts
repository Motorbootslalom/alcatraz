import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListsView from './ListsView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { laufSchluessel } from '../lib/eingaben'
import { setLocale } from '../i18n'
import type { ClassId, Starter } from '../types'

/** Erfundene Starter: `n` je Klasse, klassenbasierte Startnummern. */
function starter(klassen: ClassId[], n = 3): Starter[] {
  return klassen.flatMap((klasse) =>
    Array.from({ length: n }, (_, i) => ({
      id: `id-${klasse}-${i + 1}`,
      startNr: `${klasse}${String(i + 1).padStart(2, '0')}`,
      vorname: `Vor${klasse}${i + 1}`,
      nachname: `Nach${klasse}${i + 1}`,
      verein: 'Musterclub',
      bundesland: i === 0 ? 'Bayern' : 'Musterland',
      geburtsdatum: '2014-05-0' + (i + 1),
      groesse: '',
      klasse,
    })),
  )
}

const lauf = (n: number) => laufSchluessel('manoevrieren', n)
const zeit = (store: Store, n: number, id: string, wert: string) => store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: lauf(n), starter: id, feld: 'zeit1', wert }] })
const wert = (store: Store, n: number, id: string, feld: string, w: string) => store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: lauf(n), starter: id, feld, wert: w }] })
const ansicht = (store: Store) => mount(ListsView, { global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
async function ergebnisse(wrapper: VueWrapper) {
  await wrapper.find('.list-kinds button[data-kind="ergebnis"]').trigger('click')
  await nextTick()
}
async function waehle(wrapper: VueWrapper, feld: string, w: string) {
  await wrapper.find(`select[data-feld="erg-${feld}"]`).setValue(w)
  await nextTick()
}
const koepfe = (wrapper: VueWrapper) => wrapper.findAll('.ergebnis-blatt .erg-kopf').map((k) => k.findAll('span').map((s) => s.text()).join(' | '))
const zeilen = (wrapper: VueWrapper, blatt = 0) =>
  wrapper.findAll('.ergebnis-blatt')[blatt].findAll('tbody tr').map((r) => r.findAll('td').map((c) => c.text()))
const spalten = (wrapper: VueWrapper, blatt = 0) => wrapper.findAll('.ergebnis-blatt')[blatt].findAll('.erg-spaltenkopf th').map((t) => t.text().replace(/\s+/g, ' '))

describe('Listen: Ergebnislisten', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Hafenpokal' } })
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1', '4']) })
    // Klasse 4: drei Läufe; 401 holt den 2. Lauf noch nach, 402 ist im 2. Lauf nicht gestartet.
    for (const [id, zeiten] of Object.entries({ 'id-4-1': ['70', '', '72'], 'id-4-2': ['80', '', '81'], 'id-4-3': ['75', '76', '90'] })) {
      zeiten.forEach((z, i) => z && zeit(store, i + 1, id, z))
    }
    wert(store, 2, 'id-4-2', 'disq@vorsteg', 'X')
    wert(store, 1, 'id-4-3', 't1a|hin seiteA', '5')
    wert(store, 1, 'id-4-3', 'katalog:stegAnlegen', '9')
    // Klasse 1: nur der 1. Lauf.
    zeit(store, 1, 'id-1-1', '66')
    zeit(store, 1, 'id-1-2', '65')
  })
  afterEach(() => {
    setLocale('de')
    document.body.innerHTML = ''
  })

  it('ist eine eigene Listenart; je Klasse jeder Lauf mit Eingaben und die Gesamtliste', async () => {
    const wrapper = ansicht(store)
    expect(wrapper.find('.list-kinds button[data-kind="ergebnis"]').text()).toBe('Ergebnislisten')
    await ergebnisse(wrapper)
    expect(koepfe(wrapper)).toEqual([
      'Klasse 1 | 1. Lauf | Hafenpokal 2026',
      'Klasse 1 | Gesamt | Hafenpokal 2026',
      'Klasse 4 | 1. Lauf | Hafenpokal 2026',
      'Klasse 4 | 2. Lauf | Hafenpokal 2026',
      'Klasse 4 | 3. Lauf | Hafenpokal 2026',
      'Klasse 4 | Gesamt | Hafenpokal 2026',
    ])
    expect(wrapper.find('.ergebnis-zahl').text()).toBe('6 Listen')
    expect(wrapper.find('button.primary').attributes('disabled')).toBeUndefined()
    // Die anderen Listen stehen nicht daneben.
    expect(wrapper.find('.sheet').exists()).toBe(false)
    expect(wrapper.find('.bogen').exists()).toBe(false)
    wrapper.unmount()
  })

  it('ohne Eingaben: Hinweis mit dem Weg zur Erfassung, nichts zu drucken', async () => {
    store.dispatch({ type: 'CLEAR_EINGABEN' })
    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    expect(wrapper.findAll('.ergebnis-blatt')).toHaveLength(0)
    expect(wrapper.find('.panel.empty').text()).toContain('Noch keine Eingaben')
    expect(wrapper.find('.panel.empty a').attributes('href')).toBe('#/erfassung')
    expect(wrapper.find('button.primary').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('Laufliste: Spalten des Fahrwegs, Punkte an Tor und Boje, Herkunft als Kürzel, Geburtsdatum nach Einstellung', async () => {
    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    await waehle(wrapper, 'klasse', '4')
    await waehle(wrapper, 'lauf', '1')
    expect(koepfe(wrapper)).toEqual(['Klasse 4 | 1. Lauf | Hafenpokal 2026'])
    const kopf = spalten(wrapper)
    expect(kopf.slice(0, 8)).toEqual(['Platz', 'S-Nr.', 'Name', 'Vorname', 'Verein', 'Geb. Datum', 'Zeit', 'Punkte'])
    expect(kopf.slice(8)).toEqual(['Steg AB', 'Start', '1 H', '2 H', '3 H', '4 H', '5', '4 R', '3 R', '2 R', 'MüB', 'Ziel', 'Steg AN', 'disq.', 'ges. Punkte', 'Fehler-Schlüssel'])
    const z = zeilen(wrapper)
    expect(z.map((r) => r.slice(0, 4).join(' '))).toEqual(['1 401 Nach41 Vor41', '2 402 Nach42 Vor42', '3 403 Nach43 Vor43'])
    expect(z[0].slice(4, 8)).toEqual(['Musterclub', '01.05.2014', '01:10,00', '70,00'])
    // 403: 75 s + 5 (Boje Tor 1 hin) + 10 (Steg AN, Code 9) = 90,00 – und jede Strafe steht in ihrer Spalte.
    expect(z[2].at(-2)).toBe('90,00')
    expect(z[2].at(-1)).toBe('9')
    expect(z[2].filter((c) => c === '5')).toHaveLength(1)
    expect(z[2].filter((c) => c === '10')).toHaveLength(1)
    // Jede fünfte Zeile wäre grau; hier sind es drei.
    expect(wrapper.findAll('.ergebnis-blatt tbody tr.grau')).toHaveLength(0)

    // Bundesland mit ISO-Kürzel; ohne Geburtsdatum.
    store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'bundesland' })
    store.dispatch({ type: 'SET_LIST_OPTIONS', patch: { showBirthdate: false } })
    await nextTick()
    expect(spalten(wrapper).slice(0, 7)).toEqual(['Platz', 'S-Nr.', 'Name', 'Vorname', 'Land', 'Zeit', 'Punkte'])
    expect(zeilen(wrapper).map((r) => r[4])).toEqual(['BY', 'Musterland', 'Musterland'])
    // Clubmeisterschaft: keine Herkunft.
    store.dispatch({ type: 'SET_EVENT_KIND', eventKind: 'club' })
    await nextTick()
    expect(spalten(wrapper).slice(0, 6)).toEqual(['Platz', 'S-Nr.', 'Name', 'Vorname', 'Zeit', 'Punkte'])
    wrapper.unmount()
  })

  it('noch nicht gefahren steht ohne Zeit auf Platz 1, nicht gestartet (x) hinten', async () => {
    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    await waehle(wrapper, 'klasse', '4')
    await waehle(wrapper, 'lauf', '2')
    const reihen = wrapper.findAll('.ergebnis-blatt tbody tr')
    expect(reihen.map((r) => `${r.attributes('data-wertung')}:${r.findAll('td')[0].text()} ${r.findAll('td')[1].text()}`)).toEqual(['offen:1 401', 'gewertet:2 403', 'disq:3 402'])
    const z = zeilen(wrapper)
    expect(z[0].slice(6, 8)).toEqual(['', '']) // keine Zeit
    expect(z[0].at(-2)).toBe('')
    expect(z[2].slice(-3)).toEqual(['x', 'disq.', 'X'])
    expect(reihen[2].find('.erg-disq').exists()).toBe(true)
    wrapper.unmount()
  })

  it('Gesamtliste: Läufe nebeneinander, Gestrichenes durchgestrichen, offen auf Platz 1; Reihenfolge und Abstand wählbar', async () => {
    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    await waehle(wrapper, 'klasse', '4')
    await waehle(wrapper, 'umfang', 'gesamt')
    expect(koepfe(wrapper)).toEqual(['Klasse 4 | Gesamt | Hafenpokal 2026'])
    // Kein Lauf-Wähler bei „nur Gesamtliste“.
    expect(wrapper.find('select[data-feld="erg-lauf"]').exists()).toBe(false)
    const kopf = spalten(wrapper)
    expect(kopf).toEqual(['Platz', 'S-Nr.', 'Name', 'Vorname', 'Verein', 'Geb. Datum', '1. Lauf', '2. Lauf', '3. Lauf', 'Ergebnis', 'Gesamt'])
    const reihen = () => wrapper.findAll('.ergebnis-blatt tbody tr')
    const kurz = () => reihen().map((r) => `${r.attributes('data-wertung')}:${r.findAll('td')[0].text()} ${r.findAll('td')[1].text()} ${r.findAll('td').at(-1)!.text()}`.trim())
    // 401 holt Lauf 2 nach → Platz 1 ohne Ergebnis. 402: x gestrichen → 80 + 81. 403: 90 + 76, der schlechteste (90, Lauf 1 oder 3) gestrichen.
    expect(kurz()).toEqual(['offen:1 401', 'gewertet:2 402 161,00', 'gewertet:3 403 166,00'])
    const gestrichen = (i: number) => reihen()[i].findAll('td.erg-gestrichen').map((c) => c.text())
    expect(gestrichen(0)).toEqual([])
    expect(gestrichen(1)).toEqual(['', '', 'disq.'])
    expect(gestrichen(2)).toEqual(['01:15,00', '15', '90,00'])

    await waehle(wrapper, 'ordnung', 'nummer')
    expect(kurz().map((k) => k.split(' ')[1])).toEqual(['401', '402', '403'])
    await waehle(wrapper, 'abstand', 'erster')
    expect(spalten(wrapper).at(-1)).toBe('Abstandzum 1. Platz') // im Kopf zweizeilig (<br>)
    expect(reihen().map((r) => r.findAll('td').at(-1)!.text())).toEqual(['', '', '+5,00'])
    wrapper.unmount()
  })

  it('die Streichläufe aus den Einstellungen wirken sofort', async () => {
    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    await waehle(wrapper, 'klasse', '4')
    await waehle(wrapper, 'umfang', 'gesamt')
    expect(wrapper.find('.ergebnis-wahl').text()).toContain('3 Läufe, 1 Streichlauf.')
    store.dispatch({ type: 'SET_STREICHLAEUFE', streichlaeufe: 0 })
    await nextTick()
    expect(wrapper.find('.ergebnis-wahl').text()).toContain('3 Läufe, 0 Streichläufe.')
    // Ohne Streichlauf zählt das x von 402: letzter Platz.
    const letzte = wrapper.findAll('.ergebnis-blatt tbody tr').at(-1)!
    expect(letzte.attributes('data-wertung')).toBe('disq')
    expect(letzte.findAll('td')[1].text()).toBe('402')
    wrapper.unmount()
  })

  it('Drucken: Fenstertitel mit Listenart, Klasse, Lauf, Veranstaltung und Zeitpunkt – in der Sprache der Oberfläche', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)
    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    await waehle(wrapper, 'klasse', '4')
    await waehle(wrapper, 'lauf', '2')
    await wrapper.find('button.primary').trigger('click')
    expect(print).toHaveBeenCalledOnce()
    expect(document.title).toMatch(/^Ergebnislisten - Klasse 4 - 2\. Lauf - Hafenpokal 2026 - \d{4}-\d\d-\d\d_\d{4}$/)
    await waehle(wrapper, 'lauf', '')
    await waehle(wrapper, 'klasse', '')
    await wrapper.find('button.primary').trigger('click')
    expect(document.title).toMatch(/^Ergebnislisten - alle Klassen - Lauf 1, 2, 3 - Gesamt - Hafenpokal 2026 - /)
    // Seitenzähler und Zeitpunkt stehen im Seitenrand der Querformat-Seite.
    expect(wrapper.find('style').text()).toMatch(/@page ergebnis \{ @bottom-center \{ content: "Seite " counter\(page\) " von " counter\(pages\)/)

    setLocale('en')
    await nextTick()
    await waehle(wrapper, 'klasse', '4')
    await waehle(wrapper, 'umfang', 'gesamt')
    await wrapper.find('button.primary').trigger('click')
    expect(document.title).toMatch(/^Results - Class 4 - Overall - Hafenpokal 2026 - /)
    expect(koepfe(wrapper)).toEqual(['Class 4 | Overall | Hafenpokal 2026'])
    expect(spalten(wrapper).slice(0, 6)).toEqual(['Rank', 'No.', 'Surname', 'First name', 'Club', 'Date of birth'])
    // Englisch: Datum als yyyy-mm-dd, Dezimalpunkt, „DSQ“.
    const z = zeilen(wrapper)
    expect(z[0][5]).toBe('2014-05-01')
    expect(z[1].at(-1)).toBe('161.00')
    expect(wrapper.findAll('td.erg-disq').map((c) => c.text())).toContain('DSQ')
    expect(wrapper.find('style').text()).toContain('"Page " counter(page) " of " counter(pages)')
    vi.unstubAllGlobals()
    wrapper.unmount()
  })

  it('fehlende Startnummern halten die Ergebnislisten nicht auf', async () => {
    store.dispatch({ type: 'UPDATE_STARTER', id: 'id-1-3', patch: { startNr: '' } })
    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    expect(wrapper.findAll('.ergebnis-blatt').length).toBeGreaterThan(0)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('button.primary').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
})
