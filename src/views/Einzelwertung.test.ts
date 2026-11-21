import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListsView from './ListsView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { laufSchluessel } from '../lib/eingaben'
import { attemptSchluessel } from '../lib/parallelSchluessel'
import { vergissAlles } from '../lib/merken'
import { setLocale } from '../i18n'
import type { ClassId, ParallelRunde, Starter } from '../types'
import { knotenHaken, ohneLogos, seitenKoepfe, setzeTestLogos } from '../testHilfen'

// Einzelwertung über beide Stages (Regel 960, Pkt. 5.2.3) unter „Listen“ und in der Druckdatei,
// die Mannschaftswertung daraus (Pkt. 5.2.4) – und dass ohne Parallelslalom und unter der DM
// alles bleibt, wie es war. Erfundene Starter und Mannschaften – keine echten Personen.
function mk(klasse: ClassId, n: number): Starter[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${klasse}-${i + 1}`,
    startNr: klasse + String(i + 1).padStart(2, '0'),
    vorname: `Vor${i + 1}`,
    nachname: `Nach${klasse}${i + 1}`,
    verein: i % 2 === 0 ? 'Nordland' : 'Südland',
    bundesland: '',
    land: i % 2 === 0 ? 'Nordland' : 'Südland',
    geburtsdatum: '2015-01-01',
    groesse: '',
    klasse,
  }))
}

const mit = (store: Store) => ({ global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
const warte = async () => {
  for (let i = 0; i < 4; i++) await nextTick()
}
/** Bis die Druckdatei alle Dokumente aufgebaut hat (sie kommen in Schritten). */
const warteAufDruckdatei = async (wrapper: VueWrapper) => {
  for (let i = 0; i < 200 && wrapper.find('.druckdatei').attributes('data-fertig') === undefined; i++) await new Promise((r) => setTimeout(r, 0))
  await warte()
}

/** Manövrieren: 1-6 gewinnt … 1-1 ist Letzter. Parallelslalom: umgekehrt. */
const MANOEVER = { '1-6': [60, 70], '1-5': [61, 71], '1-4': [62, 72], '1-3': [63, 73], '1-2': [64, 74], '1-1': [65, 75] }
const VORLAUF = { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43], '1-5': [50, 50], '1-6': [55, 55] }
const VIER = { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] }

describe('Einzelwertung', () => {
  let store: Store

  /** Die Versuche des Manövrierens; die Knoten gelten als erfasst (erst dann stehen die UIM points fest). */
  const manoever = (zeiten: Record<string, number[]>, zeit = Date.UTC(2026, 8, 26, 10)) => {
    store.dispatch({
      type: 'SET_EINGABEN',
      zellen: Object.entries(zeiten).flatMap(([id, je]) => je.map((sek, i) => ({ lauf: laufSchluessel('manoevrieren', i + 1), starter: id, feld: 'zeit1', wert: `${sek},00` }))),
      zeit,
    })
    store.dispatch({ type: 'SET_EINGABEN', zellen: knotenHaken(Object.keys(zeiten)) })
  }
  const fahre = (runde: ParallelRunde, zeiten: Record<string, number[]>, zeit = Date.UTC(2026, 8, 26, 12)) =>
    store.dispatch({
      type: 'SET_EINGABEN',
      zellen: Object.entries(zeiten).flatMap(([id, je]) => je.map((sek, i) => ({ lauf: attemptSchluessel(runde, i + 1), starter: id, feld: 'zeit1', wert: `${sek},00` }))),
      zeit,
    })
  const fest = (runde: ParallelRunde) => store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde })
  /** Kleines Finale und Finale – seit 21.11.2026 zwei eigene Runden, das Kleine zuerst. */
  const finals = () => {
    fest('small')
    fest('final')
    fahre('small', { '1-3': VIER['1-3'], '1-4': VIER['1-4'] }, Date.UTC(2026, 8, 26, 13))
    fahre('final', { '1-1': VIER['1-1'], '1-2': VIER['1-2'] }, Date.UTC(2026, 8, 26, 14))
  }
  /** Der Parallelslalom der Klasse 1 bis zum Ende. */
  const parallel = () => {
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    fahre('pre', VORLAUF)
    fest('semi')
    fahre('semi', VIER)
    finals()
  }

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vergissAlles()
    location.hash = ''
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Hafenpokal' } })
    store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'land' })
    store.dispatch({ type: 'SET_POKAL_UIM', patch: { mindestens: 2 } })
    store.dispatch({ type: 'ADD_STARTERS', starters: mk('1', 6) })
  })
  afterEach(() => {
    setLocale('de')
    document.body.innerHTML = ''
  })

  const listen = async (art: 'ergebnis' | 'pokal' | 'druckdatei', disziplin?: string): Promise<VueWrapper> => {
    const wrapper = mount(ListsView, mit(store))
    await wrapper.find(`.list-kinds button[data-kind="${art}"]`).trigger('click')
    if (disziplin) await wrapper.find(`.disziplin-wahl button[data-disziplin="${disziplin}"]`).trigger('click')
    await warte()
    return wrapper
  }
  const zeilen = (wrapper: VueWrapper) => wrapper.findAll('.listen-seite[data-art="einzel"] tbody tr[data-starter]').map((r) => r.findAll('td').map((z) => z.text()))

  it('ohne einen erfassten Wert: nur der Hinweis, keine Liste', async () => {
    const wrapper = await listen('ergebnis', 'einzel')
    expect(wrapper.find('[data-hinweis="einzel-ohne-werte"]').exists()).toBe(true)
    expect(wrapper.find('[data-feld="nicht-werten"]').exists()).toBe(false)
    expect(wrapper.findAll('.listen-seite')).toHaveLength(0)
    wrapper.unmount()
  })

  it('nur eine Disziplin gefahren: Die Einzelwertung entsteht aus ihr allein – erst das Manövrieren, dann auch nur der Parallelslalom', async () => {
    manoever(MANOEVER)
    const wrapper = await listen('ergebnis', 'einzel')
    const blatt = () => wrapper.find('.listen-seite[data-art="einzel"]')
    // Nur die Spalten der gefahrenen Disziplin und die Summe; nirgends die Nummer einer Stage.
    // Der Platz der Einzelwertung steht ganz vorn (wie auf allen Wertungslisten).
    expect(blatt().findAll('.erg-spaltenkopf th').map((t) => t.text())[0]).toBe('Rank.')
    expect(blatt().findAll('.erg-spaltenkopf th').map((t) => t.text()).slice(-2)).toEqual(['Manoeuvring overall', 'UIM combined points'])
    expect(blatt().findAll('.erg-unterkopf th').map((t) => t.text())).toEqual(['Time', 'Rank.', 'UIM points'])
    // Platz, Nr., Zeit, Platz und Punkte des Manövrierens, Summe.
    expect(zeilen(wrapper).map((z) => [z[0], z[1], ...z.slice(-4)]).slice(0, 3)).toEqual([
      ['1', '106', '60.00', '1', '400', '400'],
      ['2', '105', '61.00', '2', '300', '300'],
      ['3', '104', '62.00', '3', '225', '225'],
    ])
    expect(blatt().find('th.erg-kopfzelle').attributes('colspan')).toBe(String(blatt().findAll('colgroup col').length))
    expect(wrapper.text()).not.toMatch(/stage ?[23]|[23](nd|rd) stage/i)
    wrapper.unmount()
    // Umgekehrt: nur der Parallelslalom, ohne Manövrieren.
    store.dispatch({ type: 'CLEAR_EINGABEN' })
    parallel()
    const nur = await listen('ergebnis', 'einzel')
    expect(nur.find('.listen-seite[data-art="einzel"]').findAll('.erg-spaltenkopf th').map((t) => t.text()).slice(-2)).toEqual(['Parallel slalom overall', 'UIM combined points'])
    // Finalisten mit der Summe ihres Finales; ab Platz 5 die des Vorlaufs – ohne Spalte „Heat“.
    expect(zeilen(nur).map((z) => [z[0], z[1], ...z.slice(-4)])).toEqual([
      ['1', '101', '80.00', '1', '400', '400'],
      ['2', '102', '82.00', '2', '300', '300'],
      ['3', '103', '84.00', '3', '225', '225'],
      ['4', '104', '86.00', '4', '169', '169'],
      ['5', '105', '100.00', '5', '127', '127'],
      ['6', '106', '110.00', '6', '95', '95'],
    ])
    expect(nur.find('.listen-seite[data-art="einzel"]').text()).not.toContain('Heat')
    nur.unmount()
  })

  it('„Disziplin nicht werten“: Schalter je Disziplin und Klasse mit „Alle Klassen“; die Liste und die Mannschaftswertung nennen es', async () => {
    store.dispatch({ type: 'ADD_STARTERS', starters: mk('2', 2) })
    manoever({ ...MANOEVER, '2-1': [60, 70], '2-2': [61, 71] })
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    // Der Parallelslalom wird in Klasse 1 nach dem Vorlauf abgebrochen.
    fahre('pre', VORLAUF)
    const wrapper = await listen('ergebnis', 'einzel')
    const wahl = (disziplin: string) => wrapper.find(`[data-feld="nicht-werten"] [data-disziplin="${disziplin}"]`)
    expect(wrapper.find('[data-feld="nicht-werten"]').text()).toContain('Entscheidung des O.O.D.')
    expect(wrapper.find('[data-hinweis="einzel-offen"]').text()).toContain('Klasse 1 (Halbfinale)')
    await wahl('parallel').find('input[data-klasse="1"]').setValue(true)
    await warte()
    expect(store.state.value.nichtWerten).toEqual({ parallel: ['1'] })
    // Klasse 1 zählt jetzt allein aus dem Manövrieren; das Blatt sagt, was fehlt.
    const blatt = wrapper.find('.listen-seite[data-art="einzel"][data-klasse="1"]')
    expect(blatt.findAll('.erg-spaltenkopf th').map((t) => t.text()).slice(-2)).toEqual(['Manoeuvring overall', 'UIM combined points'])
    expect(blatt.find('.erg-fuss').text()).toContain('Parallel slalom not scored – decision of the O.O.D.')
    // Auch die Listen der Disziplin selbst sagen es: das Ergebnis jeder Runde der Klasse (nicht die der anderen).
    await wrapper.find('.disziplin-wahl button[data-disziplin="parallel"]').trigger('click')
    await warte()
    expect(wrapper.find('.listen-seite[data-art="gesamt"][data-klasse="1"] .erg-fuss').text()).toContain('Parallel slalom not scored – decision of the O.O.D.')
    // Die Gesamtliste des Manövrieren zählt weiter und trägt keinen Hinweis.
    await wrapper.find('.disziplin-wahl button[data-disziplin="manoever"]').trigger('click')
    await warte()
    const gesamtM = wrapper.findAll('.listen-seite[data-art="gesamt"]')
    expect(gesamtM.length).toBeGreaterThan(0)
    expect(gesamtM.some((b) => b.find('.erg-fuss').text().includes('not scored'))).toBe(false)
    await wrapper.find('.disziplin-wahl button[data-disziplin="einzel"]').trigger('click')
    await warte()
    // Die Abkürzung für alle Klassen – und zurück.
    await wahl('parallel').find('[data-action="nicht-werten-alle"]').trigger('click')
    expect(store.state.value.nichtWerten.parallel).toEqual(['E', '1', '2', '3', '4', '5'])
    await wahl('parallel').find('[data-action="nicht-werten-keine"]').trigger('click')
    expect(store.state.value.nichtWerten).toEqual({})
    await wahl('parallel').find('input[data-klasse="1"]').setValue(true)
    wrapper.unmount()
    // Mannschaftswertung: Hinweis über der Liste und auf dem Blatt.
    const pokal = await listen('pokal')
    expect(pokal.find('[data-hinweis="pokal-nicht-werten"]').text()).toContain('Parallel-Slalom – Klasse 1')
    expect(pokal.find('.ergebnis-blatt[data-art="pokal-uim"] thead [data-hinweis="grundlage"]').text()).toBe('Not scored (decision of the O.O.D.): Parallel slalom – Class 1.')
    pokal.unmount()
  })

  it('„Disziplin nicht werten“: Auf den Listen der Disziplin entfällt für die Klasse die Spalte „UIM points“ – Zeiten, Plätze, „Qualified“ und der Hinweis bleiben', async () => {
    store.dispatch({ type: 'ADD_STARTERS', starters: mk('2', 2) })
    manoever({ ...MANOEVER, '2-1': [60, 70], '2-2': [61, 71] })
    parallel()
    store.dispatch({ type: 'SET_NICHT_WERTEN', disziplin: 'parallel', klassen: ['1'], an: true })
    store.dispatch({ type: 'SET_NICHT_WERTEN', disziplin: 'manoever', klassen: ['1'], an: true })
    const kopf = (blatt: ReturnType<VueWrapper['find']>) => blatt.findAll('thead th[rowspan], thead .erg-spaltenkopf th').map((t) => t.text())
    /** Die Zellen der Spalte „UIM points“; eine zusammengefasste mit „×n“ (über n Zeilen). */
    const spalte = (blatt: ReturnType<VueWrapper['find']>) => blatt.findAll('tbody td[data-spalte="uim-punkte"]').map((t) => (t.attributes('rowspan') ? `${t.text()} ×${t.attributes('rowspan')}` : t.text()))
    /** Die Tabelle bleibt so breit wie die Seite: Der Kopf überspannt genau die Spalten. */
    const breit = (blatt: ReturnType<VueWrapper['find']>) => expect(blatt.find('th.erg-kopfzelle').attributes('colspan')).toBe(String(blatt.findAll('colgroup col').length))

    // Manövrieren: Gesamtliste der Klasse 1 ohne die Spalte, mit Hinweis; Klasse 2 wie immer.
    const m = await listen('ergebnis', 'manoever')
    const m1 = m.find('.listen-seite[data-art="gesamt"][data-klasse="1"]')
    const m2 = m.find('.listen-seite[data-art="gesamt"][data-klasse="2"]')
    expect(m1.find('[data-spalte="uim-punkte"]').exists()).toBe(false)
    expect(m1.find('.erg-fuss').text()).toContain('Manoeuvring not scored – decision of the O.O.D.')
    expect(m1.findAll('tbody tr[data-starter] td.erg-platz').map((t) => t.text())).toEqual(['1', '2', '3', '4', '5', '6'])
    breit(m1)
    expect(m2.find('th[data-spalte="uim-punkte"]').text()).toBe('UIM points')
    expect(spalte(m2)).toEqual(['400', '300'])
    breit(m2)
    m.unmount()

    // Parallelslalom: Im Vorlauf bleibt die Spalte „UIM points“ in derselben Form – der Block
    // „Qualified“, die übrigen Zellen leer; der Hinweis darunter sagt, warum (keine Spalte „Remark“) …
    const p = await listen('ergebnis', 'parallel')
    const runde = async (r: string) => {
      await p.find('select[data-feld="perg-runde"]').setValue(r)
      await warte()
      return p.find('.listen-seite[data-art="gesamt"][data-klasse="1"]')
    }
    const pre = await runde('pre')
    expect(pre.find('th[data-spalte="uim-punkte"]').text()).toBe('UIM points')
    expect(spalte(pre)).toEqual(['Qualified ×4', '', ''])
    expect(pre.find('.erg-fuss').text()).toContain('Parallel slalom not scored – decision of the O.O.D.')
    expect(p.text()).not.toContain('Remark')
    breit(pre)
    // … im Halbfinale die Blöcke der Finals; in Kleinem Finale und Finale gibt es die Spalte nicht.
    const semi = await runde('semi')
    expect(semi.find('th[data-spalte="uim-punkte"]').text()).toBe('UIM points')
    expect(spalte(semi)).toEqual(['Final 1–2 ×2', 'Small final ×2'])
    const klein = await runde('small')
    expect(klein.find('[data-spalte="uim-punkte"]').exists()).toBe(false)
    expect(klein.find('.erg-fuss').text()).toContain('not scored')
    const finale = await runde('final')
    expect(finale.find('[data-spalte="uim-punkte"]').exists()).toBe(false)
    expect(finale.find('.erg-fuss').text()).toContain('not scored')
    breit(finale)
    // Overall results: Platz und Zeit bleiben, die Punkte entfallen.
    await p.find('select[data-feld="perg-runde"]').setValue('stage')
    await warte()
    const stage = p.find('.listen-seite[data-art="stage"]')
    expect(kopf(stage)).not.toContain('UIM points')
    expect(stage.find('[data-spalte="uim-punkte"]').exists()).toBe(false)
    expect(stage.findAll('tbody td.erg-platz').map((t) => t.text())).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(stage.findAll('tbody td[data-spalte="summe"]').map((t) => t.text()).slice(0, 2)).toEqual(['80.00', '82.00'])
    breit(stage)
    p.unmount()

    // Wieder gewertet: Die Spalten sind zurück.
    store.dispatch({ type: 'SET_NICHT_WERTEN', disziplin: 'parallel', klassen: ['1'], an: false })
    const q = await listen('ergebnis', 'parallel')
    await q.find('select[data-feld="perg-runde"]').setValue('pre')
    await warte()
    expect(q.find('.listen-seite[data-art="gesamt"][data-klasse="1"] th[data-spalte="uim-punkte"]').text()).toBe('UIM points')
    expect(spalte(q.find('.listen-seite[data-art="gesamt"][data-klasse="1"]'))).toEqual(['Qualified ×4', '127', '95'])
    q.unmount()
  })

  it('solange eine Stage der Klasse läuft, sagt die Ansicht, woran es hängt', async () => {
    manoever(MANOEVER)
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    fahre('pre', VORLAUF)
    const wrapper = await listen('ergebnis', 'einzel')
    expect(wrapper.find('[data-hinweis="einzel-offen"]').text()).toContain('Klasse 1 (Halbfinale)')
    expect(wrapper.find('[data-hinweis="einzel-leer"]').exists()).toBe(true)
    expect(wrapper.findAll('.listen-seite')).toHaveLength(0)
    wrapper.unmount()
  })

  it('die Liste „Individual competition“: Punkte beider Stages, Summe, Platz, Zeit bei Punktgleichen – mit O.O.D., Time of posting und Zeitstempel', async () => {
    manoever(MANOEVER)
    parallel()
    const wrapper = await listen('ergebnis', 'einzel')
    const blatt = wrapper.find('.listen-seite[data-art="einzel"]')
    expect(blatt.find('.erg-kopf-titel').text()).toBe('Individual competition')
    // Ganz vorn der Platz, dann je Disziplin Zeit, Platz und UIM points ihres Gesamtergebnisses, dahinter die Summe
    // und die Zeit nur für Punktgleiche (Entscheidungen des Nutzers).
    expect(blatt.findAll('.erg-spaltenkopf th').map((t) => t.text())[0]).toBe('Rank.')
    expect(blatt.findAll('.erg-spaltenkopf th').map((t) => t.text()).slice(-4)).toEqual(['Manoeuvring overall', 'Parallel slalom overall', 'UIM combined points', 'Combined time'])
    expect(blatt.findAll('.erg-unterkopf th').map((t) => t.text())).toEqual(['Time', 'Rank.', 'UIM points', 'Time', 'Rank.', 'UIM points'])
    // Platz, Nr., … Manövrieren (Zeit, Platz, Punkte), Parallelslalom (Zeit, Platz, Punkte), Summe, Zeit.
    // Je zwei sind punktgleich; die Zeit trennt sie. Ab Platz 5 stammt die Zeit des Parallelslaloms aus dem Vorlauf.
    expect(zeilen(wrapper).map((z) => [z[0], z[1], ...z.slice(-8)])).toEqual([
      ['1*', '101', '65.00', '6', '95', '80.00', '1', '400', '495', '145.00'],
      ['2*', '106', '60.00', '1', '400', '110.00', '6', '95', '495', '170.00'],
      ['3*', '102', '64.00', '5', '127', '82.00', '2', '300', '427', '146.00'],
      ['4*', '105', '61.00', '2', '300', '100.00', '5', '127', '427', '161.00'],
      ['5*', '103', '63.00', '4', '169', '84.00', '3', '225', '394', '147.00'],
      ['6*', '104', '62.00', '3', '225', '86.00', '4', '169', '394', '148.00'],
    ])
    expect(blatt.text()).not.toContain('Heat')
    expect(blatt.find('[data-hinweis="stich"]').text()).toContain('best combined times')
    // Der Kopf reicht über genau die Spalten der Tabelle.
    expect(blatt.find('th.erg-kopfzelle').attributes('colspan')).toBe(String(blatt.findAll('colgroup col').length))
    const fuss = blatt.find('.erg-fuss.erg-fuss--unterschrift [data-feld="unterschrift"]')
    expect(fuss.find('.erg-unterschrift-wer').text()).toBe('O.O.D.')
    expect(fuss.find('[data-feld="aushang-zeit"]').text()).toBe('Time of posting')
    // Der jüngste Zeitpunkt der Klasse aus beiden Stages: das Finale.
    expect(blatt.find('.erg-stand').text()).toMatch(/^Last change: 2026-09-26 \d\d:00:00$/)
    const stand = blatt.find('.erg-stand').text()
    // Eine spätere Änderung im Manövrieren zieht die Einzelwertung nach.
    manoever({ '1-1': [66] }, Date.UTC(2026, 8, 26, 16, 0, 5))
    await warte()
    expect(wrapper.find('.listen-seite[data-art="einzel"] .erg-stand').text()).not.toBe(stand)
    expect(wrapper.find('.listen-seite[data-art="einzel"] .erg-stand').text()).toMatch(/:00:05$/)
    wrapper.unmount()
  })

  it('mit Logos (16.11.2026): links und rechts neben dem Kasten der Einzelwertung, sonst alles wie ohne', async () => {
    manoever(MANOEVER)
    parallel()
    const KOPF = ['.erg-kopf span:not(.erg-stand)', 'th.erg-kopfzelle'] as const
    const vorher = await listen('ergebnis', 'einzel')
    const ohne = seitenKoepfe(vorher.find('.listen-seite[data-art="einzel"]').element.parentElement!, ...KOPF)
    vorher.unmount()
    expect(ohne.length).toBeGreaterThan(0)
    expect(ohne.every((x) => x.logos.length === 0)).toBe(true)
    setzeTestLogos(store)
    const wrapper = await listen('ergebnis', 'einzel')
    const mit = seitenKoepfe(wrapper.find('.listen-seite[data-art="einzel"]').element.parentElement!, ...KOPF)
    expect(mit.map((x) => x.logos)).toEqual(mit.map(() => ['links', 'rechts']))
    expect(ohneLogos(mit)).toEqual(ohneLogos(ohne))
    expect(mit[0].kopf).toContain('Individual competition')
    wrapper.unmount()
  })

  it('ohne Punktgleiche gibt es keine Spalte der Zeit und kein Sternchen', async () => {
    // Das Manövrieren in derselben Folge wie der Parallelslalom: 1-1 gewinnt beides.
    manoever({ '1-1': [60, 70], '1-2': [61, 71], '1-3': [62, 72], '1-4': [63, 73], '1-5': [64, 74], '1-6': [65, 75] })
    parallel()
    const wrapper = await listen('ergebnis', 'einzel')
    expect(wrapper.find('.listen-seite[data-art="einzel"] th[data-spalte="zeit"]').exists()).toBe(false)
    expect(wrapper.find('.listen-seite[data-art="einzel"] th.erg-kopfzelle').attributes('colspan')).toBe('12')
    expect(zeilen(wrapper).map((z) => z.join(' '))).toEqual([
      '1 101 Nach11 Vor1 Nordland 60.00 1 400 80.00 1 400 800',
      '2 102 Nach12 Vor2 Südland 61.00 2 300 82.00 2 300 600',
      '3 103 Nach13 Vor3 Nordland 62.00 3 225 84.00 3 225 450',
      '4 104 Nach14 Vor4 Südland 63.00 4 169 86.00 4 169 338',
      '5 105 Nach15 Vor5 Nordland 64.00 5 127 100.00 5 127 254',
      '6 106 Nach16 Vor6 Südland 65.00 6 95 110.00 6 95 190',
    ])
    expect(wrapper.find('.listen-seite[data-art="einzel"] [data-hinweis="stich"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('Mannschaftswertung: Sobald der Parallelslalom gewertet wird, zählen die Punkte beider Disziplinen – der Hinweis „Manoeuvring only“ entfällt', async () => {
    manoever(MANOEVER)
    const wrapper = await listen('pokal')
    const blatt = () => wrapper.find('.ergebnis-blatt[data-art="pokal-uim"]')
    const summen = () => wrapper.findAll('.ergebnis-blatt[data-art="pokal-uim"] tbody').map((b) => [b.attributes('data-herkunft'), ...b.findAll('.pokal-gruppe-summe td').slice(-2).map((z) => z.text())])
    // Ohne Parallelslalom wie bisher: nur das Manövrieren, mit Hinweis.
    expect(blatt().find('thead [data-hinweis="grundlage"]').text()).toBe('Manoeuvring only – nothing has been recorded for Parallel slalom yet.')
    expect(wrapper.find('[data-hinweis="pokal-aus-einzel"]').exists()).toBe(false)
    expect(summen()).toEqual([
      ['Südland', '752', '1'],
      ['Nordland', '564', '2'],
    ])
    const standManoever = blatt().find('.erg-stand').text()
    // Der Vorlauf wird gefahren: Die Wertung rechnet aus beiden Stages und ist ein Zwischenstand.
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    fahre('pre', VORLAUF)
    await warte()
    expect(blatt().find('thead [data-hinweis="grundlage"]').exists()).toBe(false)
    expect(wrapper.find('[data-hinweis="pokal-aus-einzel"]').exists()).toBe(true)
    expect(blatt().find('.pokal-kopf-regel').text()).toContain('Manoeuvring + Parallel slalom')
    expect(blatt().text()).not.toMatch(/stage/i)
    expect(blatt().find('[data-hinweis="fuss"]').text()).toContain('1: Semi-finals')
    expect(wrapper.find('[data-hinweis="pokal-zwischenstand"]').exists()).toBe(true)
    // Der Zeitstempel folgt jetzt auch den Runden des Parallelslaloms.
    const standVorlauf = blatt().find('.erg-stand').text()
    expect(standVorlauf > standManoever).toBe(true)
    // Bis zum Ende gefahren: Summe beider Stages je Starter, punktgleich – es entscheidet der 1. Platz der Einzelwertung.
    fest('semi')
    fahre('semi', VIER)
    finals()
    await warte()
    expect(summen()).toEqual([
      ['Nordland', '1316', '1*'],
      ['Südland', '1316', '2*'],
    ])
    expect(wrapper.find('[data-hinweis="pokal-zwischenstand"]').exists()).toBe(false)
    expect(blatt().find('[data-hinweis="fuss"]').exists()).toBe(false)
    // Platz der Einzelwertung und addierte Punkte je Starter.
    expect(wrapper.findAll('.ergebnis-blatt[data-art="pokal-uim"] tbody[data-herkunft="Nordland"] tr[data-starter]').map((r) => [r.findAll('td')[0].text(), r.findAll('td')[2].text(), r.findAll('td')[5].text()])).toEqual([
      ['1', '101', '495'],
      ['4', '105', '427'],
      ['5', '103', '394'],
    ])
    expect(blatt().find('.erg-stand').text() > standVorlauf).toBe(true)
    wrapper.unmount()
  })

  it('Druckdatei nach Regel 960: Mannschaftswertung, Codes, Einzelwertung, dann je Disziplin – vor jeder Runde ihre Startliste', async () => {
    manoever(MANOEVER)
    parallel()
    const wrapper = await listen('druckdatei')
    await warteAufDruckdatei(wrapper)
    expect(wrapper.findAll('.druckdatei-wahl input[data-teil]').map((i) => i.attributes('data-teil'))).toEqual(['starter', 'pokal', 'einzel', 'codes', 'ergebnis', 'parallel'])
    const folge = wrapper.findAll('.druckdatei-teil').map((t) => [t.attributes('data-teil'), t.attributes('data-runde')].filter(Boolean).join(':'))
    // Erst, was alle suchen; die verzahnte Starterliste steht vor den Listen des Manövrierens.
    expect(folge.slice(0, 5)).toEqual(['pokal', 'codes', 'einzel', 'starter', 'ergebnis'])
    // Parallelslalom: das Gesamtergebnis, dann je Runde erst die Startliste, dann ihre Wertungslisten.
    expect(folge.slice(5, 8)).toEqual(['parallel:stage', 'startliste:pre', 'parallel:pre'])
    const runden = folge.slice(6)
    expect(runden.filter((_, i) => i % 2 === 0).every((f) => f.startsWith('startliste:'))).toBe(true)
    expect(runden.filter((_, i) => i % 2 === 1)).toEqual(runden.filter((_, i) => i % 2 === 0).map((f) => f.replace('startliste:', 'parallel:')))
    // Die Startliste des Vorlaufs: je Start eine Zeile, die Blöcke bleiben zusammen.
    const startliste = wrapper.find('.druckdatei-teil[data-teil="startliste"][data-runde="pre"]')
    expect(startliste.find('.sheet-title-box [data-feld="liste"]').text()).toBe('Starting order')
    expect(startliste.findAll('tbody tr').length).toBe(store.state.value.parallelPlaene.pre!.starts.length)
    expect(wrapper.findAll('.druckdatei-teil[data-teil="einzel"] .listen-seite').map((s) => [s.attributes('data-art'), s.attributes('data-klasse')])).toEqual([['einzel', '1']])
    await wrapper.find('.druckdatei-wahl input[data-teil="einzel"]').setValue(false)
    await warteAufDruckdatei(wrapper)
    expect(wrapper.find('.druckdatei-teil[data-teil="einzel"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('Druckdatei: ohne Werte weder Kästchen noch Dokument; nur mit dem Manövrieren die Einzelwertung daraus – ohne Teil „Parallel-Slalom“', async () => {
    const leer = await listen('druckdatei')
    await warteAufDruckdatei(leer)
    expect(leer.findAll('.druckdatei-wahl input[data-teil]').map((i) => i.attributes('data-teil'))).not.toContain('einzel')
    leer.unmount()
    manoever(MANOEVER)
    const wrapper = await listen('druckdatei')
    await warteAufDruckdatei(wrapper)
    expect(wrapper.findAll('.druckdatei-teil').map((t) => t.attributes('data-teil'))).toEqual(['pokal', 'codes', 'einzel', 'starter', 'ergebnis'])
    expect(wrapper.findAll('.druckdatei-teil[data-teil="einzel"] .listen-seite').map((s) => [s.attributes('data-art'), s.attributes('data-klasse')])).toEqual([['einzel', '1']])
    wrapper.unmount()
  })

  it('Bögen und Laufzettel kennen die Einzelwertung nicht: Die Wahl gilt dort wie „Manövrieren“', async () => {
    const wrapper = await listen('ergebnis', 'einzel')
    await wrapper.find('.list-kinds button[data-kind="wkr"]').trigger('click')
    await warte()
    expect(wrapper.findAll('.disziplin-wahl button').map((b) => b.attributes('data-disziplin'))).toEqual(['manoever', 'parallel'])
    expect(wrapper.find('.disziplin-wahl button.active').attributes('data-disziplin')).toBe('manoever')
    wrapper.unmount()
  })
})

describe('Unter der DM bleibt alles, wie es war', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vergissAlles()
    location.hash = ''
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Hafenpokal' } })
    store.dispatch({ type: 'ADD_STARTERS', starters: mk('1', 6) })
    store.dispatch({
      type: 'SET_EINGABEN',
      zellen: Object.entries(MANOEVER).flatMap(([id, je]) => je.map((sek, i) => ({ lauf: laufSchluessel('manoevrieren', i + 1), starter: id, feld: 'zeit1', wert: `${sek},00` }))),
      zeit: Date.UTC(2026, 8, 26, 10),
    })
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('keine Wahl der Disziplin, keine Einzelwertung, kein Teil in der Druckdatei; die Mannschaftswertung nach UIM-Punkten rechnet aus der Gesamtliste', async () => {
    expect(store.state.value.regelwerk).toBe('dm-2026')
    const wrapper = mount(ListsView, mit(store))
    await wrapper.find('.list-kinds button[data-kind="ergebnis"]').trigger('click')
    await warte()
    expect(wrapper.find('.disziplin-wahl').exists()).toBe(false)
    expect(wrapper.find('[data-listen="einzelwertung"]').exists()).toBe(false)
    await wrapper.find('.list-kinds button[data-kind="pokal"]').trigger('click')
    await wrapper.find('.cup-wahl button[data-variante="uim"]').trigger('click')
    await warte()
    const blatt = wrapper.find('.ergebnis-blatt[data-art="pokal-uim"]')
    expect(blatt.find('thead [data-hinweis="grundlage"]').exists()).toBe(false)
    expect(wrapper.find('[data-hinweis="pokal-aus-einzel"]').exists()).toBe(false)
    expect(blatt.find('.pokal-kopf-regel').text()).toBe('UIM-Punkte · die 5 Besten je Verein')
    expect(blatt.findAll('tbody tr[data-starter]').map((r) => [r.findAll('td')[0].text(), r.findAll('td')[5].text()])).toEqual([
      ['1', '400'],
      ['3', '225'],
      ['5', '127'],
      ['2', '300'],
      ['4', '169'],
      ['6', '95'],
    ])
    await wrapper.find('.list-kinds button[data-kind="druckdatei"]').trigger('click')
    await warteAufDruckdatei(wrapper)
    expect(wrapper.findAll('.druckdatei-wahl input[data-teil]').map((i) => i.attributes('data-teil'))).toEqual(['starter', 'pokal', 'codes', 'ergebnis'])
    expect(wrapper.findAll('.druckdatei-teil').map((t) => t.attributes('data-teil'))).toEqual(['starter', 'pokal', 'codes', 'ergebnis'])
    wrapper.unmount()
  })
})
