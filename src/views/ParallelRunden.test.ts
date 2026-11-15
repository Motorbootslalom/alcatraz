import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListsView from './ListsView.vue'
import VerzahnungView from './VerzahnungView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { attemptSchluessel } from '../lib/parallelSchluessel'
import { vergissAlles } from '../lib/merken'
import { setLocale } from '../i18n'
import type { ClassId, ParallelRunde, Starter } from '../types'

// Halbfinale, Finals und Wiederholung in der Oberfläche: festschreiben und löschen unter
// „Verzahnung“, die Wertungslisten je Runde, das Gesamtergebnis und die Druckdatei.
// Erfundene Starter – keine echten Personen.
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
const warteAufDruckdatei = async (wrapper: VueWrapper) => {
  // Erst die Auswahl wirken lassen: Eine andere Folge beginnt den Aufbau von vorn.
  await warte()
  for (let i = 0; i < 200 && wrapper.find('.druckdatei').attributes('data-fertig') === undefined; i++) await new Promise((r) => setTimeout(r, 0))
  await warte()
}

describe('Parallelslalom: Runden nach dem Vorlauf', () => {
  let store: Store

  /** Je Starter die beiden Attempts einer Runde in Sekunden. */
  const fahre = (runde: ParallelRunde, zeiten: Record<string, number[]>, zeit = 1000) =>
    store.dispatch({
      type: 'SET_EINGABEN',
      zellen: Object.entries(zeiten).flatMap(([id, je]) => je.map((sek, i) => ({ lauf: attemptSchluessel(runde, i + 1), starter: id, feld: 'zeit1', wert: `${sek},00` }))),
      zeit,
    })
  const VORLAUF = { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43], '1-5': [50, 50], '1-6': [55, 55] }
  const bisEnde = () => {
    fahre('pre', VORLAUF)
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'semi' })
    fahre('semi', { '1-1': [40, 40], '1-2': [39, 40], '1-3': [45, 45], '1-4': [44, 45] }, 2000)
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'final' })
    fahre('final', { '1-1': [41, 41], '1-2': [40, 43], '1-3': [30, 30], '1-4': [44, 45] }, 3000)
  }

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vergissAlles()
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Hafenpokal' } })
    store.dispatch({ type: 'ADD_STARTERS', starters: mk('1', 6) })
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
  })
  afterEach(() => {
    setLocale('de')
    document.body.innerHTML = ''
  })

  const verzahnung = async (): Promise<VueWrapper> => {
    location.hash = '#/verzahnung/parallel'
    const wrapper = mount(VerzahnungView, mit(store))
    await warte()
    if (!wrapper.find('[data-panel="parallel-runden"]').exists()) {
      await wrapper.findAll('.subnav button')[1].trigger('click')
      await warte()
    }
    return wrapper
  }
  const weg = (wrapper: VueWrapper) => wrapper.findAll('.parallel-klasse[data-klasse="1"] .parallel-weg li').map((l) => `${l.attributes('data-runde')}=${l.attributes('data-zustand')}`)

  it('Halbfinale und Finale festschreiben – auch bei festgeschriebener Verzahnung; die Pläne stehen darunter', async () => {
    const wrapper = await verzahnung()
    // Der Vorlauf läuft: noch nichts festzuschreiben.
    expect(weg(wrapper)).toEqual(['pre=leer'])
    expect(wrapper.find('[data-action="runde-fest"]').exists()).toBe(false)
    fahre('pre', VORLAUF)
    await warte()
    const knopf = wrapper.find('[data-action="runde-fest"]')
    expect(knopf.text()).toBe('Halbfinale festschreiben')
    // Die Runden liegen außerhalb der Sperre der Verzahnung: Der Knopf ist bedienbar.
    expect(knopf.element.closest('fieldset[disabled]')).toBeNull()
    expect(wrapper.find('[data-hinweis="runde-naechste"]').text()).toContain('101 ↔ 102 · 103 ↔ 104')
    await knopf.trigger('click')
    await warte()
    expect(weg(wrapper)).toEqual(['pre=fertig', 'semi=leer'])
    expect(wrapper.find('.panel[data-runde="semi"] h2').text()).toBe('Halbfinale')
    expect(wrapper.findAll('.panel[data-runde="semi"] tbody tr')).toHaveLength(4)
    expect(wrapper.find('[data-hinweis="runde-laeuft"]').text()).toContain('Halbfinale')

    fahre('semi', { '1-1': [40, 40], '1-2': [39, 40], '1-3': [45, 45], '1-4': [44, 45] })
    await warte()
    expect(wrapper.find('[data-hinweis="runde-naechste"]').text()).toContain('Kleines Finale (Platz 3 und 4): 103 ↔ 104 · Finale: 101 ↔ 102')
    await wrapper.find('[data-action="runde-fest"]').trigger('click')
    await warte()
    expect(wrapper.findAll('.panel[data-runde="final"] td[data-spalte="vermerk"]').map((z) => z.text())).toEqual(['Klasse 1 · Kleines Finale (Platz 3 und 4)', 'Klasse 1 · Kleines Finale (Platz 3 und 4)', 'Klasse 1 · Finale', 'Klasse 1 · Finale'])
    fahre('final', { '1-1': [41, 41], '1-2': [40, 43], '1-3': [30, 30], '1-4': [44, 45] })
    await warte()
    expect(wrapper.find('.parallel-klasse[data-klasse="1"]').attributes('data-fertig')).toBe('true')
    expect(wrapper.find('[data-hinweis="runde-fertig"]').exists()).toBe(true)
  })

  it('Löschen fragt nach und nennt, wie viele erfasste Werte der Runde mitgehen', async () => {
    fahre('pre', VORLAUF)
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'semi' })
    const wrapper = await verzahnung()
    // Ohne Werte: Rückfrage ohne Warnung; Abbrechen lässt alles, wie es ist.
    await wrapper.find('[data-action="runde-loeschen"][data-runde="semi"]').trigger('click')
    expect(wrapper.find('[data-dialog="runde-loeschen"] h2').text()).toBe('Halbfinale für Klasse 1 löschen?')
    expect(wrapper.find('[data-warnung="runde-werte"]').exists()).toBe(false)
    await wrapper.find('[data-dialog="runde-loeschen"] [data-action="dialog-abbrechen"]').trigger('click')
    expect(store.state.value.parallelPlaene.semi).toBeDefined()

    fahre('semi', { '1-1': [40, 40], '1-2': [39] })
    await warte()
    await wrapper.find('[data-action="runde-loeschen"][data-runde="semi"]').trigger('click')
    expect(wrapper.find('[data-warnung="runde-werte"]').text()).toContain('Dabei gehen 3 erfasste Werte verloren')
    expect(wrapper.find('[data-warnung="runde-werte"]').text()).toContain('von 2 Startern')
    expect(wrapper.find('[data-action="runde-loeschen-bestaetigen"]').text()).toBe('Runde und 3 Werte löschen')
    await wrapper.find('[data-action="runde-loeschen-bestaetigen"]').trigger('click')
    await warte()
    expect(store.state.value.parallelPlaene.semi).toBeUndefined()
    expect(store.state.value.eingaben[attemptSchluessel('semi', 1)]).toBeUndefined()
    expect(wrapper.find('[data-dialog="runde-loeschen"]').exists()).toBe(false)
    expect(wrapper.find('[data-action="runde-fest"]').text()).toBe('Halbfinale festschreiben')
  })

  it('Gleichstand an der Grenze: Warnung, und angeboten wird die Wiederholung; ein veralteter Plan wird gemeldet', async () => {
    fahre('pre', { ...VORLAUF, '1-4': [43, 45], '1-5': [45, 43] })
    const wrapper = await verzahnung()
    expect(wrapper.find('[data-hinweis="runde-gleichstand"]').text()).toContain('104, 105')
    expect(wrapper.find('[data-action="runde-fest"]').text()).toBe('Vorlauf – Wiederholung festschreiben')
    await wrapper.find('[data-action="runde-fest"]').trigger('click')
    await warte()
    expect(wrapper.find('.panel[data-runde="rerun-pre-1"] h2').text()).toBe('Vorlauf – Wiederholung')
    expect(wrapper.find('[data-warnung="runde-veraltet"]').exists()).toBe(false)
    // Ein Protest hebt den Gleichstand auf: Die Wiederholung bleibt stehen, als veraltet gemeldet.
    fahre('pre', { '1-5': [45, 44] })
    await warte()
    expect(wrapper.find('[data-warnung="runde-veraltet"]').exists()).toBe(true)
    expect(wrapper.find('.parallel-weg li[data-runde="rerun-pre-1"]').attributes('data-veraltet')).toBe('true')
  })

  const listen = async (kind: string): Promise<VueWrapper> => {
    const wrapper = mount(ListsView, mit(store))
    await wrapper.find(`.list-kinds button[data-kind="${kind}"]`).trigger('click')
    if (kind !== 'druckdatei') await wrapper.find('.disziplin-wahl button[data-disziplin="parallel"]').trigger('click')
    await warte()
    return wrapper
  }
  const blaetter = (wrapper: VueWrapper) => wrapper.findAll('.ergebnis-stapel[data-stapel="parallel"] .listen-seite').map((s) => `${s.find('.erg-kopf-titel').text()}`)
  /** Die Zellen der Spalte „UIM points“ einer Liste „Results“ (sonst der ersten); eine zusammengefasste mit „×n“ (über n Zeilen). */
  const uimZellen = (w: VueWrapper | ReturnType<VueWrapper['find']>) =>
    (w.classes().includes('listen-seite') ? w : w.find('.listen-seite[data-art="gesamt"]'))
      .findAll('tbody td[data-spalte="uim-punkte"]')
      .map((t) => (t.attributes('rowspan') ? `${t.text()} ×${t.attributes('rowspan')}` : t.text()))

  it('Wertungslisten je Runde und das Gesamtergebnis – englisch, mit Zeitstempel, O.O.D. und eigener Seitenzählung', async () => {
    bisEnde()
    const wrapper = await listen('ergebnis')
    expect(blaetter(wrapper)).toEqual(['Preliminary heat – Attempts', 'Preliminary heat – Results', 'Semi-finals – Attempts', 'Semi-finals – Results', 'Finals – Attempts', 'Finals – Results', 'Overall results'])
    expect(wrapper.findAll('[data-feld="perg-runde"] option').map((o) => o.text())).toEqual(['alle', 'Vorlauf', 'Halbfinale', 'Finale', 'Gesamtergebnis'])
    expect(wrapper.find('[data-hinweis="parallel-stage-fertig"]').text()).toContain('Klasse 1')
    expect(wrapper.find('[data-hinweis="parallel-stage-offen"]').exists()).toBe(false)

    // Halbfinale: wer um welche Plätze fährt, steht in der letzten Spalte.
    await wrapper.find('[data-feld="perg-runde"]').setValue('semi')
    await warte()
    expect(blaetter(wrapper)).toEqual(['Semi-finals – Attempts', 'Semi-finals – Results'])
    const letzte = (art: string) => wrapper.findAll(`.listen-seite[data-art="${art}"] tbody tr[data-starter]`).map((r) => `${r.findAll('td')[0].text()} ${r.findAll('td')[1].text()} ${r.findAll('td').at(-1)!.text()}`)
    // Wer um welche Plätze fährt, steht als Block: eine Zelle je Finale über seine zwei Zeilen.
    expect(uimZellen(wrapper)).toEqual(['Final 1–2 ×2', 'Small final ×2'])
    expect(wrapper.findAll('.listen-seite[data-art="gesamt"] tbody tr[data-starter]').map((r) => `${r.findAll('td')[0].text()} ${r.findAll('td')[1].text()}`)).toEqual(['1 102', '2 101', '3 104', '4 103'])
    // Jede Runde trägt ihren eigenen Zeitstempel.
    const stand = wrapper.find('.listen-seite[data-art="gesamt"] .erg-stand').text()
    await wrapper.find('[data-feld="perg-runde"]').setValue('final')
    await warte()
    expect(letzte('gesamt')).toEqual(['1 101 400', '2 102 300', '3 103 225', '4 104 169'])
    expect(wrapper.find('.listen-seite[data-art="gesamt"] .erg-stand').text()).not.toBe(stand)

    // Gesamtergebnis: Plätze 1 bis 4 aus den Finals, ab Platz 5 aus dem Vorlauf.
    await wrapper.find('[data-feld="perg-runde"]').setValue('stage')
    await warte()
    const stage = wrapper.find('.listen-seite[data-art="stage"]')
    // Keine Spalte „Heat“ (Entscheidung des Nutzers): Der Platz sagt, aus welcher Runde die Summe stammt.
    expect(stage.findAll('.erg-spaltenkopf th').map((t) => t.text())).toEqual(['Rank.', 'No.', 'Surname', 'First name', 'Club', 'Combined time', 'UIM points'])
    expect(stage.findAll('tbody tr').map((r) => [0, 1, -2, -1].map((i) => r.findAll('td').at(i)!.text()).join(' | '))).toEqual([
      '1 | 101 | 82.00 | 400',
      '2 | 102 | 83.00 | 300',
      '3 | 103 | 60.00 | 225',
      '4 | 104 | 89.00 | 169',
      '5 | 105 | 100.00 | 127',
      '6 | 106 | 110.00 | 95',
    ])
    expect(stage.text()).not.toContain('Heat')
    expect(stage.find('[data-feld="unterschrift"]').text()).toContain('O.O.D.')
    expect(stage.find('.erg-stand').text()).not.toBe('')
  })

  it('hat eine Wiederholung Plätze entschieden, tragen sie ein Sternchen mit Fußnote – im Vorlauf und in den Overall results', async () => {
    fahre('pre', { ...VORLAUF, '1-4': [43, 45], '1-5': [45, 43] })
    const wrapper = await listen('ergebnis')
    const plaetze = (blatt: ReturnType<VueWrapper['find']>) => blatt.findAll('tbody tr[data-starter]').map((r) => `${r.findAll('td')[0].text()} ${r.findAll('td')[1].text()}`)
    // Vor dem Re-run: „Re-run“ steht je Zeile, noch kein Sternchen, keine Fußnote.
    expect(uimZellen(wrapper)).toEqual(['', '', '', 'Re-run', 'Re-run', '95'])
    expect(wrapper.find('.listen-seite[data-art="gesamt"] .erg-fuss').text()).not.toContain('re-run')
    expect(wrapper.find('[data-hinweis="parallel-gleichstand"]').text()).toContain('104, 105')
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'rerun-pre-1' })
    fahre('rerun-pre-1', { '1-4': [60, 60], '1-5': [50, 59] }, 2000)
    await warte()
    expect(blaetter(wrapper)).toEqual(['Preliminary heat – Attempts', 'Preliminary heat – Results', 'Preliminary heat – Re-run – Attempts', 'Preliminary heat – Re-run – Results'])
    const vorlauf = wrapper.findAll('.listen-seite[data-art="gesamt"]')[0]
    // Die Plätze 4 und 5 hat der Re-run entschieden: Sternchen daran, die Fußnote nach Pkt. 5.2.6 – statt eines Hinweises ohne Zeichen.
    expect(plaetze(vorlauf)).toEqual(['1 101', '2 102', '3 103', '4* 105', '5* 104', '6 106'])
    expect(vorlauf.findAll('tbody tr[data-wiederholt]').map((r) => r.attributes('data-starter'))).toEqual(['1-5', '1-4'])
    expect(vorlauf.find('[data-hinweis="stich"]').text()).toBe('* Ranking decided by the re-run (pt. 5.2.6): still a dead-heat situation where a decision was required – after running again only the time of the re-run is taken into account.')
    expect(vorlauf.find('[data-hinweis="fuss"]').exists()).toBe(false)
    expect(uimZellen(vorlauf)).toEqual(['Qualified ×4', '127', '95'])
    // Die Liste der Wiederholung selbst trägt keinen Vermerk: Dort entscheidet ihre eigene Zeit.
    const rerun = wrapper.findAll('.listen-seite[data-art="gesamt"]')[1]
    expect(rerun.find('tbody tr[data-wiederholt]').exists()).toBe(false)
    expect(rerun.find('.erg-fuss').text()).not.toContain('re-run')
    expect(wrapper.find('[data-hinweis="parallel-gleichstand"]').exists()).toBe(false)

    // Bis zum Ende: In den Overall results steht 104 auf Platz 5 – mit der Summe der Wiederholung und dem Sternchen.
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'semi' })
    fahre('semi', { '1-1': [40, 40], '1-2': [39, 40], '1-3': [45, 45], '1-5': [44, 45] }, 3000)
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'final' })
    fahre('final', { '1-1': [41, 41], '1-2': [40, 43], '1-3': [30, 30], '1-5': [44, 45] }, 4000)
    await wrapper.find('[data-feld="perg-runde"]').setValue('stage')
    await warte()
    const stage = wrapper.find('.listen-seite[data-art="stage"]')
    expect(stage.findAll('tbody tr').map((r) => [0, 1, -2].map((i) => r.findAll('td').at(i)!.text()).join(' | '))).toEqual([
      '1 | 101 | 82.00',
      '2 | 102 | 83.00',
      '3 | 103 | 60.00',
      '4 | 105 | 89.00',
      '5* | 104 | 120.00',
      '6 | 106 | 110.00',
    ])
    expect(stage.find('[data-hinweis="stich"]').text()).toContain('only the time of the re-run is taken into account')
    // Halbfinale und Finals hat kein Re-run entschieden: dort kein Sternchen.
    await wrapper.find('[data-feld="perg-runde"]').setValue('semi')
    await warte()
    expect(wrapper.find('tbody tr[data-wiederholt]').exists()).toBe(false)
  })

  it('solange eine Klasse nicht alle Runden gefahren ist, gibt es kein Gesamtergebnis – der Hinweis nennt die Runde', async () => {
    fahre('pre', VORLAUF)
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'semi' })
    const wrapper = await listen('ergebnis')
    expect(blaetter(wrapper)).toEqual(['Preliminary heat – Attempts', 'Preliminary heat – Results'])
    expect(wrapper.find('[data-hinweis="parallel-stage-offen"]').text()).toContain('Klasse 1 (Halbfinale)')
  })

  it('Druckdatei: Gesamtergebnis und Runden einzeln wählbar; unfertig nennt die offenen Klassen des Parallelslaloms', async () => {
    fahre('pre', VORLAUF)
    const wrapper = await listen('druckdatei')
    await warteAufDruckdatei(wrapper)
    expect(wrapper.find('[data-hinweis="druckdatei-unfertig"]').text()).toContain('Parallel-Slalom ohne Gesamtergebnis – Klasse 1 (Halbfinale)')
    bisEnde()
    await warteAufDruckdatei(wrapper)
    // Nur der Parallelslalom ist gefahren und fertig: Ohne Werte zählt das Manövrieren nicht – nichts ist mehr offen.
    expect(wrapper.find('[data-hinweis="druckdatei-unfertig"]').exists()).toBe(false)
    expect(wrapper.findAll('.druckdatei-wahl input[data-runde]').map((i) => i.attributes('data-runde'))).toEqual(['stage', 'pre', 'semi', 'final'])
    const teil = () => wrapper.findAll('.druckdatei [data-teil="parallel"] .listen-seite').map((s) => s.find('.erg-kopf-titel').text())
    // Erst das Gesamtergebnis, dann die Runden in ihrer Folge.
    expect(teil()).toEqual(['Overall results', 'Preliminary heat – Attempts', 'Preliminary heat – Results', 'Semi-finals – Attempts', 'Semi-finals – Results', 'Finals – Attempts', 'Finals – Results'])
    await wrapper.find('.druckdatei-wahl input[data-runde="pre"]').setValue(false)
    await wrapper.find('.druckdatei-wahl input[data-runde="semi"]').setValue(false)
    await warteAufDruckdatei(wrapper)
    expect(teil()).toEqual(['Overall results', 'Finals – Attempts', 'Finals – Results'])
  })

  it('ohne erfasste Werte im Parallelslalom mahnt die Druckdatei ihn nicht an (nur Manövrieren gefahren)', async () => {
    const wrapper = await listen('druckdatei')
    await warteAufDruckdatei(wrapper)
    expect(wrapper.find('[data-hinweis="druckdatei-unfertig"]').exists() && wrapper.find('[data-hinweis="druckdatei-unfertig"]').text().includes('Parallel-Slalom')).toBe(false)
  })
})
