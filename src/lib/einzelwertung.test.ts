import { describe, expect, it } from 'vitest'
import { configFor } from '../config/konfig'
import { pokalRegeln, pokalVorgabe } from '../config/pokal'
import { emptyState, reducer } from '../state/reducer'
import { feldVon, laufSchluessel, OHNE_LAUF } from './eingaben'
import { EINZEL_FESTLEGUNGEN, einzelBlaetter, einzelPokalKlassen, einzelwertung, einzelwertungen, parallelGewertet } from './einzelwertung'
import { einzelZeit, gesamtZeit, wertungZeit } from './listenStand'
import { disziplinGefahren } from './disziplinen'
import { attemptSchluessel, rundenDisziplin } from './parallelSchluessel'
import { stageErgebnis } from './parallelStage'
import { gesamtPunkte, pokalKlassen, pokalZuordnung, uimWertung } from './pokal'
import { klassenErgebnis } from './ergebnis'
import type { AppState, ClassId, ParallelRunde, Starter } from '../types'

// Einzelwertung über beide Stages (Regel 960, Pkt. 5.1, 5.2.3, 5.2.6) und die Mannschaftswertung
// daraus (Pkt. 5.2.4). Alle Starter und Mannschaften sind erfunden.

function mk(klasse: ClassId, n: number, verein: (i: number) => string = () => 'Club'): Starter[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${klasse}-${i + 1}`,
    startNr: klasse + String(i + 1).padStart(2, '0'),
    vorname: 'Vor',
    nachname: `Nach${klasse}${i + 1}`,
    verein: verein(i),
    bundesland: '',
    geburtsdatum: '2015-01-01',
    groesse: '',
    klasse,
  }))
}

const konfig = configFor({ regelwerk: 'uim-2026' })
const PUNKTE = pokalVorgabe('uim-2026').punkte.uim
const DISQ = feldVon(konfig, 'parallelparcours', '1', 'disq')!.kennung
const M = 'manoevrieren'

/** UIM, die Starter – ohne festgeschriebene Verzahnung. */
function offen(starters: Starter[]): AppState {
  let state = reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
  state = reducer(state, { type: 'SET_ORIGIN_MODE', originMode: 'verein' })
  return reducer(state, { type: 'ADD_STARTERS', starters })
}
/** UIM mit festgeschriebenem Plan des Vorlaufs. */
const uim = (starters: Starter[]): AppState => reducer(offen(starters), { type: 'SET_VERZAHNUNG_LOCK', locked: true })

/** Der Haken „erfasst“ der Knoten-Liste: Erst mit den Knoten stehen die UIM points des Manövrierens fest. */
const knotenHaken = (id: string) => ({ lauf: laufSchluessel(M, OHNE_LAUF), starter: id, feld: 'erfasst@knoten', wert: '1' })
/** Manövrieren: je Starter die Versuche in Sekunden; `null` = disqualifiziert. Die Knoten gelten als erfasst (`knoten: false` = noch nicht). */
function manoever(state: AppState, zeiten: Record<string, Array<number | null>>, zeit?: number, knoten = true): AppState {
  const zellen = Object.entries(zeiten).flatMap(([id, je]) => [
    ...je.flatMap((sek, i) => {
      const lauf = laufSchluessel(M, i + 1)
      return sek === null ? [{ lauf, starter: id, feld: 'disq@steg', wert: 'D' }] : [{ lauf, starter: id, feld: 'zeit1', wert: `${sek},00` }]
    }),
    ...(knoten ? [knotenHaken(id)] : []),
  ])
  return reducer(state, { type: 'SET_EINGABEN', zellen, zeit })
}
/** Parallelslalom: je Starter die beiden Attempts einer Runde in Sekunden; `null` = disqualifiziert (mit Zeit). */
function fahre(state: AppState, runde: ParallelRunde, zeiten: Record<string, Array<number | null>>, zeit?: number): AppState {
  const zellen = Object.entries(zeiten).flatMap(([id, je]) =>
    je.flatMap((sek, i) => {
      const lauf = attemptSchluessel(runde, i + 1)
      return [{ lauf, starter: id, feld: 'zeit1', wert: `${sek ?? 50},00` }, ...(sek === null ? [{ lauf, starter: id, feld: DISQ, wert: 'J' }] : [])]
    }),
  )
  return reducer(state, { type: 'SET_EINGABEN', zellen, zeit })
}
const fest = (state: AppState, runde: ParallelRunde, klasse: ClassId = '1') => reducer(state, { type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse, runde })
const einzel = (state: AppState, klasse: ClassId = '1') => einzelwertung(state, konfig, klasse, PUNKTE)!
/** Je Zeile: Starter, Platz, Punkte Manövrieren, Punkte Parallelslalom, Summe. */
const liste = (state: AppState, klasse: ClassId = '1') => einzel(state, klasse).nachPlatz.map((z) => [z.starter.id, z.platz, z.manoever, z.parallel, z.summe])

/** Sechs Starter: Manövrieren in der Folge 1-6 … 1-1 (bester Versuch 60 … 65 s). */
const MANOEVER6 = { '1-6': [60, 70], '1-5': [61, 71], '1-4': [62, 72], '1-3': [63, 73], '1-2': [64, 74], '1-1': [65, 75] }
/** Vorlauf entschieden: 1-1 … 1-4 qualifiziert (Summen 80, 82, 84, 86), 1-5 und 1-6 dahinter. */
const VORLAUF6 = { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43], '1-5': [50, 50], '1-6': [55, 55] }
/** Der Parallelslalom der sechs bis zum Ende: Plätze 1-1, 1-2, 1-3, 1-4, 1-5, 1-6. */
function parallel6(state: AppState): AppState {
  state = fahre(state, 'pre', VORLAUF6)
  state = fahre(fest(state, 'semi'), 'semi', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] })
  return fahre(fest(state, 'final'), 'final', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] })
}
const beide6 = () => parallel6(manoever(uim(mk('1', 6)), MANOEVER6))

describe('Wird der Parallelslalom gewertet?', () => {
  it('ohne Werte nicht – die Einzelwertung entsteht dann aus dem Manövrieren allein', () => {
    const nur = manoever(offen(mk('1', 6)), MANOEVER6)
    expect(parallelGewertet(nur, konfig)).toBe(false)
    // Nur eine Disziplin gefahren: Ihre Punkte sind die der Einzelwertung.
    expect(einzelBlaetter(nur, konfig, ['1'], PUNKTE).map((b) => b.key)).toEqual(['einzel/1'])
    expect(einzel(nur)).toMatchObject({ disziplinen: ['manoever'], gestrichen: [], fertig: true })
    expect(liste(nur).slice(0, 2)).toEqual([
      ['1-6', 1, 400, null, 400],
      ['1-5', 2, 300, null, 300],
    ])
    // Der festgeschriebene Plan allein reicht nicht: Erst ein erfasster Wert macht den Parallelslalom zur Wertung.
    const mitPlan = manoever(uim(mk('1', 6)), MANOEVER6)
    expect(parallelGewertet(mitPlan, konfig)).toBe(false)
    expect(parallelGewertet(fahre(mitPlan, 'pre', { '1-1': [40] }), konfig)).toBe(true)
  })

  it('unter der DM nie – auch nicht mit einem übrig gebliebenen Plan und Werten', () => {
    const dm = configFor({ regelwerk: 'dm-2026' })
    let state = fahre(uim(mk('1', 6)), 'pre', VORLAUF6)
    expect(parallelGewertet(state, konfig)).toBe(true)
    state = { ...state, regelwerk: 'dm-2026' }
    expect(parallelGewertet(state, dm)).toBe(false)
    expect(einzelBlaetter(state, dm, ['1'], PUNKTE)).toEqual([])
  })
})

describe('Einzelwertung (Pkt. 5.1, 5.2.3)', () => {
  it('zählt die UIM points beider Stages zusammen und reiht nach der Summe', () => {
    const state = beide6()
    // Manövrieren: 1-6 400 … 1-1 95. Parallelslalom: 1-1 400 … 1-6 95.
    // Je zwei haben dieselbe Summe; die Zeit trennt sie (Pkt. 5.2.6, siehe unten).
    expect(liste(state)).toEqual([
      ['1-1', 1, 95, 400, 495],
      ['1-6', 2, 400, 95, 495],
      ['1-2', 3, 127, 300, 427],
      ['1-5', 4, 300, 127, 427],
      ['1-3', 5, 169, 225, 394],
      ['1-4', 6, 225, 169, 394],
    ])
    expect(einzel(state)).toMatchObject({ fertig: true, manoeverFertig: true, parallelFertig: true })
  })

  it('die Punkte sind die der beiden Stage-Listen', () => {
    const state = beide6()
    const m = gesamtPunkte(klassenErgebnis(state, konfig, '1')!.gesamt, state.laufCount, PUNKTE)!
    const p = new Map(stageErgebnis(state, konfig, '1', PUNKTE)!.nachPlatz.map((z) => [z.starter.id, z.punkte]))
    for (const z of einzel(state).nachPlatz) expect([z.manoever, z.parallel]).toEqual([m.get(z.starter.id), p.get(z.starter.id)])
  })

  it('eine Liste gibt es erst, wenn beide Stages der Klasse fertig sind', () => {
    let state = manoever(uim(mk('1', 6)), MANOEVER6)
    state = fahre(state, 'pre', VORLAUF6)
    expect(einzel(state)).toMatchObject({ fertig: false, manoeverFertig: true, parallelFertig: false, offeneRunde: 'semi' })
    expect(einzelBlaetter(state, konfig, ['1'], PUNKTE)).toEqual([])
    // Solange die Stage offen ist, hat niemand Punkte aus dem Parallelslalom.
    expect(liste(state).map((z) => z[3])).toEqual([null, null, null, null, null, null])
    state = fahre(fest(state, 'semi'), 'semi', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] })
    expect(einzel(state).offeneRunde).toBe('final')
    state = fahre(fest(state, 'final'), 'final', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] })
    expect(einzelBlaetter(state, konfig, ['1'], PUNKTE).map((b) => b.key)).toEqual(['einzel/1'])
    // Umgekehrt: Der Parallelslalom ist fertig, im Manövrieren fehlt ein Versuch.
    const ohne = parallel6(manoever(uim(mk('1', 6)), { ...MANOEVER6, '1-1': [65] }))
    expect(einzel(ohne)).toMatchObject({ fertig: false, manoeverFertig: false, parallelFertig: true })
    expect(einzelBlaetter(ohne, konfig, ['1'], PUNKTE)).toEqual([])
  })

  it('wer in einer Stage disqualifiziert ist, hat dort 0 Punkte und steht mit den Punkten der anderen da', () => {
    // 1-6 ist im Manövrieren in beiden Versuchen disqualifiziert, 1-5 im Vorlauf des Parallelslaloms.
    let state = manoever(uim(mk('1', 6)), { ...MANOEVER6, '1-6': [null, null] })
    state = fahre(state, 'pre', { ...VORLAUF6, '1-5': [null, 50] })
    state = fahre(fest(state, 'semi'), 'semi', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] })
    state = fahre(fest(state, 'final'), 'final', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] })
    const von = Object.fromEntries(liste(state).map((z) => [z[0], z.slice(1)]))
    // Manövrieren: 1-5 400, 1-4 300, 1-3 225, 1-2 169, 1-1 127, 1-6 disq. Parallel: 1-1 … 1-4, 1-6 Platz 5, 1-5 disq.
    expect(von['1-6']).toEqual([6, 0, 127, 127])
    expect(von['1-5']).toEqual([5, 400, 0, 400])
    expect(von['1-1']).toEqual([1, 127, 400, 527])
    expect(einzel(state).nachPlatz.filter((z) => z.disq).map((z) => z.starter.id).sort()).toEqual(['1-5', '1-6'])
  })
})

describe('Stichentscheid der Einzelwertung (Pkt. 5.2.6; Festlegungen des Nutzers)', () => {
  const zeilen = (state: AppState) => Object.fromEntries(einzel(state).nachPlatz.map((z) => [z.starter.id, z]))

  it('die Festlegungen stehen an einer Stelle', () => {
    expect(EINZEL_FESTLEGUNGEN).toEqual({ stichMitKnoten: true, stichParallelRunde: 'vorlauf' })
  })

  it('gleiche Punktsumme: Es entscheidet die Zeit aus dem besseren Versuch des Manövrierens und beiden Attempts des Vorlaufs', () => {
    const von = zeilen(beide6())
    // 1-1: 65 + 80 = 145 s, 1-6: 60 + 110 = 170 s – beide 495 Punkte.
    expect([von['1-1'].zeit, von['1-6'].zeit]).toEqual([14500, 17000])
    expect([von['1-1'].platz, von['1-6'].platz]).toEqual([1, 2])
    // Beide tragen das Zeichen: Der Platz ist im Stichentscheid entstanden.
    expect([von['1-1'].stich, von['1-6'].stich, von['1-1'].punktgleich]).toEqual([true, true, true])
  })

  it('auch für Finalisten zählen die Attempts des Vorlaufs – nicht die des Finales', () => {
    // 1-1 fährt im Finale 30 + 30 statt 40 + 40: Die Zeit des Stichentscheids bleibt die des Vorlaufs.
    let state = fahre(manoever(uim(mk('1', 6)), MANOEVER6), 'pre', VORLAUF6)
    state = fahre(fest(state, 'semi'), 'semi', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] })
    state = fahre(fest(state, 'final'), 'final', { '1-1': [30, 30], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] })
    expect(zeilen(state)['1-1'].zeit).toBe(6500 + 8000)
  })

  it('die Strafen der Knoten zählen zur Zeit des Manövrierens (Entscheidung des Nutzers)', () => {
    const knoten = ['palstek', 'kreuzknoten', 'klampe', 'webeleinstek'].flatMap((k) => feldVon(konfig, 'knoten', '1', k) ?? [])[0]
    expect(knoten).toBeDefined()
    let state = beide6()
    const vorher = zeilen(state)['1-1']
    state = reducer(state, { type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel(M, OHNE_LAUF), starter: '1-1', feld: knoten.kennung, wert: '5' }] })
    const gesamt = klassenErgebnis(state, konfig, '1')!.gesamt.nachPlatz.find((z) => z.starter.id === '1-1')!
    expect(gesamt.knoten).toBeGreaterThan(0)
    // Je Strafpunkt eine Sekunde, wie in der Gesamtliste.
    expect(zeilen(state)['1-1'].zeit).toBe(vorher.zeit! + gesamt.knoten * 100)
  })

  it('in allem gleich: geteilter Platz, der nächste entfällt („dead-heat result“)', () => {
    // 1-1 und 1-6 mit denselben Punkten und derselben Zeit: 65 + 80 = 60 + 85.
    let state = manoever(uim(mk('1', 6)), MANOEVER6)
    state = fahre(state, 'pre', { ...VORLAUF6, '1-6': [42, 43] })
    // 1-6 ist damit im Vorlauf Vierter (85 s) und 1-4 Fünfter (86 s).
    state = fahre(fest(state, 'semi'), 'semi', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-6': [43, 43] })
    state = fahre(fest(state, 'final'), 'final', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-6': [43, 43] })
    // 1-6: 400 + 169 = 569; 1-1: 95 + 400 = 495; 1-2: 127 + 300 = 427; 1-5: 300 + 95 = 395; 1-3: 169 + 225 = 394; 1-4: 225 + 127 = 352.
    expect(liste(state).map((z) => [z[0], z[1], z[4]])).toEqual([
      ['1-6', 1, 569],
      ['1-1', 2, 495],
      ['1-2', 3, 427],
      ['1-5', 4, 395],
      ['1-3', 5, 394],
      ['1-4', 6, 352],
    ])
    // Zwei mit gleicher Summe und gleicher Zeit: zwei Starter, Manövrieren und Parallelslalom gegengleich.
    let zwei = manoever(uim(mk('1', 2)), { '1-1': [60, 70], '1-2': [61, 71] })
    zwei = fahre(zwei, 'pre', { '1-1': [41, 41], '1-2': [40, 41] })
    zwei = fahre(fest(zwei, 'final'), 'final', { '1-1': [41, 41], '1-2': [40, 40] })
    // 1-1: 400 + 300, Zeit 60 + 82; 1-2: 300 + 400, Zeit 61 + 81.
    expect(liste(zwei)).toEqual([
      ['1-1', 1, 400, 300, 700],
      ['1-2', 1, 300, 400, 700],
    ])
    expect(einzel(zwei).nachPlatz.map((z) => [z.zeit, z.stich, z.punktgleich])).toEqual([
      [14200, false, true],
      [14200, false, true],
    ])
  })

  it('wem eine Zeit fehlt, weil er disqualifiziert ist, steht hinter den Punktgleichen mit Zeit; mehrere solche teilen sich den Platz', () => {
    // Eigene Punktetabelle 4, 2, 2, 2 – damit ein Disqualifizierter punktgleich mit Gewerteten ist.
    // Manövrieren: 1-1 Erster (4), 1-2 (2), 1-3 (2), 1-4 disqualifiziert (0).
    // Parallelslalom: 1-1 im Vorlauf disqualifiziert (0); 1-4 gewinnt (4), 1-2 Zweiter (2), 1-3 Dritter (2).
    const tabelle = [4, 2, 2, 2]
    let vier = manoever(uim(mk('1', 4)), { '1-1': [60, 70], '1-2': [61, 71], '1-3': [62, 72], '1-4': [null, null] })
    vier = fahre(vier, 'pre', { '1-1': [null, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [40, 40] })
    vier = fahre(fest(vier, 'semi'), 'semi', { '1-2': [41, 41], '1-3': [42, 42], '1-4': [40, 40] })
    vier = fahre(fest(vier, 'final'), 'final', { '1-2': [41, 41], '1-4': [40, 40] })
    const e = einzelwertung(vier, konfig, '1', tabelle)!
    expect(e.fertig).toBe(true)
    // Alle vier haben 4 Punkte. 1-2 (61 + 82 s) vor 1-3 (62 + 84 s); 1-1 und 1-4 ohne Zeit dahinter, gemeinsam auf Platz 3.
    expect(e.nachPlatz.map((z) => [z.starter.id, z.platz, z.summe, z.zeit, z.stich])).toEqual([
      ['1-2', 1, 4, 14300, true],
      ['1-3', 2, 4, 14600, true],
      ['1-1', 3, 4, null, true],
      ['1-4', 3, 4, null, true],
    ])
  })

  it('haben alle Punktgleichen keine Zeit, teilen sie sich den Platz', () => {
    // Drei Starter. 1-3 ist im Manövrieren in beiden Versuchen disqualifiziert (0 Punkte, keine
    // Zeit) und gewinnt den Parallelslalom; 1-1 gewinnt das Manövrieren und ist im Vorlauf
    // disqualifiziert (0 Punkte, keine Zeit): beide 400.
    let state = manoever(uim(mk('1', 3)), { '1-1': [60, 70], '1-2': [61, 71], '1-3': [null, null] })
    state = fahre(state, 'pre', { '1-1': [null, 40], '1-2': [41, 41], '1-3': [40, 40] })
    state = fahre(fest(state, 'final'), 'final', { '1-2': [41, 41], '1-3': [40, 40] })
    expect(liste(state)).toEqual([
      ['1-2', 1, 300, 300, 600],
      ['1-1', 2, 400, 0, 400],
      ['1-3', 2, 0, 400, 400],
    ])
    expect(einzel(state).nachPlatz.slice(1).map((z) => [z.zeit, z.stich, z.punktgleich, z.disq])).toEqual([
      [null, false, true, true],
      [null, false, true, true],
    ])
  })

  it('nach einer Wiederholung zum Vorlauf zählt deren Zeit („only the time of the re-run“)', () => {
    // 1-4 und 1-5 teilen sich im Vorlauf Platz 4 und wiederholen.
    let state = manoever(uim(mk('1', 6)), MANOEVER6)
    state = fahre(state, 'pre', { ...VORLAUF6, '1-4': [43, 45], '1-5': [45, 43] })
    state = fahre(fest(state, 'rerun-pre-1'), 'rerun-pre-1', { '1-4': [60, 60], '1-5': [50, 59] })
    state = fahre(fest(state, 'semi'), 'semi', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-5': [43, 43] })
    state = fahre(fest(state, 'final'), 'final', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-5': [43, 43] })
    const von = zeilen(state)
    // 1-4: besserer Versuch 62 s + Wiederholung 120 s; 1-5: 61 s + 109 s; 1-6 hat nicht wiederholt: 60 s + 110 s.
    expect([von['1-4'].zeit, von['1-5'].zeit, von['1-6'].zeit]).toEqual([18200, 17000, 17000])
  })
})

describe('Welche Disziplin zählt (Entscheidungen des Nutzers, lib/disziplinen.ts)', () => {
  it('nur der Parallelslalom, ohne Manövrieren: Seine Punkte sind die der Einzelwertung', () => {
    const state = parallel6(uim(mk('1', 6)))
    expect(einzel(state)).toMatchObject({ disziplinen: ['parallel'], fertig: true, manoeverFertig: true, parallelFertig: true })
    expect(liste(state).slice(0, 3)).toEqual([
      ['1-1', 1, null, 400, 400],
      ['1-2', 2, null, 300, 300],
      ['1-3', 3, null, 225, 225],
    ])
    expect(einzelBlaetter(state, konfig, ['1'], PUNKTE).map((b) => b.key)).toEqual(['einzel/1'])
    // Die Mannschaftswertung rechnet mit denselben Punkten und ist kein Zwischenstand.
    const w = uimWertung(einzelPokalKlassen(einzelwertungen(state, konfig, ['1'], PUNKTE)), { punkte: PUNKTE, beste: 5, mindestens: 1 }, pokalZuordnung(state, false))
    expect([w.gruppen[0].summeBeste, w.offen]).toEqual([400 + 300 + 225 + 169 + 127, []])
  })

  it('die Reihenfolge der Disziplinen spielt keine Rolle: erst Parallelslalom, dann Manövrieren', () => {
    const erst = manoever(parallel6(uim(mk('1', 6))), MANOEVER6)
    expect(liste(erst)).toEqual(liste(beide6()))
  })

  it('das X einer Abmeldung macht die andere Disziplin nicht zur gefahrenen – in beide Richtungen', () => {
    // Nur Manövrieren, Plan des Vorlaufs fest: Die Abmeldung schreibt ihr X auch in beide Attempts des Vorlaufs.
    const nurM = reducer(manoever(uim(mk('1', 6)), MANOEVER6), { type: 'ABMELDEN_STARTER', id: '1-1' })
    expect(Object.keys(nurM.eingaben)).toEqual(expect.arrayContaining([attemptSchluessel('pre', 1), attemptSchluessel('pre', 2)]))
    expect(disziplinGefahren(nurM, 'parallel')).toBe(false)
    expect(einzel(nurM)).toMatchObject({ disziplinen: ['manoever'], fertig: true })
    expect(einzelBlaetter(nurM, konfig, ['1'], PUNKTE)).toHaveLength(1)
    // Nur Parallelslalom: Das X steht in allen Läufen des Manövrierens.
    const nurP = reducer(parallel6(uim(mk('1', 6))), { type: 'ABMELDEN_STARTER', id: '1-6' })
    expect(Object.keys(nurP.eingaben)).toContain(laufSchluessel(M, 1))
    expect(disziplinGefahren(nurP, 'manoever')).toBe(false)
    expect(einzel(nurP)).toMatchObject({ disziplinen: ['parallel'], fertig: true })
    // Steht beim Abgemeldeten mehr als das X, zählt es wie jeder Wert.
    const mehr = reducer(nurM, { type: 'SET_EINGABEN', zellen: [{ lauf: attemptSchluessel('pre', 1), starter: '1-1', feld: 'zeit1', wert: '40,00' }] })
    expect(disziplinGefahren(mehr, 'parallel')).toBe(true)
  })

  it('Zeit und Platz je Disziplin aus ihrem Gesamtergebnis (Entscheidung des Nutzers)', () => {
    const state = beide6()
    const von = Object.fromEntries(einzel(state).nachPlatz.map((z) => [z.starter.id, [z.manoeverErgebnis, z.parallelErgebnis]]))
    // Manövrieren: der bessere Versuch (Knoten ohne Strafe), Platz der Gesamtliste.
    expect(von['1-6'][0]).toEqual({ zeit: 6000, platz: 1, disq: false })
    // Parallelslalom: Finalisten mit der Summe ihres Finales, ab Platz 5 mit der des Vorlaufs.
    expect(von['1-1'][1]).toEqual({ zeit: 8000, platz: 1, disq: false })
    expect(von['1-5'][1]).toEqual({ zeit: 10000, platz: 5, disq: false })
    // Nur das Manövrieren gefahren: kein Ergebnis des Parallelslaloms.
    expect(einzel(manoever(uim(mk('1', 6)), MANOEVER6)).nachPlatz.every((z) => z.parallelErgebnis === null && z.manoeverErgebnis !== null)).toBe(true)
  })

  it('ohne einen einzigen Wert zählt keine Disziplin: keine Liste', () => {
    const leer = uim(mk('1', 6))
    expect(einzel(leer)).toMatchObject({ disziplinen: [], fertig: false })
    expect(einzelBlaetter(leer, konfig, ['1'], PUNKTE)).toEqual([])
  })

  it('„Disziplin nicht werten“ je Klasse: Die Disziplin fehlt in Einzel- und Mannschaftswertung der Klasse', () => {
    // Der Parallelslalom ist in Klasse 1 nur bis zum Vorlauf gekommen (abgebrochen).
    let state = fahre(manoever(uim(mk('1', 6)), MANOEVER6), 'pre', VORLAUF6)
    expect(einzel(state).fertig).toBe(false)
    state = reducer(state, { type: 'SET_NICHT_WERTEN', disziplin: 'parallel', klassen: ['1'], an: true })
    expect(state.nichtWerten).toEqual({ parallel: ['1'] })
    expect(einzel(state)).toMatchObject({ disziplinen: ['manoever'], gestrichen: ['parallel'], fertig: true })
    expect(liste(state)[0]).toEqual(['1-6', 1, 400, null, 400])
    const klassen = einzelPokalKlassen(einzelwertungen(state, konfig, ['1'], PUNKTE))
    expect(klassen[0].fertig).toBe(true)
    expect(klassen[0].zeilen.map((z) => z.punkte)).toEqual([400, 300, 225, 169, 127, 95])
    // Beide Disziplinen gestrichen: Die Klasse trägt nichts bei, hält aber auch nichts auf.
    const beide = reducer(state, { type: 'SET_NICHT_WERTEN', disziplin: 'manoever', klassen: ['1', '2'], an: true })
    expect(beide.nichtWerten).toEqual({ parallel: ['1'], manoever: ['1', '2'] })
    expect(einzel(beide)).toMatchObject({ disziplinen: [], gestrichen: ['manoever', 'parallel'], fertig: false })
    expect(einzelBlaetter(beide, konfig, ['1'], PUNKTE)).toEqual([])
    const ohne = einzelPokalKlassen(einzelwertungen(beide, konfig, ['1'], PUNKTE))[0]
    expect([ohne.fertig, ohne.zeilen.every((z) => z.offen)]).toEqual([true, true])
    // Lösen stellt die Wertung wieder her; „Werte löschen“ setzt den Schalter zurück.
    expect(reducer(beide, { type: 'SET_NICHT_WERTEN', disziplin: 'manoever', klassen: ['1', '2'], an: false }).nichtWerten).toEqual({ parallel: ['1'] })
    expect(reducer(beide, { type: 'CLEAR_EINGABEN' }).nichtWerten).toEqual({})
    // Unter der DM gibt es den Schalter nicht.
    const dm = reducer(reducer(emptyState(), { type: 'ADD_STARTERS', starters: mk('1', 2) }), { type: 'SET_NICHT_WERTEN', disziplin: 'manoever', klassen: ['1'], an: true })
    expect(dm.nichtWerten).toEqual({})
  })

  it('die UIM points des Manövrierens gibt es erst, wenn die Knoten erfasst sind', () => {
    // Alle Versuche gefahren, die Knoten von 1-1 fehlen noch.
    let state = manoever(offen(mk('1', 6)), MANOEVER6, undefined, false)
    state = reducer(state, { type: 'SET_EINGABEN', zellen: ['1-2', '1-3', '1-4', '1-5', '1-6'].map(knotenHaken) })
    const gesamt = () => klassenErgebnis(state, konfig, '1')!.gesamt
    expect(gesamtPunkte(gesamt(), state.laufCount, PUNKTE)).toBeNull()
    expect(einzel(state)).toMatchObject({ fertig: false, manoeverFertig: false })
    // Im Zwischenstand ist 1-1 noch offen; die übrigen stehen unter den Gefahrenen.
    const von = Object.fromEntries(liste(state).map((z) => [z[0], z.slice(1)]))
    expect(von['1-1']).toEqual([0, null, null, 0])
    expect(von['1-6']).toEqual([1, 400, null, 400])
    // Mit dem Haken der Knoten-Liste (fehlerfreie Knoten) steht das Ergebnis.
    state = reducer(state, { type: 'SET_EINGABEN', zellen: [knotenHaken('1-1')] })
    expect(gesamtPunkte(gesamt(), state.laufCount, PUNKTE)?.get('1-1')).toBe(95)
    expect(einzel(state)).toMatchObject({ fertig: true, manoeverFertig: true })
    // Ein Disqualifizierter braucht keine Knoten: Er hat ohnehin 0 Punkte.
    let disq = manoever(offen(mk('1', 2)), { '1-1': [60, 70] })
    disq = manoever(disq, { '1-2': [null, null] }, undefined, false)
    expect(einzel(disq).manoeverFertig).toBe(true)
  })
})

describe('Mannschaftswertung UIM aus der Einzelwertung (Pkt. 5.1, 5.2.4)', () => {
  const REGELN = (state: AppState) => {
    const r = pokalRegeln(state)
    return { punkte: r.punkte.uim, beste: r.beste, mindestens: 1, stich: r.stich }
  }
  const wertung = (state: AppState) => uimWertung(einzelPokalKlassen(einzelwertungen(state, konfig, ['1'], PUNKTE)), REGELN(state), pokalZuordnung(state, false))
  const nurManoever = (state: AppState) => uimWertung(pokalKlassen(state, konfig, ['1']), REGELN(state), pokalZuordnung(state, false))
  const tabelle = (w: ReturnType<typeof uimWertung>) => w.gruppen.map((g) => `${g.platz}. ${g.herkunft} ${g.summeBeste}${g.stich ? '*' : ''}`)
  // 1-1, 1-3, 1-5 fahren für Nord, 1-2, 1-4, 1-6 für Süd.
  const sechs = () => mk('1', 6, (i) => (i % 2 === 0 ? 'Nord' : 'Süd'))

  it('je Starter zählen die addierten Punkte; der Platz auf dem Blatt ist der der Einzelwertung', () => {
    const state = parallel6(manoever(uim(sechs()), MANOEVER6))
    const w = wertung(state)
    // Nord: 495 + 394 + 427 = 1316; Süd: 427 + 394 + 495 = 1316 – punktgleich.
    expect(w.gruppen.map((g) => [g.herkunft, g.summeBeste])).toEqual([
      ['Nord', 1316],
      ['Süd', 1316],
    ])
    expect(w.gruppen[0].starter.map((s) => [s.starter.id, s.platz, s.punkte])).toEqual([
      ['1-1', 1, 495],
      ['1-5', 4, 427],
      ['1-3', 5, 394],
    ])
    expect(w.offen).toEqual([])
    // Nur aus dem Manövrieren gerechnet sähe es anders aus: Süd 400 + 225 + 127, Nord 300 + 169 + 95.
    expect(tabelle(nurManoever(state))).toEqual(['1. Süd 752', '2. Nord 564'])
  })

  it('bei gleicher Summe entscheiden die 1st places der Einzelwertung, dann die 2nd places usw. (Pkt. 5.2.6)', () => {
    const state = parallel6(manoever(uim(sechs()), MANOEVER6))
    // Nord hat den 1. Platz der Einzelwertung (1-1), Süd den 2. (1-6).
    expect(tabelle(wertung(state))).toEqual(['1. Nord 1316*', '2. Süd 1316*'])
    // Ohne 1. Plätze auf beiden Seiten entscheidet der 2. Platz: zwei Klassen, je Mannschaft dieselbe Summe.
    const zeile = (id: string, klasse: ClassId, verein: string, platz: number, punkte: number) => ({ starter: { ...mk(klasse, 1)[0], id, verein }, platz, disq: false, offen: false, punkte })
    const klassen = [
      { klasse: '1' as ClassId, fertig: true, laeufe: [1, 2], gefahren: 2, zeilen: [zeile('a', '1', 'Ost', 2, 300), zeile('b', '1', 'West', 3, 300)] },
      { klasse: '2' as ClassId, fertig: true, laeufe: [1, 2], gefahren: 2, zeilen: [zeile('c', '2', 'Ost', 4, 100), zeile('d', '2', 'West', 4, 100)] },
    ]
    expect(tabelle(uimWertung(klassen, REGELN(state), pokalZuordnung(state, false)))).toEqual(['1. Ost 400*', '2. West 400*'])
  })

  it('Zwischenstand, solange der Parallelslalom einer Klasse läuft: Es zählen die Punkte, die feststehen', () => {
    const state = fahre(manoever(uim(sechs()), MANOEVER6), 'pre', VORLAUF6)
    const w = wertung(state)
    expect(w.offen).toEqual(['1'])
    expect(tabelle(w)).toEqual(tabelle(nurManoever(state)))
  })

  it('wer nur im Parallelslalom Punkte hat, zählt mit ihnen – im Manövrieren disqualifiziert heißt nicht „ohne Platz“', () => {
    const state = parallel6(manoever(uim(sechs()), { ...MANOEVER6, '1-1': [null, null] }))
    const nord = wertung(state).gruppen.find((g) => g.herkunft === 'Nord')!
    expect(nord.starter.find((s) => s.starter.id === '1-1')).toMatchObject({ punkte: 400, disq: false, offen: false })
  })
})

describe('Zeitstempel (lib/listenStand.ts)', () => {
  it('die Einzelwertung trägt den jüngsten Zeitpunkt der Klasse aus beiden Stages', () => {
    let state = manoever(uim(mk('1', 6)), MANOEVER6, Date.UTC(2026, 8, 26, 10))
    state = fahre(state, 'pre', VORLAUF6, Date.UTC(2026, 8, 26, 12))
    const m = gesamtZeit(state.listenStand, M, '1')
    const p = gesamtZeit(state.listenStand, rundenDisziplin('pre'), '1')
    expect(m < p).toBe(true)
    expect(einzelZeit(state.listenStand, M, '1')).toBe(p)
    expect(einzelZeit(state.listenStand, M)).toBe(p)
    // Eine andere Klasse berührt sie nicht; das Manövrieren allein behält seinen Zeitpunkt.
    expect(einzelZeit(state.listenStand, M, '2')).toBe('')
    expect(wertungZeit(state.listenStand, M)).toBe(m)
    // Eine spätere Änderung im Manövrieren zieht die Einzelwertung nach.
    state = manoever(state, { '1-1': [64] }, Date.UTC(2026, 8, 26, 13))
    expect(einzelZeit(state.listenStand, M, '1')).toBe(gesamtZeit(state.listenStand, M, '1'))
  })

  it('„Disziplin nicht werten“ ändert die Gesamtliste der Disziplin (sie trägt den Hinweis) – und damit Einzel- und Mannschaftswertung', () => {
    let state = fahre(manoever(uim(mk('1', 6)), MANOEVER6, Date.UTC(2026, 8, 26, 10)), 'pre', VORLAUF6, Date.UTC(2026, 8, 26, 11))
    const um = Date.UTC(2026, 8, 26, 14)
    state = reducer(state, { type: 'SET_NICHT_WERTEN', disziplin: 'parallel', klassen: ['1'], an: true, zeit: um })
    const iso = new Date(um).toISOString()
    expect([gesamtZeit(state.listenStand, rundenDisziplin('pre'), '1'), einzelZeit(state.listenStand, M, '1'), einzelZeit(state.listenStand, M)]).toEqual([iso, iso, iso])
    // Das Manövrieren ist nicht betroffen.
    expect(gesamtZeit(state.listenStand, M, '1')).toBe(new Date(Date.UTC(2026, 8, 26, 10)).toISOString())
    const spaeter = Date.UTC(2026, 8, 26, 15)
    state = reducer(state, { type: 'SET_NICHT_WERTEN', disziplin: 'manoever', klassen: ['1'], an: true, zeit: spaeter })
    expect(wertungZeit(state.listenStand, M)).toBe(new Date(spaeter).toISOString())
  })
})
