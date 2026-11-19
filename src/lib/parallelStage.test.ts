import { describe, expect, it } from 'vitest'
import { configFor } from '../config/konfig'
import { pokalVorgabe } from '../config/pokal'
import { emptyState, reducer } from '../state/reducer'
import { abmeldeAttempts } from './abmeldung'
import { feldVon } from './eingaben'
import { gesamtZeit } from './listenStand'
import { parallelBoegen } from './parallelBogen'
import { durchWiederholung, PARALLEL_ANNAHMEN, rundenErgebnis, rundenVermerke } from './parallelErgebnis'
import { attemptSchluessel, rundenDisziplin } from './parallelSchluessel'
import { alleWeiter, klassenStaende, klassenStand, offeneKlassen, stageBlaetter, stageDurchWiederholung, stageErgebnis } from './parallelStage'
import { beschreibe } from './verlauf'
import { klassenPaare, normalisierePlaene, rundenName, vergleicheRunden, zerlegeRerun } from '../planung/parallelRunden'
import type { AppState, ClassId, ParallelRunde, Starter } from '../types'

// Halbfinale, Finals, Wiederholung und das Ergebnis der Stage (Regel 960, Pkt. 4.4, 5.1, 5.2.2,
// 5.2.6). Alle Starter sind erfunden.

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

const konfig = configFor({ regelwerk: 'uim-2026' })
const PUNKTE = pokalVorgabe('uim-2026').punkte.uim
const DISQ = feldVon(konfig, 'parallelparcours', '1', 'disq')!.kennung
const X = feldVon(konfig, 'steg', '1', 'disq')!.kennung

/** UIM mit festgeschriebenem Plan des Vorlaufs. */
function uim(starters: Starter[]): AppState {
  let state = reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
  state = reducer(state, { type: 'ADD_STARTERS', starters })
  return reducer(state, { type: 'SET_VERZAHNUNG_LOCK', locked: true })
}

/** Je Starter die beiden Attempts einer Runde in Sekunden; `null` = disqualifiziert (mit Zeit). */
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
const stand = (state: AppState, klasse: ClassId = '1') => klassenStand(state, konfig, klasse)!
const ergebnis = (state: AppState, runde: ParallelRunde, klasse: ClassId = '1') => rundenErgebnis(state, konfig, klasse, runde)!
const plaetze = (state: AppState, runde: ParallelRunde, klasse: ClassId = '1') => Object.fromEntries(ergebnis(state, runde, klasse).gesamt.nachPlatz.map((z) => [z.starter.id, z.platz]))
const vermerke = (state: AppState, runde: ParallelRunde) => Object.fromEntries([...rundenVermerke(ergebnis(state, runde), PUNKTE)!].map(([id, v]) => [id, v.art === 'punkte' ? v.punkte : v.art]))
const stage = (state: AppState, klasse: ClassId = '1') => stageErgebnis(state, konfig, klasse, PUNKTE)!.nachPlatz.map((z) => [z.starter.id, z.platz, z.punkte, z.runde, z.disq ? 'disq' : z.gesamt! / 100])
const paare = (state: AppState, runde: ParallelRunde, klasse: ClassId = '1') => klassenPaare(state.parallelPlaene[runde], klasse)

/** Sechs Starter, Vorlauf entschieden: 1-1 … 1-4 qualifiziert (Summen 80, 82, 84, 86), 1-5 und 1-6 dahinter. */
const VORLAUF6 = { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43], '1-5': [50, 50], '1-6': [55, 55] }
const nachVorlauf = () => fahre(uim(mk('1', 6)), 'pre', VORLAUF6)

describe('Halbfinale (Pkt. 4.4)', () => {
  it('steht erst an, wenn der Vorlauf der Klasse vollständig ist', () => {
    const offen = fahre(uim(mk('1', 6)), 'pre', { ...VORLAUF6, '1-6': [55] })
    expect(stand(offen).naechste).toBeUndefined()
    expect(stand(offen).runden.map((r) => [r.runde, r.zustand])).toEqual([['pre', 'laeuft']])
    expect(fest(offen, 'semi')).toBe(offen)
    expect(stand(nachVorlauf()).naechste?.runde).toBe('semi')
  })

  it('Paare der besten vier „according to the personal number“: nach Startnummer, die kleinere auf Racecourse A', () => {
    // Die besten vier sind 1-6, 1-2, 1-5, 1-3 – gesetzt wird nach Nummer, nicht nach Platz.
    const state = fahre(uim(mk('1', 6)), 'pre', { '1-1': [60, 60], '1-2': [41, 41], '1-3': [42, 42], '1-4': [61, 61], '1-5': [40, 43], '1-6': [39, 39] })
    expect(stand(state).naechste).toEqual({
      runde: 'semi',
      paare: [
        { a: '1-2', b: '1-3' },
        { a: '1-5', b: '1-6' },
      ],
    })
    const semi = fest(state, 'semi')
    // Je Paar zwei Attempts nacheinander, im zweiten mit getauschten Racecourses; die Starts tragen ihre Klasse.
    expect(semi.parallelPlaene.semi).toEqual({
      runde: 'semi',
      starts: [
        { a: '1-2', b: '1-3', attempt: 1, block: 0, boot: 'klein', klasse: '1' },
        { a: '1-3', b: '1-2', attempt: 2, block: 0, boot: 'klein', klasse: '1' },
        { a: '1-5', b: '1-6', attempt: 1, block: 1, boot: 'klein', klasse: '1' },
        { a: '1-6', b: '1-5', attempt: 2, block: 1, boot: 'klein', klasse: '1' },
      ],
    })
    expect(stand(semi).naechste).toBeUndefined()
    expect(stand(semi).runden.map((r) => [r.runde, r.zustand, r.veraltet])).toEqual([
      ['pre', 'fertig', false],
      ['semi', 'leer', false],
    ])
    // Ein zweites Festschreiben derselben Runde ändert nichts mehr.
    expect(fest(semi, 'semi')).toBe(semi)
  })

  it('alle vier werden gemeinsam nach der Summe beider Attempts gereiht, unabhängig vom Paar', () => {
    let state = fest(nachVorlauf(), 'semi')
    // Paare: 1-1/1-2 und 1-3/1-4. Die beiden Schnellsten sitzen im selben Paar.
    state = fahre(state, 'semi', { '1-1': [40, 40], '1-2': [39, 40], '1-3': [45, 45], '1-4': [44, 45] })
    expect(plaetze(state, 'semi')).toEqual({ '1-2': 1, '1-1': 2, '1-4': 3, '1-3': 4 })
    expect(ergebnis(state, 'semi').folge).toEqual(['1-2', '1-1', '1-4', '1-3'])
    expect(vermerke(state, 'semi')).toEqual({ '1-2': 'final', '1-1': 'final', '1-4': 'final34', '1-3': 'final34' })
  })

  it('eine Disqualifikation: letzter Platz des heat (Platz 4 der vier), der Fahrer fährt das Finale um Platz 3 und 4', () => {
    let state = fest(nachVorlauf(), 'semi')
    state = fahre(state, 'semi', { '1-1': [null, 40], '1-2': [39, 40], '1-3': [45, 45], '1-4': [44, 45] })
    expect(plaetze(state, 'semi')).toEqual({ '1-2': 1, '1-4': 2, '1-3': 3, '1-1': 4 })
    expect(stand(state).naechste).toEqual({
      runde: 'final',
      paare: [
        { a: '1-1', b: '1-3', finale: 3 },
        { a: '1-2', b: '1-4', finale: 1 },
      ],
    })
  })

  it('zwei Disqualifizierte teilen sich den hinteren Platz – ohne Reihung nach dem gültigen Attempt', () => {
    let state = fest(nachVorlauf(), 'semi')
    state = fahre(state, 'semi', { '1-1': [null, 30], '1-2': [39, 40], '1-3': [45, null], '1-4': [44, 45] })
    expect(plaetze(state, 'semi')).toEqual({ '1-2': 1, '1-4': 2, '1-1': 4, '1-3': 4 })
    expect(stand(state).naechste?.paare).toEqual([
      { a: '1-1', b: '1-3', finale: 3 },
      { a: '1-2', b: '1-4', finale: 1 },
    ])
  })
})

