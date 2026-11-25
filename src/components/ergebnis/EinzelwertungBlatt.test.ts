import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EinzelwertungBlatt from './EinzelwertungBlatt.vue'
import type { EinzelZeile } from '../../lib/einzelwertung'
import { createStore, storeKey } from '../../state/store'
import { logoFolge, setzeTestLogos } from '../../testHilfen'

// Der Fuß der Einzelwertung (Regel 960, Pkt. 5.2.6): Die Regel steht auf jeder Seite mit
// Punktgleichen – mit Sternchen, wenn die Zeit einen Platz bestimmt hat, sonst ohne. Erfundene Starter.

const zeile = (nr: number, platz: number, summe: number, extra: Partial<EinzelZeile> = {}): EinzelZeile => ({
  starter: { id: `s${nr}`, startNr: String(100 + nr), vorname: 'Vor', nachname: `Nach${nr}`, verein: 'Club', bundesland: '', geburtsdatum: '', klasse: '1', groesse: '' },
  manoever: summe / 2,
  parallel: summe / 2,
  manoeverErgebnis: { zeit: 6000 + nr * 100, platz: nr, disq: false },
  parallelErgebnis: { zeit: 8000 + nr * 100, platz: nr, disq: false },
  summe,
  offen: false,
  disq: false,
  platz,
  stich: false,
  punktgleich: false,
  zeit: null,
  ...extra,
})
const blatt = (zeilen: EinzelZeile[]) =>
  mount(EinzelwertungBlatt, { props: { klasseText: 'Class 1', titel: 'Individual competition', eventName: 'Test', zeilen, stichText: 'MARKE REGEL', regelText: 'REGEL', geteiltText: 'GETEILT', sprache: 'en' } })
const fuss = (zeilen: EinzelZeile[]) => {
  const w = blatt(zeilen)
  return { stich: w.find('[data-hinweis="stich"]').exists() ? w.find('[data-hinweis="stich"]').text() : null, hinweis: w.find('[data-hinweis="fuss"]').exists() ? w.find('[data-hinweis="fuss"]').text() : null }
}

describe('Fuß der Einzelwertung', () => {
  it('ohne Punktgleiche steht keine Regel da', () => {
    expect(fuss([zeile(1, 1, 700), zeile(2, 2, 500)])).toEqual({ stich: null, hinweis: null })
  })

  it('hat die Zeit einen Platz bestimmt: Sternchen und Regel', () => {
    const gleich = { stich: true, punktgleich: true }
    expect(fuss([zeile(1, 1, 700, { ...gleich, zeit: 10000 }), zeile(2, 2, 700, { ...gleich, zeit: 12000 })])).toEqual({ stich: '* MARKE REGEL', hinweis: null })
  })

  it('voller Gleichstand oder fehlende Zeit: die Regel ohne Sternchen, mit dem Zusatz zum geteilten Platz', () => {
    expect(fuss([zeile(1, 1, 700, { punktgleich: true, zeit: 14200 }), zeile(2, 1, 700, { punktgleich: true, zeit: 14200 })])).toEqual({ stich: null, hinweis: 'REGEL GETEILT' })
    const w = blatt([zeile(1, 1, 900), zeile(2, 2, 400, { punktgleich: true, disq: true }), zeile(3, 2, 400, { punktgleich: true, disq: true })])
    expect(w.find('[data-hinweis="fuss"]').text()).toBe('REGEL GETEILT')
    expect(w.findAll('td[data-spalte="zeit"]').map((t) => t.text())).toEqual(['', '–', '–'])
  })

  it('zweite Stufe (vorletzte Runde, 24.11.2026): ihre Zeit in Klammern hinter der Zeit, die Spalte breiter statt zweizeilig', () => {
    const gleich = { stich: true, punktgleich: true, zeit: 14200 }
    const w = blatt([zeile(1, 1, 700, { ...gleich, zeit2: 8100 }), zeile(2, 2, 700, { ...gleich, zeit2: null }), zeile(3, 3, 500)])
    expect(w.findAll('td[data-spalte="zeit"]').map((t) => t.text())).toEqual(['142.00 (81.00)', '142.00 (–)', ''])
    expect(w.findAll('[data-teil="zeit2"]')).toHaveLength(2)
    expect(w.findAll('colgroup col').at(-1)!.attributes('style')).toContain('32mm')
    // Der Strich in der Klammer (in der vorletzten Runde disqualifiziert) ist im Fuß erklärt wie jeder Strich.
    expect(w.find('[data-hinweis="stich"]').text()).toBe('* MARKE REGEL GETEILT')
    // Ohne zweite Stufe bleibt die Spalte schmal und ohne Klammer.
    const ohne = blatt([zeile(1, 1, 700, { stich: true, punktgleich: true, zeit: 14200 }), zeile(2, 2, 700, { stich: true, punktgleich: true, zeit: 14300 })])
    expect(ohne.find('[data-teil="zeit2"]').exists()).toBe(false)
    expect(ohne.findAll('colgroup col').at(-1)!.attributes('style')).toContain('22mm')
  })

  it('Sternchen und geteilter Platz auf derselben Seite: beides in einer Zeile', () => {
    const gleich = { stich: true, punktgleich: true }
    expect(fuss([zeile(1, 1, 700, { ...gleich, zeit: 10000 }), zeile(2, 2, 700, { ...gleich, zeit: 12000 }), zeile(3, 2, 700, { ...gleich, zeit: 12000 })]).stich).toBe('* MARKE REGEL GETEILT')
  })
})

