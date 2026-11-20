import { describe, expect, it } from 'vitest'
import { emptyState, reducer, rundenNeuGeordnet } from './reducer'
import { migrate } from './migrate'
import { makeFile, parseFile } from '../persistenz/backup'
import { attemptSchluessel } from '../lib/parallelSchluessel'
import { beschreibe } from '../lib/verlauf'
import type { AppState, ClassId, ParallelRunde, Starter } from '../types'

// Gedruckte Runden des Parallelslaloms (Antwort des Nutzers vom 20.11.2026): Sie gelten als
// gebunden, bis „Druck lösen“. Erfundene Starter.

function mk(klasse: ClassId, n: number): Starter[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${klasse}-${i + 1}`,
    startNr: klasse + String(i + 1).padStart(2, '0'),
    vorname: 'Vor',
    nachname: `Nach${klasse}${i + 1}`,
    verein: 'Musterclub',
    bundesland: '',
    geburtsdatum: '2015-01-01',
    groesse: '',
    klasse,
  }))
}

/** UIM, Klassen 1 (kleines Boot) und 4 (großes), Vorlauf gefahren, Halbfinale für Klasse 4 festgeschrieben. */
function halbfinaleKlasse4(): AppState {
  let s = reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
  s = reducer(s, { type: 'ADD_STARTERS', starters: [...mk('1', 4), ...mk('4', 4)] })
  s = reducer(s, { type: 'SET_VERZAHNUNG_LOCK', locked: true })
  const zeiten: Record<string, number> = { '1-1': 40, '1-2': 41, '1-3': 42, '1-4': 43, '4-1': 40, '4-2': 41, '4-3': 42, '4-4': 43 }
  const zellen = Object.entries(zeiten).flatMap(([starter, sek]) => [1, 2].map((a) => ({ lauf: attemptSchluessel('pre', a), starter, feld: 'zeit1', wert: `${sek},00` })))
  s = reducer(s, { type: 'SET_EINGABEN', zellen, zeit: 1000 })
  return reducer(s, { type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '4', runde: 'semi' })
}
const klassen = (s: AppState, runde: ParallelRunde = 'semi') => s.parallelPlaene[runde]!.starts.map((x) => x.klasse)
const gedruckt = (s: AppState) => reducer(s, { type: 'PARALLEL_RUNDEN_GEDRUCKT', runden: ['pre', 'semi', 'final'], zeit: 5000 })

describe('gedruckte Runden (20.11.2026)', () => {
  it('vermerkt nur Runden nach dem Vorlauf mit Plan, mit dem Zeitpunkt des ersten Drucks', () => {
    const s = gedruckt(halbfinaleKlasse4())
    expect(s.parallelGedruckt).toEqual({ semi: 5000 })
    // Noch einmal gedruckt: derselbe Stand, der erste Zeitpunkt bleibt.
    expect(reducer(s, { type: 'PARALLEL_RUNDEN_GEDRUCKT', runden: ['semi'], zeit: 9000 })).toBe(s)
  })

  it('eine gedruckte Runde ordnet eine später festgeschriebene Klasse nicht neu – sie kommt ans Ende, ohne Rückfrage', () => {
    const s = gedruckt(halbfinaleKlasse4())
    expect(rundenNeuGeordnet(s, [{ klasse: '1', runde: 'semi' }])).toEqual([])
    const danach = reducer(s, { type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'semi' })
    expect(klassen(danach)).toEqual(['4', '4', '4', '4', '1', '1', '1', '1'])
    // Ungedruckt wäre verzahnt worden (klein/groß im Wechsel).
    const ohneDruck = reducer(halbfinaleKlasse4(), { type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'semi' })
    expect(klassen(ohneDruck)).toEqual(['1', '4', '1', '4', '1', '4', '1', '4'])
  })

  it('„Druck lösen“ hebt die Bindung auf: danach wird wieder neu geordnet (nach Rückfrage der Oberfläche)', () => {
    const s = gedruckt(halbfinaleKlasse4())
    const geloest = reducer(s, { type: 'PARALLEL_DRUCK_LOESEN', runde: 'semi' })
    expect(geloest.parallelGedruckt).toEqual({})
    expect(reducer(geloest, { type: 'PARALLEL_DRUCK_LOESEN', runde: 'semi' })).toBe(geloest)
    expect(rundenNeuGeordnet(geloest, [{ klasse: '1', runde: 'semi' }])).toEqual(['semi'])
    expect(klassen(reducer(geloest, { type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'semi' }))).toEqual(['1', '4', '1', '4', '1', '4', '1', '4'])
    expect(beschreibe({ type: 'PARALLEL_DRUCK_LOESEN', runde: 'semi' }, { starters: [] })).toEqual({ art: 'druckGeloest', runde: 'semi' })
    expect(beschreibe({ type: 'PARALLEL_RUNDEN_GEDRUCKT', runden: ['semi'] }, { starters: [] })).toBeNull()
  })

  it('erfasste Werte binden auch nach dem Lösen weiter', () => {
    let s = gedruckt(halbfinaleKlasse4())
    s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: attemptSchluessel('semi', 1), starter: '4-1', feld: 'zeit1', wert: '40,00' }], zeit: 6000 })
    s = reducer(s, { type: 'PARALLEL_DRUCK_LOESEN', runde: 'semi' })
    expect(klassen(reducer(s, { type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'semi' }))).toEqual(['4', '4', '4', '4', '1', '1', '1', '1'])
  })

  it('ohne Plan fällt der Vermerk weg: ein neu festgeschriebener Plan derselben Runde ist nicht gedruckt', () => {
    const s = gedruckt(halbfinaleKlasse4())
    const geloescht = reducer(s, { type: 'PARALLEL_RUNDE_LOESEN', klasse: '4', runde: 'semi' })
    expect(geloescht.parallelPlaene.semi).toBeUndefined()
    expect(geloescht.parallelGedruckt).toEqual({})
  })

  it('nur unter UIM', () => {
    const dm = reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk: 'dm-2026' })
    expect(reducer(dm, { type: 'PARALLEL_RUNDEN_GEDRUCKT', runden: ['semi'], zeit: 1 })).toBe(dm)
  })

  it('migrate prüft den Vermerk; die Sicherung trägt ihn, eine Vorlage nicht (er hängt an den Plänen)', () => {
    const s = gedruckt(halbfinaleKlasse4())
    const roh = { ...s, parallelGedruckt: { semi: 5000, final: 7000, pre: 1, 'rerun-pre-1': 'x', quatsch: 3 } }
    expect(migrate(JSON.parse(JSON.stringify(roh)))!.parallelGedruckt).toEqual({ semi: 5000 })
    expect(migrate(JSON.parse(JSON.stringify({ ...s, parallelGedruckt: undefined })))!.parallelGedruckt).toEqual({})

    const sicherung = parseFile(JSON.stringify(makeFile('sicherung', s, '2026-11-20T10:00:00.000Z')))
    if (!sicherung.ok || sicherung.kind !== 'sicherung') throw new Error('keine Sicherung')
    expect(sicherung.state.parallelGedruckt).toEqual({ semi: 5000 })

    const vorlage = parseFile(JSON.stringify(makeFile('vorlage', s, '2026-11-20T10:00:00.000Z')))
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    expect(vorlage.apply(halbfinaleKlasse4()).parallelGedruckt).toEqual({})
    expect(vorlage.apply(s).parallelGedruckt).toEqual({ semi: 5000 })
  })
})