describe('Finals und Ergebnis der Stage', () => {
  const bisFinale = () => {
    let state = fest(nachVorlauf(), 'semi')
    state = fahre(state, 'semi', { '1-1': [40, 40], '1-2': [39, 40], '1-3': [45, 45], '1-4': [44, 45] })
    return fest(state, 'final')
  }

  it('1. und 2. des Halbfinales fahren um Platz 1 und 2, 3. und 4. um Platz 3 und 4 – das Finale um Platz 3 und 4 zuerst', () => {
    const state = bisFinale()
    expect(state.parallelPlaene.final!.starts.map((s) => [s.a, s.b, s.attempt, s.finale])).toEqual([
      ['1-3', '1-4', 1, 3],
      ['1-4', '1-3', 2, 3],
      ['1-1', '1-2', 1, 1],
      ['1-2', '1-1', 2, 1],
    ])
    expect(stageErgebnis(state, konfig, '1', PUNKTE)).toBeNull()
    expect(offeneKlassen(state, konfig)).toEqual([{ klasse: '1', runde: 'final', festschreiben: false, veraltet: false }])
  })

  it('Plätze 1 bis 4 aus den Finals – je Paar –, ab Platz 5 aus dem Vorlauf, mit UIM points', () => {
    // Der Sieger des Finales um Platz 3 und 4 ist schneller als beide im Finale: Er bleibt Dritter.
    const state = fahre(bisFinale(), 'final', { '1-1': [41, 41], '1-2': [40, 43], '1-3': [30, 30], '1-4': [44, 45] })
    expect(plaetze(state, 'final')).toEqual({ '1-1': 1, '1-2': 2, '1-3': 3, '1-4': 4 })
    expect(vermerke(state, 'final')).toEqual({ '1-1': 400, '1-2': 300, '1-3': 225, '1-4': 169 })
    expect(stand(state).fertig).toBe(true)
    expect(stage(state)).toEqual([
      ['1-1', 1, 400, 'final', 82],
      ['1-2', 2, 300, 'final', 83],
      ['1-3', 3, 225, 'final', 60],
      ['1-4', 4, 169, 'final', 89],
      ['1-5', 5, 127, 'pre', 100],
      ['1-6', 6, 95, 'pre', 110],
    ])
    expect(offeneKlassen(state, konfig)).toEqual([])
    expect(stageBlaetter(state, konfig, ['1', '2'], PUNKTE).map((b) => b.key)).toEqual(['parallel:stage/1'])
  })

  it('Gleichstand im Finale bleibt stehen (dead-heat result): geteilter Platz, beide die vollen Punkte', () => {
    const state = fahre(bisFinale(), 'final', { '1-1': [41, 42], '1-2': [42, 41], '1-3': [30, 30], '1-4': [44, 45] })
    expect(plaetze(state, 'final')).toEqual({ '1-1': 1, '1-2': 1, '1-3': 3, '1-4': 4 })
    expect(ergebnis(state, 'final').rerun).toEqual([])
    expect(stage(state).slice(0, 2)).toEqual([
      ['1-1', 1, 400, 'final', 83],
      ['1-2', 1, 400, 'final', 83],
    ])
  })

  it('Disqualifikation im Finale: der hintere Platz des Paars, mit dessen Punkten; zwei teilen ihn sich', () => {
    expect(PARALLEL_ANNAHMEN.disqImHeatBehaeltPunkte).toBe(true)
    const einer = fahre(bisFinale(), 'final', { '1-1': [null, 20], '1-2': [40, 43], '1-3': [30, 30], '1-4': [44, 45] })
    expect(plaetze(einer, 'final')).toEqual({ '1-2': 1, '1-1': 2, '1-3': 3, '1-4': 4 })
    expect(stage(einer).slice(0, 2)).toEqual([
      ['1-2', 1, 400, 'final', 83],
      ['1-1', 2, 300, 'final', 'disq'],
    ])
    const beide = fahre(bisFinale(), 'final', { '1-1': [41, 41], '1-2': [40, 43], '1-3': [null, 30], '1-4': [44, null] })
    expect(plaetze(beide, 'final')).toEqual({ '1-1': 1, '1-2': 2, '1-3': 4, '1-4': 4 })
    expect(stage(beide).slice(2, 4)).toEqual([
      ['1-3', 4, 169, 'final', 'disq'],
      ['1-4', 4, 169, 'final', 'disq'],
    ])
  })

  it('im Vorlauf Disqualifizierte stehen im Ergebnis der Stage hinten, ohne Punkte', () => {
    let state = fahre(uim(mk('1', 6)), 'pre', { ...VORLAUF6, '1-6': [55, null] })
    state = fahre(fest(state, 'semi'), 'semi', { '1-1': [40, 40], '1-2': [39, 40], '1-3': [45, 45], '1-4': [44, 45] })
    state = fahre(fest(state, 'final'), 'final', { '1-1': [41, 41], '1-2': [40, 43], '1-3': [30, 30], '1-4': [44, 45] })
    expect(stage(state).slice(4)).toEqual([
      ['1-5', 5, 127, 'pre', 100],
      ['1-6', 6, 0, 'pre', 'disq'],
    ])
  })
})

