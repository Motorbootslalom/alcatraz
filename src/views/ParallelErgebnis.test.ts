import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListsView from './ListsView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { attemptSchluessel } from '../lib/parallelSchluessel'
import { vergissAlles } from '../lib/merken'
import { setLocale } from '../i18n'
import type { ClassId, Starter } from '../types'

// Die Wertungslisten des Vorlaufs unter „Listen“ und in der Druckdatei. Erfundene Starter – keine echten Personen.
function mk(klasse: ClassId, n: number): Starter[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${klasse}-${i + 1}`,
    startNr: klasse + String(i + 1).padStart(2, '0'),
    vorname: 'Vor',
    nachname: `Nach${klasse}${i + 1}`,
    verein: 'Club',
    bundesland: '',
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

describe('Parallelslalom: Wertungslisten des Vorlaufs', () => {
  let store: Store

  /** Je Starter die beiden Attempts in Sekunden. */
  const vorlauf = (zeiten: Record<string, number[]>, zeit = 1000) =>
    store.dispatch({
      type: 'SET_EINGABEN',
      zellen: Object.entries(zeiten).flatMap(([id, je]) => je.map((sek, i) => ({ lauf: attemptSchluessel('pre', i + 1), starter: id, feld: 'zeit1', wert: `${sek},00` }))),
      zeit,
    })

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vergissAlles()
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Hafenpokal' } })
    store.dispatch({ type: 'ADD_STARTERS', starters: [...mk('1', 6), ...mk('2', 2)] })
  })
  afterEach(() => {
    setLocale('de')
    document.body.innerHTML = ''
  })

  const listen = async (disziplin = 'parallel'): Promise<VueWrapper> => {
    const wrapper = mount(ListsView, mit(store))
    await wrapper.find('.list-kinds button[data-kind="ergebnis"]').trigger('click')
    await wrapper.find(`.disziplin-wahl button[data-disziplin="${disziplin}"]`).trigger('click')
    await warte()
    return wrapper
  }
  const zeilen = (wrapper: VueWrapper, art: string, klasse: string) =>
    wrapper.findAll(`.listen-seite[data-art="${art}"][data-klasse="${klasse}"] tbody tr[data-starter]`).map((r) => r.findAll('td').map((z) => z.text()))
  /** Die Zellen der Spalte „UIM points“ von oben nach unten; eine zusammengefasste mit „×n“ (über n Zeilen). */
  const uimZellen = (wrapper: VueWrapper, klasse: string) =>
    wrapper.findAll(`.listen-seite[data-art="gesamt"][data-klasse="${klasse}"] tbody td[data-spalte="uim-punkte"]`).map((t) => (t.attributes('rowspan') ? `${t.text()} ×${t.attributes('rowspan')}` : t.text()))

  it('ohne festgeschriebenen Plan nur der Hinweis; mit Plan, aber ohne Werte: nichts zu drucken', async () => {
    const wrapper = await listen()
    expect(wrapper.find('[data-hinweis="parallel-plan"]').text()).toContain('festgeschrieben')
    expect(wrapper.findAll('.listen-seite')).toHaveLength(0)
    expect(wrapper.find('.btn.primary').attributes('disabled')).toBeDefined()
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    await warte()
    expect(wrapper.find('[data-hinweis="parallel-plan"]').exists()).toBe(false)
    expect(wrapper.find('[data-hinweis="parallel-leer"]').exists()).toBe(true)
    expect(wrapper.find('.btn.primary').attributes('disabled')).toBeDefined()
  })

  it('je Klasse die Liste der Attempts (zwei Tabellen mit Racecourse) und das Result – englisch, mit Zeitstempel und O.O.D.', async () => {
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    vorlauf({ '1-1': [40, 41], '1-2': [41, 42], '1-3': [42, 43], '1-4': [43, 44], '1-5': [44, 45], '1-6': [45, 46], '2-1': [50, 51] })
    const wrapper = await listen()
    const seiten = wrapper.findAll('.ergebnis-stapel[data-stapel="parallel"] .listen-seite')
    expect(seiten.map((s) => `${s.attributes('data-klasse')}/${s.attributes('data-art')}`)).toEqual(['1/attempts', '1/gesamt', '2/attempts', '2/gesamt'])
    expect(wrapper.find('.ergebnis-zahl').text()).toBe('4 Listen')
    expect(wrapper.find('.btn.primary').attributes('disabled')).toBeUndefined()

    // Liste der Attempts: Kopf, zwei Tabellen, Spalte Racecourse, die Fehlerspalten des Fahrwegs.
    const attempts = seiten[0]
    expect(attempts.findAll('.erg-kopf span').map((s) => s.text()).slice(0, 2)).toEqual(['Class 1', 'Preliminary heat – Attempts'])
    expect(attempts.find('.erg-kopf-event').text()).toMatch(/^Parallel slalom · Hafenpokal/)
    expect(attempts.findAll('[data-titel="tabelle"]').map((t) => t.text())).toEqual(['1st attempt', '2nd attempt'])
    const kopf = attempts.findAll('.erg-spaltenkopf th').map((t) => t.text())
    // Ohne Spalte „Rank.“: Es zählt die Summe beider Attempts, nicht der Platz im einzelnen.
    expect(kopf.slice(0, 4)).toEqual(['No.', 'Surname', 'First name', 'Club'])
    expect(kopf.slice(4, 7)).toEqual(['Racecourse', 'Time', 'Sec.'])
    expect(kopf.slice(7, 20)).toEqual(['Leav.', 'Start', '1', '2', '3', '4', '5', '4', '3', '2', '1', 'Fin.', 'Moor.'])
    expect(attempts.findAll('tbody')).toHaveLength(2)
    expect(attempts.findAll('tbody tr[data-starter]')).toHaveLength(12)
    // Im 2. Attempt fährt jeder auf dem anderen Racecourse.
    const rc = (attempt: string) => Object.fromEntries(attempts.findAll(`tbody tr[data-attempt="${attempt}"]`).map((r) => [r.attributes('data-starter'), r.attributes('data-racecourse')]))
    for (const [id, erster] of Object.entries(rc('1'))) expect(rc('2')[id]).toBe(erster === 'A' ? 'B' : 'A')
    expect(attempts.find('[data-feld="unterschrift"]').text()).toContain('O.O.D.')
    expect(attempts.find('[data-feld="aushang-zeit"]').text()).toBe('Time of posting')
    expect(attempts.find('.erg-stand').text()).not.toBe('')

    // Result: Spalten nach Pkt. 5.2.2; die besten vier „Qualified“, ab Platz 5 die Punkte.
    const result = seiten[1]
    expect(result.findAll('.erg-kopf span').map((s) => s.text()).slice(0, 2)).toEqual(['Class 1', 'Preliminary heat – Results'])
    expect(result.findAll('.erg-spaltenkopf th').map((t) => t.text()).slice(-4)).toEqual(['1st attempt', '2nd attempt', 'Combined time', 'UIM points'])
    expect(result.findAll('.erg-unterkopf th').map((t) => t.text())).toEqual(['Racecourse', 'Time', 'Pen.', 'Time incl. pen.', 'Racecourse', 'Time', 'Pen.', 'Time incl. pen.'])
    const r = zeilen(wrapper, 'gesamt', '1')
    expect(r.map((z) => `${z[0]} ${z[1]}`)).toEqual(['1 101', '2 102', '3 103', '4 104', '5 105', '6 106'])
    expect(result.findAll('tbody td[data-spalte="summe"]').map((t) => t.text())).toEqual(['81.00', '83.00', '85.00', '87.00', '89.00', '91.00'])
    // „Qualified“ der vier Besten steht in EINER Zelle über ihre vier Zeilen, schräg (Entscheidung des Nutzers vom 15.11.2026).
    expect(uimZellen(wrapper, '1')).toEqual(['Qualified ×4', '127', '95'])
    const block = result.find('td.erg-block')
    expect(block.attributes('data-zeilen')).toBe('4')
    expect(block.find('.erg-schraeg').attributes('style')).toMatch(/font-size: [\d.]+mm; transform: translate\(-50%, -50%\) rotate\(-\d+(\.\d)?deg\)/)
    expect(result.find('[data-feld="unterschrift"]').exists()).toBe(true)
    // Klasse 2: Einer ist noch nicht gefahren – keine Punkte, kein „Qualified“.
    expect(uimZellen(wrapper, '2')).toEqual(['', ''])
    expect(wrapper.find('[data-hinweis="parallel-offen"]').text()).toContain('Klasse 2')
    expect(wrapper.find('[data-hinweis="parallel-entschieden"]').text()).toContain('Klasse 1')
    expect(wrapper.find('[data-hinweis="parallel-gleichstand"]').exists()).toBe(false)
  })

  it('Ansicht nach Racecourse: andere Tabellen, dieselben Werte – gemerkt, ohne den Stand zu ändern', async () => {
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    vorlauf({ '1-1': [40, 41], '1-2': [41, 42], '1-3': [42, 43], '1-4': [43, 44], '1-5': [44, 45], '1-6': [45, 46] })
    const wrapper = await listen()
    const fahrten = () =>
      wrapper
        .findAll('.listen-seite[data-art="attempts"] tbody tr[data-starter]')
        .map((r) => [r.attributes('data-starter'), r.attributes('data-attempt'), r.attributes('data-racecourse'), ...r.findAll('td:not([data-spalte="wechsel"])').map((z) => z.text())].join('|'))
        .sort()
    const vorher = { fahrten: fahrten(), result: zeilen(wrapper, 'gesamt', '1'), stand: store.state.value, zeit: wrapper.find('.erg-stand').text() }
    expect(wrapper.find('.listen-seite[data-art="attempts"]').attributes('data-ansicht')).toBe('attempt')

    await wrapper.find('.ergebnis-wahl [data-ansicht="racecourse"]').trigger('click')
    await warte()
    const blatt = wrapper.find('.listen-seite[data-art="attempts"]')
    expect(blatt.attributes('data-ansicht')).toBe('racecourse')
    expect(blatt.findAll('[data-titel="tabelle"]').map((t) => t.text())).toEqual(['Racecourse A', 'Racecourse B'])
    expect(blatt.find('th[data-spalte="wechsel"]').text()).toBe('Attempt')
    expect(blatt.findAll('tbody').map((b) => [...new Set(b.findAll('tr[data-starter]').map((r) => r.attributes('data-racecourse')))])).toEqual([['A'], ['B']])
    expect(fahrten()).toEqual(vorher.fahrten)
    expect(zeilen(wrapper, 'gesamt', '1')).toEqual(vorher.result)
    expect(wrapper.find('.erg-stand').text()).toBe(vorher.zeit)
    // Die Ansicht ist Bedienung: Der Stand der Veranstaltung ist dasselbe Objekt.
    expect(store.state.value).toBe(vorher.stand)

    // Gemerkt wie die Fassung: Eine neu aufgebaute Ansicht zeigt wieder „nach Racecourse“.
    wrapper.unmount()
    const neu = await listen()
    expect(neu.find('.ergebnis-wahl [data-ansicht="racecourse"]').attributes('aria-pressed')).toBe('true')
    await neu.find('.ergebnis-wahl [data-ansicht="attempt"]').trigger('click')
    await warte()
    expect(neu.findAll('.listen-seite[data-art="attempts"] tbody tr[data-starter]').map((r) => [r.attributes('data-starter'), r.attributes('data-attempt'), r.attributes('data-racecourse'), ...r.findAll('td:not([data-spalte="wechsel"])').map((z) => z.text())].join('|')).sort()).toEqual(vorher.fahrten)
  })

  it('Gleichstand an der Grenze 4/5: Warnung, „Re-run“ statt „Qualified“ – Umfang und Reihenfolge wählen die Blätter', async () => {
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    vorlauf({ '1-1': [40, 41], '1-2': [41, 42], '1-3': [42, 43], '1-4': [43, 45], '1-5': [45, 43], '1-6': [45, 46] })
    const wrapper = await listen()
    const warnung = wrapper.find('[data-hinweis="parallel-gleichstand"]')
    expect(warnung.attributes('data-klasse')).toBe('1')
    expect(warnung.text()).toContain('104, 105')
    expect(warnung.text()).toContain('5.2.6')
    expect(wrapper.find('[data-hinweis="parallel-entschieden"]').exists()).toBe(false)
    expect(zeilen(wrapper, 'gesamt', '1').map((z) => `${z[0]} ${z[1]} ${z[z.length - 1]}`)).toEqual(['1 101 ', '2 102 ', '3 103 ', '4 104 Re-run', '4 105 Re-run', '6 106 95'])
    // Die GANZE Klasse bleibt ohne „Qualified“, bis der Re-run gefahren ist; wer dahinter steht, hat seine Punkte schon – die Warnung sagt es.
    expect(warnung.text()).toContain('in der GANZEN Klasse kein „Qualified“')
    expect(wrapper.find('.ergebnis-stapel').text()).not.toContain('Qualified')

    await wrapper.find('select[data-feld="perg-umfang"]').setValue('result')
    await wrapper.find('select[data-feld="perg-ordnung"]').setValue('beide')
    await warte()
    expect(wrapper.findAll('.listen-seite').map((s) => `${s.attributes('data-art')}/${s.attributes('data-ordnung')}`)).toEqual(['gesamt/nummer', 'gesamt/platz'])
    await wrapper.find('select[data-feld="perg-umfang"]').setValue('attempts')
    await warte()
    expect(wrapper.findAll('.listen-seite').map((s) => s.attributes('data-art'))).toEqual(['attempts', 'attempts'])
  })

  it('das Manövrieren bleibt daneben, wie es ist: eigene Listen, eigener Hinweis', async () => {
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    vorlauf({ '1-1': [40, 41] })
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: '1-1', feld: 'zeit1', wert: '80,00' }], zeit: 500 })
    const wrapper = await listen('manoever')
    expect(wrapper.find('.ergebnis-stapel[data-stapel="parallel"]').exists()).toBe(false)
    expect(wrapper.findAll('.listen-seite').map((s) => s.attributes('data-art'))).toEqual(['lauf', 'gesamt'])
    // Die Gesamtliste des Manövrierens hat weder Racecourse noch die Summe der Runde.
    expect(wrapper.find('.listen-seite[data-art="gesamt"]').attributes('data-runde')).toBeUndefined()
    expect(wrapper.find('.listen-seite[data-art="gesamt"] [data-spalte="racecourse"]').exists()).toBe(false)
    expect(wrapper.findAll('.listen-seite[data-art="gesamt"] .erg-unterkopf th').map((t) => t.text())).toEqual(['Time', 'Pen.', 'Time incl. pen.', 'Rank.'])
  })

  it('unter der DM gibt es weder die Wahl der Disziplin noch den Teil der Druckdatei', async () => {
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'dm-2026' })
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: '1-1', feld: 'zeit1', wert: '80,00' }], zeit: 500 })
    const wrapper = mount(ListsView, mit(store))
    await wrapper.find('.list-kinds button[data-kind="ergebnis"]').trigger('click')
    await warte()
    expect(wrapper.find('.disziplin-wahl').exists()).toBe(false)
    expect(wrapper.findAll('.listen-seite').map((s) => s.attributes('data-art'))).toEqual(['lauf', 'gesamt'])
    await wrapper.find('.list-kinds button[data-kind="druckdatei"]').trigger('click')
    await warteAufDruckdatei(wrapper)
    expect(wrapper.findAll('.druckdatei-wahl input[data-teil]').map((i) => i.attributes('data-teil'))).not.toContain('parallel')
    expect(wrapper.find('.druckdatei-teil[data-teil="parallel"]').exists()).toBe(false)
  })

  it('Druckdatei: der Teil „Parallel-Slalom“ steht hinter den Wertungslisten des Manövrierens und lässt sich abwählen', async () => {
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    vorlauf({ '1-1': [40, 41], '1-2': [41, 42], '2-1': [50, 51], '2-2': [52, 53] })
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: '1-1', feld: 'zeit1', wert: '80,00' }], zeit: 500 })
    const wrapper = mount(ListsView, mit(store))
    await wrapper.find('.list-kinds button[data-kind="druckdatei"]').trigger('click')
    await warteAufDruckdatei(wrapper)
    // Vor den Wertungslisten der Runde steht ihre Startliste (Regel 960, lib/druckdatei.ts).
    expect(wrapper.findAll('.druckdatei-teil').map((t) => t.attributes('data-teil')).slice(-3)).toEqual(['ergebnis', 'startliste', 'parallel'])
    // Auch dort abwechselnd weiß und grau wie die Listen der race officials (`parallelZebra`).
    const startliste = wrapper.findAll('.druckdatei-teil[data-teil="startliste"] tr[data-start]')
    expect(startliste.length).toBeGreaterThan(2)
    startliste.forEach((r, i) => expect(r.classes().includes('shade'), `Zeile ${i + 1}`).toBe((i + 1) % 2 === 0 && !r.classes().includes('psl-entfaellt')))
    const teil = wrapper.find('.druckdatei-teil[data-teil="parallel"]')
    // Klassen in der Reihenfolge des Regelwerks, nach Platz, je Klasse Attempts und Result.
    expect(teil.findAll('.listen-seite').map((s) => `${s.attributes('data-klasse')}/${s.attributes('data-art')}/${s.attributes('data-ordnung')}`)).toEqual(['1/attempts/platz', '1/gesamt/platz', '2/attempts/platz', '2/gesamt/platz'])
    // Ansicht nach Racecourse.
    await wrapper.find('select[data-feld="druckdatei-ansicht"]').setValue('racecourse')
    await warteAufDruckdatei(wrapper)
    expect(wrapper.find('.druckdatei-teil[data-teil="parallel"] .listen-seite[data-art="attempts"]').attributes('data-ansicht')).toBe('racecourse')
    // „nur die Gesamtliste“: nur das Result der Runde.
    await wrapper.find('select[data-feld="druckdatei-umfang"]').setValue('gesamt')
    await warteAufDruckdatei(wrapper)
    expect(wrapper.findAll('.druckdatei-teil[data-teil="parallel"] .listen-seite').map((s) => s.attributes('data-art'))).toEqual(['gesamt', 'gesamt'])
    // Abgewählt: kein Teil mehr.
    await wrapper.find('.druckdatei-wahl input[data-teil="parallel"]').setValue(false)
    await warteAufDruckdatei(wrapper)
    expect(wrapper.find('.druckdatei-teil[data-teil="parallel"]').exists()).toBe(false)
  })
})