describe('Platz ganz vorn, Spalten je Disziplin: Zeit, Platz, UIM points – dahinter die Summe (Entscheidungen des Nutzers)', () => {
  const kopf = (zeilen: EinzelZeile[], disziplinen?: ('manoever' | 'parallel')[]) => {
    const w = mount(EinzelwertungBlatt, { props: { klasseText: 'Class 1', titel: 'Individual competition', eventName: 'Test', zeilen, disziplinen, sprache: 'en' } })
    return { w, unter: w.findAll('tr.erg-unterkopf th').map((t) => t.text()), oben: w.findAll('tr.erg-spaltenkopf th').map((t) => t.text()) }
  }
  it('beide Disziplinen: je drei Spalten, keine Spalte Heat', () => {
    const { w, oben, unter } = kopf([zeile(1, 1, 700), zeile(2, 2, 500, { parallelErgebnis: { zeit: null, platz: 6, disq: true }, parallel: 0 })])
    expect(oben).toEqual(['Rank.', 'No.', 'Surname', 'First name', 'Manoeuvring overall', 'Parallel slalom overall', 'UIM combined points'])
    expect(unter).toEqual(['Time', 'Rank.', 'UIM points', 'Time', 'Rank.', 'UIM points'])
    const zelle = (spalte: string) => w.findAll(`tbody td[data-spalte="${spalte}"]`).map((t) => t.text())
    expect([zelle('manoever-zeit'), zelle('manoever-platz'), zelle('manoever')]).toEqual([['61.00', '62.00'], ['1', '2'], ['350', '250']])
    expect([zelle('parallel-zeit'), zelle('parallel-platz'), zelle('parallel')]).toEqual([['81.00', 'DSQ'], ['1', '6'], ['350', '0']])
    expect([zelle('summe'), zelle('platz')]).toEqual([['700', '500'], ['1', '2']])
    expect(w.text()).not.toContain('Heat')
  })
  it('nur eine Disziplin gefahren: Die andere hat keine Spalten', () => {
    const { w, oben, unter } = kopf([zeile(1, 1, 400, { parallel: null, parallelErgebnis: null })], ['manoever'])
    expect(oben).toEqual(['Rank.', 'No.', 'Surname', 'First name', 'Manoeuvring overall', 'UIM combined points'])
    expect(unter).toEqual(['Time', 'Rank.', 'UIM points'])
    expect(w.find('[data-spalte^="parallel"]').exists()).toBe(false)
  })
})

describe('Einzelwertung: Logos im Kopf (16.11.2026)', () => {
  it('mit Logos: links und rechts neben dem Kasten, Texte und Spaltenzahl unverändert', () => {
    localStorage.clear()
    const props = { klasseText: 'Class 1', titel: 'Individual competition', eventName: 'Test', zeilen: [zeile(1, 1, 700)], sprache: 'en' as const }
    const ohne = mount(EinzelwertungBlatt, { props })
    const store = createStore({ idb: null })
    setzeTestLogos(store)
    const mit = mount(EinzelwertungBlatt, { props, global: { provide: { [storeKey as symbol]: store } } })
    expect(ohne.find('th.erg-kopfzelle > .erg-kopf').exists()).toBe(true)
    expect(mit.find('th.erg-kopfzelle > .kopf-logos > .kopf-logos-mitte > .erg-kopf').exists()).toBe(true)
    expect(logoFolge(mit.find('th.erg-kopfzelle').element)).toEqual(['links', 'rechts'])
    const kopf = (w: typeof ohne) => [w.findAll('.erg-kopf span').map((e) => e.text()), w.find('th.erg-kopfzelle').attributes('colspan')]
    expect(kopf(mit)).toEqual(kopf(ohne))
    expect(kopf(mit)[0]).toEqual(['Class 1', 'Individual competition', 'Test'])
  })
})