describe('weniger als vier Gewertete (Annahme, Organisation – nicht Regel 960)', () => {
  it('3 Gewertete: Halbfinale mit Dummy; der Dritte hat Platz 3 ohne Finale um Platz 3 und 4', () => {
    let state = fahre(uim(mk('1', 4)), 'pre', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, null] })
    expect(stand(state).naechste).toEqual({
      runde: 'semi',
      paare: [
        { a: '1-1', b: '1-2' },
        { a: '1-3', b: null },
      ],
    })
    state = fest(state, 'semi')
    expect(state.parallelPlaene.semi!.starts.slice(2).map((s) => [s.a, s.b])).toEqual([
      ['1-3', null],
      [null, '1-3'],
    ])
    state = fahre(state, 'semi', { '1-1': [40, 40], '1-2': [45, 45], '1-3': [39, 39] })
    expect(vermerke(state, 'semi')).toEqual({ '1-3': 'final', '1-1': 'final', '1-2': 225 })
    expect(stand(state).naechste).toEqual({ runde: 'final', paare: [{ a: '1-1', b: '1-3', finale: 1 }] })
    state = fahre(fest(state, 'final'), 'final', { '1-1': [40, 40], '1-3': [41, 41] })
    expect(stage(state)).toEqual([
      ['1-1', 1, 400, 'final', 80],
      ['1-3', 2, 300, 'final', 82],
      ['1-2', 3, 225, 'semi', 90],
      ['1-4', 4, 0, 'pre', 'disq'],
    ])
  })

  it('2 Gewertete: direkt das Finale', () => {
    let state = fahre(uim(mk('1', 3)), 'pre', { '1-1': [40, 40], '1-2': [null, 41], '1-3': [42, 42] })
    expect(stand(state).naechste).toEqual({ runde: 'final', paare: [{ a: '1-1', b: '1-3', finale: 1 }] })
    expect(fest(state, 'semi')).toBe(state)
    state = fahre(fest(state, 'final'), 'final', { '1-1': [45, 45], '1-3': [41, 41] })
    expect(stage(state)).toEqual([
      ['1-3', 1, 400, 'final', 82],
      ['1-1', 2, 300, 'final', 90],
      ['1-2', 3, 0, 'pre', 'disq'],
    ])
  })

  it('1 Gewerteter: Platz 1 aus dem Vorlauf, keine weitere Runde', () => {
    const state = fahre(uim(mk('1', 2)), 'pre', { '1-1': [40, 40], '1-2': [null, 41] })
    expect(stand(state)).toMatchObject({ fertig: true, naechste: undefined })
    expect(vermerke(state, 'pre')).toEqual({ '1-1': 400, '1-2': 0 })
    expect(stage(state)).toEqual([
      ['1-1', 1, 400, 'pre', 80],
      ['1-2', 2, 0, 'pre', 'disq'],
    ])
  })

  it('kein Gewerteter: Die Stage ist fertig, niemand hat Punkte', () => {
    const state = fahre(uim(mk('1', 2)), 'pre', { '1-1': [null, 40], '1-2': [null, 41] })
    expect(stand(state).fertig).toBe(true)
    expect(stage(state).map((z) => z[2])).toEqual([0, 0])
  })
})

describe('Wiederholung (Pkt. 5.2.6)', () => {
  // 1-4 und 1-5 teilen sich Platz 4: gleiche Summe, gleicher bester Attempt.
  const gleich = () => fahre(uim(mk('1', 6)), 'pre', { ...VORLAUF6, '1-4': [43, 45], '1-5': [45, 43] })

  it('Gleichstand an der Grenze 4/5: Das Halbfinale ist gesperrt, es steht die Wiederholung der Betroffenen an', () => {
    const state = gleich()
    expect(plaetze(state, 'pre')).toMatchObject({ '1-4': 4, '1-5': 4, '1-6': 6 })
    expect(stand(state).naechste).toEqual({ runde: 'rerun-pre-1', paare: [{ a: '1-4', b: '1-5' }] })
    expect(fest(state, 'semi')).toBe(state)
    // Die ganze Klasse ohne „Qualified“, bis die Wiederholung gefahren ist. Wer hinter der Gruppe
    // steht, hat seine Punkte schon: Der Re-run entscheidet nur die Reihenfolge der Gleichstehenden
    // (PARALLEL_ANNAHMEN.disqInWiederholungDesVorlaufs, Entscheidung des Nutzers).
    expect(vermerke(state, 'pre')).toEqual({ '1-4': 'rerun', '1-5': 'rerun', '1-6': 95 })
  })

  it('die Re-run-Fahrer bleiben auf den Plätzen, um die sie gleichauf lagen – egal wie ihre Re-run-Zeit ist', () => {
    // 1-4 und 1-5 teilen sich Platz 4 (88 s), 1-6 ist Sechster (110 s), 1-3 Dritter (84 s).
    let state = fest(gleich(), 'rerun-pre-1')
    // In der Wiederholung fahren beide viel langsamer als der Sechste (150 und 160 s) …
    const langsam = fahre(state, 'rerun-pre-1', { '1-4': [80, 80], '1-5': [75, 75] })
    // … und bleiben trotzdem auf Platz 4 und 5: 1-5 (150 s) vor 1-4 (160 s), 1-6 bleibt Sechster.
    expect(plaetze(langsam, 'pre')).toEqual({ '1-1': 1, '1-2': 2, '1-3': 3, '1-5': 4, '1-4': 5, '1-6': 6 })
    // Ebenso, wenn beide schneller fahren als der Erste (60 und 62 s statt 80 s): Sie rücken nicht vor.
    const schnell = fahre(state, 'rerun-pre-1', { '1-4': [30, 30], '1-5': [31, 31] })
    expect(plaetze(schnell, 'pre')).toEqual({ '1-1': 1, '1-2': 2, '1-3': 3, '1-4': 4, '1-5': 5, '1-6': 6 })
    expect(vermerke(schnell, 'pre')).toMatchObject({ '1-1': 'qualified', '1-4': 'qualified', '1-5': 127, '1-6': 95 })
    state = schnell
    expect(stand(state).naechste?.runde).toBe('semi')
  })

  it('nach der Wiederholung zählt nur deren Zeit: Sie vergibt die geteilten Plätze', () => {
    let state = fest(gleich(), 'rerun-pre-1')
    expect(state.parallelPlaene['rerun-pre-1']!.starts.map((s) => [s.a, s.b, s.attempt, s.klasse])).toEqual([
      ['1-4', '1-5', 1, '1'],
      ['1-5', '1-4', 2, '1'],
    ])
    // Erst ein Attempt gefahren: weiter gesperrt.
    state = fahre(state, 'rerun-pre-1', { '1-4': [60], '1-5': [50] })
    expect(stand(state).naechste).toBeUndefined()
    expect(ergebnis(state, 'pre').rerunFest).toBe(true)
    // Solange die Wiederholung nicht eingerechnet ist, hat sie keinen Platz entschieden (kein Sternchen).
    expect(durchWiederholung(ergebnis(state, 'pre')).size).toBe(0)
    // 1-5 gewinnt die Wiederholung – obwohl beide dort langsamer sind als 1-6 im Vorlauf.
    state = fahre(state, 'rerun-pre-1', { '1-4': [60, 60], '1-5': [50, 59] })
    expect(plaetze(state, 'pre')).toEqual({ '1-1': 1, '1-2': 2, '1-3': 3, '1-5': 4, '1-4': 5, '1-6': 6 })
    expect(ergebnis(state, 'pre').wiederholt).toEqual(['rerun-pre-1'])
    // Ihre Plätze hat die Wiederholung entschieden: Sternchen auf den Results des Vorlaufs – nicht auf ihrer eigenen Liste.
    expect([...durchWiederholung(ergebnis(state, 'pre'))].sort()).toEqual(['1-4', '1-5'])
    expect(durchWiederholung(ergebnis(state, 'rerun-pre-1')).size).toBe(0)
    expect(vermerke(state, 'pre')).toMatchObject({ '1-5': 'qualified', '1-4': 127, '1-6': 95 })
    expect(stand(state).naechste).toEqual({
      runde: 'semi',
      paare: [
        { a: '1-1', b: '1-2' },
        { a: '1-3', b: '1-5' },
      ],
    })
    // Im Ergebnis der Stage steht für den Verlierer die Zeit der Wiederholung.
    state = fahre(fest(state, 'semi'), 'semi', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-5': [43, 43] })
    state = fahre(fest(state, 'final'), 'final', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-5': [43, 43] })
    expect(stage(state)[4]).toEqual(['1-4', 5, 127, 'rerun-pre-1', 120])
    // Dort trägt nur er ein Sternchen: Den Platz von 1-5 (4) hat das Finale bestimmt.
    expect([...stageDurchWiederholung(stageErgebnis(state, konfig, '1', PUNKTE)!)]).toEqual(['1-4'])
  })

  it('bleibt es auch in der Wiederholung gleich, folgt die nächste', () => {
    let state = fest(gleich(), 'rerun-pre-1')
    state = fahre(state, 'rerun-pre-1', { '1-4': [50, 52], '1-5': [52, 50] })
    expect(stand(state).naechste).toEqual({ runde: 'rerun-pre-2', paare: [{ a: '1-4', b: '1-5' }] })
    state = fahre(fest(state, 'rerun-pre-2'), 'rerun-pre-2', { '1-4': [50, 50], '1-5': [52, 50] })
    expect(plaetze(state, 'pre')).toMatchObject({ '1-4': 4, '1-5': 5 })
    expect(stand(state).runden.map((r) => r.runde)).toEqual(['pre', 'rerun-pre-1', 'rerun-pre-2'])
  })

  it('drei im Gleichstand um zwei Plätze: Wiederholung zu dritt, einer gegen den Dummy', () => {
    let state = fahre(uim(mk('1', 6)), 'pre', { ...VORLAUF6, '1-3': [43, 45], '1-4': [45, 43], '1-5': [43, 45] })
    expect(stand(state).naechste?.paare).toEqual([
      { a: '1-3', b: '1-4' },
      { a: '1-5', b: null },
    ])
    state = fahre(fest(state, 'rerun-pre-1'), 'rerun-pre-1', { '1-3': [50, 50], '1-4': [49, 49], '1-5': [51, 51] })
    expect(plaetze(state, 'pre')).toMatchObject({ '1-4': 3, '1-3': 4, '1-5': 5, '1-6': 6 })
  })

  it('ein Gleichstand, der nicht über die Grenze reicht, braucht keine Wiederholung', () => {
    const state = fahre(uim(mk('1', 6)), 'pre', { ...VORLAUF6, '1-2': [41, 43], '1-3': [43, 41] })
    expect(plaetze(state, 'pre')).toMatchObject({ '1-2': 2, '1-3': 2, '1-4': 4 })
    expect(stand(state).naechste?.runde).toBe('semi')
  })

  it('Disqualifikation in der Wiederholung zum Vorlauf: hinterer Platz der Gruppe mit dessen Punkten, dahinter ändert sich nichts (Entscheidung des Nutzers)', () => {
    expect(PARALLEL_ANNAHMEN.disqInWiederholungDesVorlaufs).toBe('heat')
    let state = fest(gleich(), 'rerun-pre-1')
    state = fahre(state, 'rerun-pre-1', { '1-4': [60, null], '1-5': [70, 70] })
    expect(plaetze(state, 'pre')).toEqual({ '1-1': 1, '1-2': 2, '1-3': 3, '1-5': 4, '1-4': 5, '1-6': 6 })
    expect(vermerke(state, 'pre')).toMatchObject({ '1-5': 'qualified', '1-4': 127, '1-6': 95 })
    // Im Ergebnis der Stage: Platz 5 mit dessen Punkten, als „Disq.“ ohne Zeit – nach dem Re-run zählt nur dessen Zeit.
    state = fahre(fest(state, 'semi'), 'semi', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-5': [43, 43] })
    state = fahre(fest(state, 'final'), 'final', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-5': [43, 43] })
    expect(stage(state)[4]).toEqual(['1-4', 5, 127, 'rerun-pre-1', 'disq'])
    expect(stage(state)[5]).toEqual(['1-6', 6, 95, 'pre', 110])
  })

  it('Halbfinale: Gleichstand an der Grenze 2/3 wird wiederholt, einer an 1/2 oder 3/4 nicht', () => {
    let state = fest(nachVorlauf(), 'semi')
    const ohne = fahre(state, 'semi', { '1-1': [40, 42], '1-2': [42, 40], '1-3': [45, 47], '1-4': [47, 45] })
    expect(plaetze(ohne, 'semi')).toEqual({ '1-1': 1, '1-2': 1, '1-3': 3, '1-4': 3 })
    expect(stand(ohne).naechste?.runde).toBe('final')
    state = fahre(state, 'semi', { '1-1': [39, 39], '1-2': [42, 40], '1-3': [40, 42], '1-4': [47, 45] })
    expect(plaetze(state, 'semi')).toEqual({ '1-1': 1, '1-2': 2, '1-3': 2, '1-4': 4 })
    // Solange die Wiederholung aussteht, steht bei den übrigen nicht, welches Finale sie fahren.
    expect(vermerke(state, 'semi')).toEqual({ '1-2': 'rerun', '1-3': 'rerun' })
    expect(stand(state).naechste).toEqual({ runde: 'rerun-semi-1', paare: [{ a: '1-2', b: '1-3' }] })
    state = fahre(fest(state, 'rerun-semi-1'), 'rerun-semi-1', { '1-2': [44, 44], '1-3': [43, 44] })
    expect(plaetze(state, 'semi')).toEqual({ '1-1': 1, '1-3': 2, '1-2': 3, '1-4': 4 })
    expect(stand(state).naechste?.paare).toEqual([
      { a: '1-2', b: '1-4', finale: 3 },
      { a: '1-1', b: '1-3', finale: 1 },
    ])
  })
})

describe('Festschreiben und Lösen im Reducer', () => {
  it('eine zweite Klasse kommt in denselben Plan, die Runde wird verzahnt wie der Vorlauf: klein/groß im Wechsel (19.11.2026)', () => {
    let state = fahre(uim([...mk('1', 4), ...mk('4', 4)]), 'pre', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] })
    state = fahre(state, 'pre', { '4-1': [40, 40], '4-2': [41, 41], '4-3': [42, 42], '4-4': [43, 43] })
    state = fest(state, 'semi', '4')
    state = fest(state, 'semi', '1')
    // Die Klassen in ihrer Folge im Vorlauf: Klasse 1 (klein) zuerst im Block, dann Klasse 4 (groß).
    expect(state.parallelPlaene.semi!.starts.map((s) => [s.klasse, s.block, s.boot, s.attempt])).toEqual([
      ['1', 0, 'klein', 1],
      ['4', 0, 'gross', 1],
      ['1', 0, 'klein', 2],
      ['4', 0, 'gross', 2],
      ['1', 1, 'klein', 1],
      ['4', 1, 'gross', 1],
      ['1', 1, 'klein', 2],
      ['4', 1, 'gross', 2],
    ])
    // Die Paare bleiben dieselben, im 2. Attempt mit getauschten Racecourses.
    expect(paare(state, 'semi', '1')).toEqual([{ a: '1-1', b: '1-2' }, { a: '1-3', b: '1-4' }])
    expect(paare(state, 'semi', '4')).toEqual([{ a: '4-1', b: '4-2' }, { a: '4-3', b: '4-4' }])
    // Listen der race officials gibt es damit auch für das Halbfinale: je Racecourse drei, klassenübergreifend.
    const boegen = parallelBoegen(state, konfig)
    expect(boegen.runden).toEqual(['pre', 'semi'])
    expect(boegen.boegen.filter((b) => b.runde?.runde === 'semi')).toHaveLength(6)
  })

  it('ist in der Runde schon etwas erfasst, kommt eine später festgeschriebene Klasse nur ans Ende', () => {
    let state = fahre(uim([...mk('1', 4), ...mk('4', 4)]), 'pre', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] })
    state = fahre(state, 'pre', { '4-1': [40, 40], '4-2': [41, 41], '4-3': [42, 42], '4-4': [43, 43] })
    state = fahre(fest(state, 'semi', '4'), 'semi', { '4-1': [40] }, 5000)
    const zuerst = state.parallelPlaene.semi!.starts
    state = fest(state, 'semi', '1')
    expect(state.parallelPlaene.semi!.starts.slice(0, 4)).toEqual(zuerst)
    expect(state.parallelPlaene.semi!.starts.map((s) => [s.klasse, s.block])).toEqual([
      ['4', 0],
      ['4', 0],
      ['4', 1],
      ['4', 1],
      ['1', 2],
      ['1', 2],
      ['1', 3],
      ['1', 3],
    ])
  })

  it('im Betrieb begonnen: die Runde wird nicht mehr neu geordnet', () => {
    let state = fahre(uim([...mk('1', 4), ...mk('4', 4)]), 'pre', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] })
    state = fahre(state, 'pre', { '4-1': [40, 40], '4-2': [41, 41], '4-3': [42, 42], '4-4': [43, 43] })
    state = reducer(fest(state, 'semi', '4'), { type: 'BETRIEB_BEGINNEN', bereich: 'parallel', punkt: 'runde:semi', zeit: 6000 })
    expect(state.betrieb.bereiche.parallel?.begonnen).toContain('runde:semi')
    state = fest(state, 'semi', '1')
    expect(state.parallelPlaene.semi!.starts.map((s) => s.klasse)).toEqual(['4', '4', '4', '4', '1', '1', '1', '1'])
  })

  it('„Alle Klassen weiter“: alle Klassen, die so weit sind, in einem Schritt; die übrigen bleiben', () => {
    let state = uim([...mk('1', 4), ...mk('4', 4), ...mk('2', 4)])
    state = fahre(state, 'pre', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] })
    state = fahre(state, 'pre', { '4-1': [40, 40], '4-2': [41, 41], '4-3': [42, 42], '4-4': [43, 43] })
    // Klasse 2 ist noch nicht fertig.
    state = fahre(state, 'pre', { '2-1': [40, 40] })
    const alle = alleWeiter(klassenStaende(state, konfig))
    expect(alle.weiter).toEqual([
      { klasse: '1', runde: 'semi' },
      { klasse: '4', runde: 'semi' },
    ])
    expect(alle.bleiben).toEqual([{ klasse: '2', runde: 'pre', grund: 'laeuft' }])
    // Die Action nennt auch Klasse 2 (veraltete Anzeige) – sie bleibt trotzdem.
    const next = reducer(state, { type: 'PARALLEL_RUNDEN_ALLE_FESTSCHREIBEN', schritte: [...alle.weiter, { klasse: '2', runde: 'semi' }], zeit: 7000 })
    expect(next.parallelPlaene.semi!.starts.map((s) => [s.klasse, s.boot])).toEqual([
      ['1', 'klein'],
      ['4', 'gross'],
      ['1', 'klein'],
      ['4', 'gross'],
      ['1', 'klein'],
      ['4', 'gross'],
      ['1', 'klein'],
      ['4', 'gross'],
    ])
    expect(beschreibe({ type: 'PARALLEL_RUNDEN_ALLE_FESTSCHREIBEN', schritte: alle.weiter, zeit: 7000 }, next)).toEqual({ art: 'rundenFestAlle', n: 2 })
    // Ein zweiter Klick ändert nichts – dieselbe Referenz.
    expect(reducer(next, { type: 'PARALLEL_RUNDEN_ALLE_FESTSCHREIBEN', schritte: alle.weiter, zeit: 8000 })).toBe(next)
  })

  it('das Abmelde-X einer schon festgeschriebenen Klasse hält die Runde nicht fest: die nächste wird trotzdem verzahnt (Korrektur 19.11.2026)', () => {
    let state = fahre(uim([...mk('1', 4), ...mk('4', 4)]), 'pre', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] })
    state = fahre(state, 'pre', { '4-1': [40, 40], '4-2': [41, 41], '4-3': [42, 42], '4-4': [43, 43] })
    state = reducer(state, { type: 'ABMELDEN_STARTER', id: '1-2' })
    state = fest(state, 'semi', '1')
    // Das X steht schon in der Runde – erfasst hat aber niemand etwas.
    expect(state.eingaben[attemptSchluessel('semi', 1)]['1-2']).toEqual({ [X]: 'X' })
    state = fest(state, 'semi', '4')
    expect(state.parallelPlaene.semi!.starts.map((s) => [s.klasse, s.block])).toEqual([
      ['1', 0],
      ['4', 0],
      ['1', 0],
      ['4', 0],
      ['1', 1],
      ['4', 1],
      ['1', 1],
      ['4', 1],
    ])
  })

  it('ein von Hand erfasstes X eines nicht Abgemeldeten hält die Runde dagegen fest', () => {
    let state = fahre(uim([...mk('1', 4), ...mk('4', 4)]), 'pre', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] })
    state = fahre(state, 'pre', { '4-1': [40, 40], '4-2': [41, 41], '4-3': [42, 42], '4-4': [43, 43] })
    state = fest(state, 'semi', '1')
    state = reducer(state, { type: 'SET_EINGABEN', zellen: [{ lauf: attemptSchluessel('semi', 1), starter: '1-2', feld: X, wert: 'X' }] })
    state = fest(state, 'semi', '4')
    expect(state.parallelPlaene.semi!.starts.map((s) => s.klasse)).toEqual(['1', '1', '1', '1', '4', '4', '4', '4'])
  })

  it('Lösen einer Klasse: die übrige rückt zusammen, als 2er-Blöcke ab Block 0', () => {
    let state = fahre(uim([...mk('1', 4), ...mk('4', 4)]), 'pre', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] })
    state = fahre(state, 'pre', { '4-1': [40, 40], '4-2': [41, 41], '4-3': [42, 42], '4-4': [43, 43] })
    state = reducer(state, { type: 'PARALLEL_RUNDEN_ALLE_FESTSCHREIBEN', schritte: alleWeiter(klassenStaende(state, konfig)).weiter })
    const geloest = reducer(state, { type: 'PARALLEL_RUNDE_LOESEN', klasse: '1', runde: 'semi' })
    expect(geloest.parallelPlaene.semi!.starts.map((s) => [s.klasse, s.block, s.attempt])).toEqual([
      ['4', 0, 1],
      ['4', 0, 2],
      ['4', 1, 1],
      ['4', 1, 2],
    ])
  })

  it('„Alle Klassen weiter“: eine Klasse mit veraltetem Plan bleibt, auch wenn die Action sie nennt', () => {
    let state = uim([...mk('1', 6), ...mk('4', 4)])
    state = fahre(state, 'pre', { ...VORLAUF6, '4-1': [40, 40], '4-2': [41, 41], '4-3': [42, 42], '4-4': [43, 43] })
    state = fest(state, 'semi', '1')
    // Protest im Vorlauf: Der Plan des Halbfinales von Klasse 1 ist veraltet.
    state = fahre(state, 'pre', { '1-4': [43, null] })
    const alle = alleWeiter(klassenStaende(state, konfig))
    expect(alle.weiter).toEqual([{ klasse: '4', runde: 'semi' }])
    expect(alle.bleiben).toEqual([{ klasse: '1', runde: 'semi', grund: 'veraltet' }])
    const plan1 = klassenPaare(state.parallelPlaene.semi, '1')
    const next = reducer(state, { type: 'PARALLEL_RUNDEN_ALLE_FESTSCHREIBEN', schritte: [...alle.weiter, { klasse: '1', runde: 'semi' }, { klasse: '1', runde: 'final' }] })
    expect(klassenPaare(next.parallelPlaene.semi, '1')).toEqual(plan1)
    expect(next.parallelPlaene.final).toBeUndefined()
    expect(klassenPaare(next.parallelPlaene.semi, '4')).toHaveLength(2)
  })

  it('„Alle Klassen weiter“ unter DM: nichts (Parallelslalom nur unter UIM)', () => {
    const dm = reducer({ ...emptyState(), eventName: 'Musterpokal' }, { type: 'ADD_STARTERS', starters: [...mk('1', 4), ...mk('4', 4)] })
    expect(reducer(dm, { type: 'PARALLEL_RUNDEN_ALLE_FESTSCHREIBEN', schritte: [{ klasse: '1', runde: 'semi' }] })).toBe(dm)
  })

  it('„Alle Klassen weiter“: ein Gleichstand an der Grenze bleibt – die Wiederholung je Klasse', () => {
    let state = uim([...mk('1', 6), ...mk('4', 4)])
    state = fahre(state, 'pre', { ...VORLAUF6, '1-4': [43, 43], '1-5': [43, 43] })
    state = fahre(state, 'pre', { '4-1': [40, 40], '4-2': [41, 41], '4-3': [42, 42], '4-4': [43, 43] })
    const alle = alleWeiter(klassenStaende(state, konfig))
    expect(alle.weiter).toEqual([{ klasse: '4', runde: 'semi' }])
    expect(alle.bleiben).toEqual([{ klasse: '1', runde: 'rerun-pre-1', grund: 'rerun' }])
  })

  it('Finals nach dem Halbfinale für alle Klassen zugleich, verzahnt; um Platz 3 und 4 zuerst', () => {
    let state = fahre(uim([...mk('1', 4), ...mk('4', 4)]), 'pre', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] })
    state = fahre(state, 'pre', { '4-1': [40, 40], '4-2': [41, 41], '4-3': [42, 42], '4-4': [43, 43] })
    const alleFest = (s: AppState) => reducer(s, { type: 'PARALLEL_RUNDEN_ALLE_FESTSCHREIBEN', schritte: alleWeiter(klassenStaende(s, konfig)).weiter, zeit: 9000 })
    state = alleFest(state)
    state = fahre(state, 'semi', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43], '4-1': [40, 40], '4-2': [41, 41], '4-3': [42, 42], '4-4': [43, 43] }, 10000)
    state = alleFest(state)
    expect(state.parallelPlaene.final!.starts.map((s) => [s.klasse, s.finale, s.block])).toEqual([
      ['1', 3, 0],
      ['4', 3, 0],
      ['1', 3, 0],
      ['4', 3, 0],
      ['1', 1, 1],
      ['4', 1, 1],
      ['1', 1, 1],
      ['4', 1, 1],
    ])
  })

  it('Lösen nimmt die Starts der Klasse und ihre Werte der Runde; die andere Klasse bleibt', () => {
    let state = fahre(uim([...mk('1', 4), ...mk('4', 4)]), 'pre', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] })
    state = fahre(state, 'pre', { '4-1': [40, 40], '4-2': [41, 41], '4-3': [42, 42], '4-4': [43, 43] })
    state = fest(fest(state, 'semi', '4'), 'semi', '1')
    state = fahre(state, 'semi', { '4-1': [40, 40], '1-1': [41, 41] }, 5000)
    expect(stand(state, '4').loesbar).toEqual(['semi'])
    const geloest = reducer(state, { type: 'PARALLEL_RUNDE_LOESEN', klasse: '4', runde: 'semi', zeit: 6000 })
    expect(geloest.parallelPlaene.semi!.starts.every((s) => s.klasse === '1')).toBe(true)
    expect(Object.keys(geloest.eingaben[attemptSchluessel('semi', 1)])).toEqual(['1-1'])
    expect(rundenErgebnis(geloest, konfig, '4', 'semi')).toBeNull()
    expect(stand(geloest, '4').naechste?.runde).toBe('semi')
    // Die Werte des Vorlaufs bleiben.
    expect(geloest.eingaben[attemptSchluessel('pre', 1)]['4-1']).toEqual(state.eingaben[attemptSchluessel('pre', 1)]['4-1'])
    // Die letzte Klasse gelöst: Der Plan der Runde entfällt.
    expect(reducer(geloest, { type: 'PARALLEL_RUNDE_LOESEN', klasse: '1', runde: 'semi' }).parallelPlaene.semi).toBeUndefined()
  })

  it('gelöst wird nur die letzte Runde der Klasse – nie der Vorlauf, nie eine Runde, auf der eine spätere steht', () => {
    let state = fest(nachVorlauf(), 'semi')
    state = fahre(state, 'semi', { '1-1': [40, 40], '1-2': [39, 40], '1-3': [45, 45], '1-4': [44, 45] })
    state = fest(state, 'final')
    expect(stand(state).loesbar).toEqual(['final'])
    expect(reducer(state, { type: 'PARALLEL_RUNDE_LOESEN', klasse: '1', runde: 'semi' })).toBe(state)
    expect(reducer(state, { type: 'PARALLEL_RUNDE_LOESEN', klasse: '1', runde: 'pre' })).toBe(state)
    expect(reducer(state, { type: 'PARALLEL_RUNDE_LOESEN', klasse: '2', runde: 'final' })).toBe(state)
    const ohneFinale = reducer(state, { type: 'PARALLEL_RUNDE_LOESEN', klasse: '1', runde: 'final' })
    expect(stand(ohneFinale).loesbar).toEqual(['semi'])
  })

  it('ändert ein Protest das Ergebnis davor, bleibt der Plan, wie er ist, und gilt als veraltet', () => {
    let state = fest(nachVorlauf(), 'semi')
    const plan = state.parallelPlaene.semi
    // 1-4 wird im Vorlauf nachträglich disqualifiziert: Jetzt wäre 1-5 unter den besten vier.
    state = fahre(state, 'pre', { '1-4': [43, null] })
    expect(state.parallelPlaene.semi).toBe(plan)
    expect(stand(state).runden.map((r) => [r.runde, r.veraltet])).toEqual([
      ['pre', false],
      ['semi', true],
    ])
    // Lösen und neu festschreiben setzt die Paare neu.
    state = fest(reducer(state, { type: 'PARALLEL_RUNDE_LOESEN', klasse: '1', runde: 'semi' }), 'semi')
    expect(paare(state, 'semi')).toEqual([
      { a: '1-1', b: '1-2' },
      { a: '1-3', b: '1-5' },
    ])
    expect(stand(state).runden.some((r) => r.veraltet)).toBe(false)
  })

  it('solange ein Plan veraltet ist, gibt es kein Ergebnis der Stage – die Klasse steht als offen da, mit der Runde', () => {
    // Alle Runden gefahren: Die Stage ist fertig.
    let state = fest(nachVorlauf(), 'semi')
    state = fest(fahre(state, 'semi', { '1-1': [40, 40], '1-2': [39, 40], '1-3': [45, 45], '1-4': [44, 45] }), 'final')
    const fertig = fahre(state, 'final', { '1-1': [41, 41], '1-2': [40, 43], '1-3': [30, 30], '1-4': [44, 45] })
    expect(stand(fertig)).toMatchObject({ fertig: true, veraltet: undefined })
    // Protest im Vorlauf: 1-4 fällt hinter 1-5. Sonst stünden 1-4 (aus dem alten Finale) und
    // 1-5 (aus dem Vorlauf) beide auf Platz 4 mit 169 Punkten.
    const vorlauf = fahre(fertig, 'pre', { '1-4': [70, 70] })
    expect(stand(vorlauf)).toMatchObject({ fertig: false, veraltet: 'semi' })
    expect(stageErgebnis(vorlauf, konfig, '1', PUNKTE)).toBeNull()
    expect(stageBlaetter(vorlauf, konfig, ['1'], PUNKTE)).toEqual([])
    expect(offeneKlassen(vorlauf, konfig)).toEqual([{ klasse: '1', runde: 'semi', festschreiben: false, veraltet: true }])
    // Protest im Halbfinale: 1-1 ist dort nur noch Vierter und gehört nicht mehr ins Finale um Platz 1 und 2.
    const halbfinale = fahre(fertig, 'semi', { '1-1': [60, 60] })
    expect(stand(halbfinale)).toMatchObject({ fertig: false, veraltet: 'final' })
    expect(stageErgebnis(halbfinale, konfig, '1', PUNKTE)).toBeNull()
    expect(offeneKlassen(halbfinale, konfig)).toEqual([{ klasse: '1', runde: 'final', festschreiben: false, veraltet: true }])
    // Lösen und neu festschreiben: Die Klasse hängt wieder an einer gewöhnlichen offenen Runde.
    const neu = fest(reducer(halbfinale, { type: 'PARALLEL_RUNDE_LOESEN', klasse: '1', runde: 'final' }), 'final')
    expect(offeneKlassen(neu, konfig)).toEqual([{ klasse: '1', runde: 'final', festschreiben: false, veraltet: false }])
  })

  it('entfällt der Plan des Vorlaufs bei offener Verzahnung, gehen die Werte der Runden danach mit', () => {
    let state = fest(nachVorlauf(), 'semi')
    state = fahre(state, 'semi', { '1-1': [40, 40], '1-2': [39, 40], '1-3': [45, 45], '1-4': [44, 45] }, 1)
    state = reducer(state, { type: 'SET_VERZAHNUNG_LOCK', locked: false })
    // Gebunden an die Werte des Vorlaufs: Der Plan bleibt.
    expect(Object.keys(state.parallelPlaene).sort()).toEqual(['pre', 'semi'])
    // Die Werte des Vorlaufs zellenweise gelöscht: Der Plan bleibt – er entfällt nur über „Werte löschen“.
    const leeren = Object.keys(VORLAUF6).flatMap((id) => [1, 2].map((n) => ({ lauf: attemptSchluessel('pre', n), starter: id, feld: 'zeit1', wert: '' })))
    state = reducer(state, { type: 'SET_EINGABEN', zellen: leeren })
    expect(Object.keys(state.parallelPlaene).sort()).toEqual(['pre', 'semi'])
    // „Werte löschen“: Der Plan entfällt – und die Werte des Halbfinales.
    state = reducer(state, { type: 'CLEAR_EINGABEN' })
    expect(state.parallelPlaene).toEqual({})
    expect(Object.keys(state.eingaben).filter((k) => k.startsWith('parallel:'))).toEqual([])
    // Neu festgeschrieben und anders gefahren: Das Halbfinale beginnt leer.
    state = reducer(state, { type: 'SET_VERZAHNUNG_LOCK', locked: true })
    state = fest(fahre(state, 'pre', { '1-1': [60, 60], '1-2': [61, 61], '1-3': [42, 42], '1-4': [43, 43], '1-5': [50, 50], '1-6': [55, 55] }), 'semi')
    expect(stand(state).runden.map((r) => [r.runde, r.zustand])).toEqual([
      ['pre', 'fertig'],
      ['semi', 'leer'],
    ])
  })

  it('ein von Hand entferntes Abmelde-X kommt nicht zurück, wenn eine andere Klasse dieselbe Runde festschreibt', () => {
    const V3 = { '3-1': [40, 40], '3-2': [41, 41], '3-3': [42, 42], '3-4': [43, 43], '3-5': [50, 50] }
    let state = fahre(uim([...mk('1', 6), ...mk('3', 5)]), 'pre', { ...VORLAUF6, ...V3 })
    state = reducer(state, { type: 'ABMELDEN_STARTER', id: '1-2' })
    state = reducer(state, { type: 'ABMELDEN_STARTER', id: '3-1' })
    state = fest(state, 'semi', '1')
    const zeile = (n: number, id = '1-2') => state.eingaben[attemptSchluessel('semi', n)]?.[id]
    expect([zeile(1), zeile(2)]).toEqual([{ [X]: 'X' }, { [X]: 'X' }])
    // Er fährt doch: das X von Hand entfernt.
    state = reducer(state, { type: 'SET_EINGABEN', zellen: [1, 2].map((n) => ({ lauf: attemptSchluessel('semi', n), starter: '1-2', feld: X, wert: '' })) })
    expect([zeile(1), zeile(2)]).toEqual([undefined, undefined])
    state = fest(state, 'semi', '3')
    expect([zeile(1), zeile(2)]).toEqual([undefined, undefined])
    // Der Abgemeldete der Klasse, die festgeschrieben wird, bekommt sein X.
    expect([zeile(1, '3-1'), zeile(2, '3-1')]).toEqual([{ [X]: 'X' }, { [X]: 'X' }])
  })

  it('eine Wiederholung, deren Gleichstand ein Protest aufgehoben hat, bleibt sichtbar und lässt sich lösen', () => {
    let state = fahre(uim(mk('1', 6)), 'pre', { ...VORLAUF6, '1-4': [43, 45], '1-5': [45, 43] })
    state = fest(state, 'rerun-pre-1')
    state = fahre(state, 'pre', { '1-5': [45, 44] })
    expect(stand(state).naechste?.runde).toBe('semi')
    expect(stand(state).runden.map((r) => [r.runde, r.veraltet])).toEqual([
      ['pre', false],
      ['rerun-pre-1', true],
    ])
    expect(stand(state).loesbar).toEqual(['rerun-pre-1'])
  })

  it('„Alle erfassten Werte löschen“ nimmt die Runden nach dem Vorlauf mit; dessen Plan hängt an der Verzahnung', () => {
    const state = fest(nachVorlauf(), 'semi')
    const leer = reducer(state, { type: 'CLEAR_EINGABEN' })
    expect(Object.keys(leer.parallelPlaene)).toEqual(['pre'])
    expect(leer.parallelPlaene.pre).toBe(state.parallelPlaene.pre)
  })

  it('unter der DM gibt es die Runden nicht', () => {
    let state = reducer(emptyState(), { type: 'ADD_STARTERS', starters: mk('1', 6) })
    state = reducer(state, { type: 'SET_VERZAHNUNG_LOCK', locked: true })
    expect(klassenStand(state, configFor({ regelwerk: 'dm-2026' }), '1')).toBeNull()
    expect(fest(state, 'semi')).toBe(state)
  })

  it('der Verlauf nennt Runde und Klasse', () => {
    expect(beschreibe({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'semi' }, { starters: [] })).toEqual({ art: 'rundeFest', klasse: '1', runde: 'semi' })
    expect(beschreibe({ type: 'PARALLEL_RUNDE_LOESEN', klasse: '1', runde: 'rerun-pre-1' }, { starters: [] })).toEqual({ art: 'rundeGeloest', klasse: '1', runde: 'rerun-pre-1' })
  })

  it('Zeitstempel je Runde: Eine Eingabe im Halbfinale setzt dessen Listen, nicht die des Vorlaufs', () => {
    let state = fahre(uim(mk('1', 6)), 'pre', VORLAUF6, 1000)
    state = reducer(state, { type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'semi', zeit: 2000 })
    state = fahre(state, 'semi', { '1-1': [40, 40] }, 3000)
    expect(Date.parse(gesamtZeit(state.listenStand, rundenDisziplin('pre'), '1'))).toBe(1000)
    expect(Date.parse(gesamtZeit(state.listenStand, rundenDisziplin('semi'), '1'))).toBe(3000)
    // Eine Wiederholung ändert die Plätze des Vorlaufs – dessen Liste bekommt den neuen Zeitpunkt.
    let re = fahre(uim(mk('1', 6)), 'pre', { ...VORLAUF6, '1-4': [43, 45], '1-5': [45, 43] }, 1000)
    re = reducer(re, { type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'rerun-pre-1', zeit: 2000 })
    re = fahre(re, 'rerun-pre-1', { '1-4': [60, 60], '1-5': [50, 59] }, 4000)
    expect(Date.parse(gesamtZeit(re.listenStand, rundenDisziplin('pre'), '1'))).toBe(4000)
  })

  it('Beispielwerte einer Runde füllen nur leere Attempts und lassen das Manövrieren, wie es ist', () => {
    let state = fest(nachVorlauf(), 'semi')
    state = fahre(state, 'semi', { '1-1': [40, 40] })
    const vorher = state.eingaben
    state = reducer(state, { type: 'FILL_BEISPIELWERTE', zeitnahme: 'stoppuhr', saat: 7, runden: ['semi'], nurRunden: true, nurLeere: true })
    expect(state.eingaben[attemptSchluessel('semi', 1)]['1-1']).toEqual(vorher[attemptSchluessel('semi', 1)]['1-1'])
    expect(Object.keys(state.eingaben[attemptSchluessel('semi', 2)]).sort()).toEqual(['1-1', '1-2', '1-3', '1-4'])
    expect(state.eingaben[attemptSchluessel('pre', 1)]).toBe(vorher[attemptSchluessel('pre', 1)])
    expect(Object.keys(state.eingaben).some((k) => k.startsWith('manoevrieren'))).toBe(false)
    expect(ergebnis(state, 'semi').vollstaendig).toBe(true)
  })
})

describe('Abmelden: X „Nicht gestartet“ auch im Parallelslalom', () => {
  it('ein abgemeldeter Starter bekommt das X in beiden Attempts des Vorlaufs – nur in leere Felder', () => {
    let state = fahre(uim(mk('1', 4)), 'pre', { '1-1': [40, 40], '1-2': [41] })
    expect(abmeldeAttempts(state, konfig, { id: '1-3', klasse: '1' })).toEqual([
      { runde: 'pre', attempt: 1 },
      { runde: 'pre', attempt: 2 },
    ])
    state = reducer(state, { type: 'ABMELDEN_STARTER', id: '1-3' })
    expect(state.eingaben[attemptSchluessel('pre', 1)]['1-3']).toEqual({ [X]: 'X' })
    expect(state.eingaben[attemptSchluessel('pre', 2)]['1-3']).toEqual({ [X]: 'X' })
    // 1-2 ist den 1. Attempt gefahren: Dort bleibt alles, das X kommt nur in den 2.
    state = reducer(state, { type: 'ABMELDEN_STARTER', id: '1-2' })
    expect(state.eingaben[attemptSchluessel('pre', 1)]['1-2']).toEqual({ zeit1: '41,00' })
    expect(state.eingaben[attemptSchluessel('pre', 2)]['1-2']).toEqual({ [X]: 'X' })
    // Gewertet wie eine Disqualifikation: für die Stage disqualifiziert.
    state = fahre(state, 'pre', { '1-4': [45, 45] })
    expect(plaetze(state, 'pre')).toEqual({ '1-1': 1, '1-4': 2, '1-2': 3, '1-3': 3 })
    // Zurückgenommen: Das X geht, wo sonst nichts steht.
    state = reducer(state, { type: 'ANMELDEN_STARTER', id: '1-3' })
    expect(state.eingaben[attemptSchluessel('pre', 1)]['1-3']).toBeUndefined()
    expect(state.eingaben[attemptSchluessel('pre', 2)]['1-3']).toBeUndefined()
  })

  it('wird der Plan des Vorlaufs erst nach dem Abmelden festgeschrieben, kommt das X dann', () => {
    let state = reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    state = reducer(state, { type: 'ADD_STARTERS', starters: mk('1', 4) })
    state = reducer(state, { type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: '1-1', feld: 'zeit1', wert: '60,00' }] })
    state = reducer(state, { type: 'ABMELDEN_STARTER', id: '1-3' })
    expect(state.eingaben[attemptSchluessel('pre', 1)]).toBeUndefined()
    state = reducer(state, { type: 'SET_VERZAHNUNG_LOCK', locked: true })
    expect(state.eingaben[attemptSchluessel('pre', 1)]['1-3']).toEqual({ [X]: 'X' })
    expect(state.eingaben[attemptSchluessel('pre', 2)]['1-3']).toEqual({ [X]: 'X' })
  })

  it('wer nach dem Vorlauf abgemeldet wird, bekommt das X im festgeschriebenen Halbfinale – und steht dort auf Platz 4', () => {
    let state = fest(nachVorlauf(), 'semi')
    state = reducer(state, { type: 'ABMELDEN_STARTER', id: '1-2' })
    expect(state.eingaben[attemptSchluessel('pre', 1)]['1-2']).toEqual({ zeit1: '41,00' })
    expect(state.eingaben[attemptSchluessel('semi', 1)]['1-2']).toEqual({ [X]: 'X' })
    state = fahre(state, 'semi', { '1-1': [40, 40], '1-3': [45, 45], '1-4': [44, 45] })
    expect(plaetze(state, 'semi')).toMatchObject({ '1-2': 4 })
  })
})

describe('Namen und Folge der Runden, gelesene Pläne', () => {
  const t = (key: string, params?: Record<string, string | number>) => `${key}${params ? JSON.stringify(params) : ''}`
  it('eine Wiederholung nennt ihre Runde und ab der zweiten ihre Nummer', () => {
    expect(rundenName('semi', t)).toBe('parallel.round.semi')
    expect(rundenName('rerun-pre-1', t)).toBe('parallel.round.rerunOf{"round":"parallel.round.pre"}')
    expect(rundenName('rerun-semi-2', t)).toBe('parallel.round.rerunOfN{"round":"parallel.round.semi","n":2}')
    expect(zerlegeRerun('rerun-final-1')).toBeUndefined()
  })

  it('die Runden stehen in der Folge, in der sie gefahren werden', () => {
    const runden: ParallelRunde[] = ['final', 'rerun-semi-1', 'semi', 'rerun-pre-2', 'pre', 'rerun-pre-1']
    expect(runden.sort(vergleicheRunden)).toEqual(['pre', 'rerun-pre-1', 'rerun-pre-2', 'semi', 'rerun-semi-1', 'final'])
  })

  it('Klasse und Finale eines Starts überstehen Speichern und Laden; Unbrauchbares entfällt', () => {
    const state = fest(nachVorlauf(), 'semi')
    expect(normalisierePlaene(JSON.parse(JSON.stringify(state.parallelPlaene)))).toEqual(state.parallelPlaene)
    const roh = { final: { starts: [{ a: 'x', b: 'y', attempt: 1, block: 0, boot: 'klein', klasse: '9', finale: 2 }] } }
    expect(normalisierePlaene(roh).final!.starts[0]).toEqual({ a: 'x', b: 'y', attempt: 1, block: 0, boot: 'klein' })
  })
})
