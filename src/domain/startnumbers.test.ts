import { describe, it, expect } from 'vitest'
import {
  duplicateStartNrIds,
  makeStartNr,
  moveInOrder,
  orderBySize,
  parseClassNumber,
  redistributeNumbers,
  renumberSequential,
  sortedByStartNr,
  vergleicheStartNr,
} from './startnumbers'
import { startNrPraefixe } from '../config/catalog'
import { cmpStartNr } from '../planung/parallel'
import { paareNachNummer } from '../planung/parallelRunden'
import { emptyState, reducer } from '../state/reducer'
import type { ClassId, Starter } from '../types'

function mk(klasse: ClassId, nr: number, groesse = ''): Starter {
  return {
    id: `${klasse}-${nr}`,
    startNr: makeStartNr(klasse, nr),
    vorname: 'V',
    nachname: 'N' + nr,
    verein: 'C',
    bundesland: 'B',
    geburtsdatum: '2015-01-01',
    klasse,
    groesse,
  }
}

describe('Präfix der klassenbezogenen Startnummern aus dem Regelwerk', () => {
  it('ohne Angabe steht die Kennung der Klasse davor', () => {
    expect(makeStartNr('E', 1)).toBe('E01')
    expect(makeStartNr('3', 12)).toBe('312')
    expect(makeStartNr('E', 1, {})).toBe('E01')
  })

  it('eine Angabe im Regelwerk stellt den Buchstaben um – ohne Programmänderung', () => {
    expect(makeStartNr('E', 1, { E: 'D' })).toBe('D01')
    expect(makeStartNr('1', 1, { E: 'D' })).toBe('101')
    expect(parseClassNumber('D07', 'E', { E: 'D' })).toBe(7)
    // Die schon vergebenen E-Nummern zählen weiter mit: Nach dem Umstellen geht die Zählung bei ihnen weiter (kein D01 neben E01).
    expect(parseClassNumber('E07', 'E', { E: 'D' })).toBe(7)
    expect(parseClassNumber('D07', 'E')).toBe(7)
    expect(parseClassNumber('D07', '1')).toBeNull()
    expect(renumberSequential([mk('E', 5), mk('E', 9)], { E: 'D' }).map((p) => p.startNr)).toEqual(['D01', 'D02'])
  })
})

describe('Nummern mit Präfix sortieren wie mit einer 0 davor – vor den übrigen (Entscheidung des Nutzers)', () => {
  it('E01 und D01 stehen vor 101, 201 …; innerhalb der Klasse numerisch', () => {
    expect(['201', 'E10', '101', 'E02', 'D01', '7'].sort(vergleicheStartNr)).toEqual(['D01', 'E02', '7', 'E10', '101', '201'])
    expect(['E2', 'E10', 'E1'].sort(vergleicheStartNr)).toEqual(['E1', 'E2', 'E10'])
    // Gleicher Wert (E01 und 1): feste Reihenfolge, damit keine Liste springt.
    expect(Math.sign(vergleicheStartNr('E01', '1'))).toBe(-Math.sign(vergleicheStartNr('1', 'E01')))
  })

  it('überall dieselbe Reihenfolge: Parallelslalom (Paare nach Nummer) und Listen', () => {
    const p = (klasse: ClassId, startNr: string): Starter => ({ ...mk(klasse, 1), id: startNr, startNr })
    const feld = [p('1', '101'), p('E', 'E02'), p('E', 'D01'), p('1', '102')]
    expect([...feld].sort(cmpStartNr).map((s) => s.startNr)).toEqual(['D01', 'E02', '101', '102'])
    expect(paareNachNummer(feld)).toEqual([
      { a: 'D01', b: 'E02' },
      { a: '101', b: '102' },
    ])
    expect(sortedByStartNr(feld).map((s) => s.startNr)).toEqual(['D01', 'E02', '101', '102'])
  })

  it('der Buchstabe der Dolphin-Nummern ist wählbar (E oder D) – nur unter einem Regelwerk mit „Dolphin“', () => {
    let state = reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    expect([state.dolphinPraefix, startNrPraefixe(state).E]).toEqual(['E', 'E'])
    state = reducer(state, { type: 'ADD_STARTERS', starters: [mk('E', 1), mk('E', 2), mk('1', 1)] })
    state = reducer(state, { type: 'SET_DOLPHIN_PRAEFIX', praefix: 'D' })
    expect(startNrPraefixe(state).E).toBe('D')
    // Vorhandene Nummern bleiben, bis sie neu vergeben werden.
    expect(state.starters.map((s) => s.startNr)).toEqual(['E01', 'E02', '101'])
    state = reducer(state, { type: 'ASSIGN_START_NUMBERS' })
    expect(state.starters.map((s) => s.startNr)).toEqual(['D01', 'D02', '101'])
    // Unter der DM heißt die Klasse E: Dort bleibt es bei E, gleich was gewählt ist.
    expect(startNrPraefixe({ regelwerk: 'dm-2026', dolphinPraefix: 'D' }).E).toBe('E')
  })
})

describe('startnumbers', () => {
  it('baut und liest klassenbasierte Nummern', () => {
    expect(makeStartNr('E', 3)).toBe('E03')
    expect(makeStartNr('7', 12)).toBe('712')
    expect(parseClassNumber('E03', 'E')).toBe(3)
    expect(parseClassNumber('712', '7')).toBe(12)
    expect(parseClassNumber('Exx', 'E')).toBeNull()
    // Fremdes Schema (ohne Klassen-Präfix) gilt nicht als klassenbasierte Nummer.
    expect(parseClassNumber('7', '3')).toBeNull()
  })

  it('sortiert auch Nummern ohne Klassen-Präfix numerisch', () => {
    const list = [mk('3', 1), mk('3', 2), mk('3', 3)]
    list[0].startNr = '12'
    list[1].startNr = '7'
    list[2].startNr = ''
    expect(sortedByStartNr(list).map((p) => p.startNr)).toEqual(['7', '12', ''])
  })

  it('verteilt beim Umordnen nur den vorhandenen Nummernbestand neu', () => {
    const list = [mk('2', 5), mk('2', 7), mk('2', 11)]
    const reordered = [list[2], list[0], list[1]]
    expect(redistributeNumbers(reordered).map((p) => [p.id, p.startNr])).toEqual([
      ['2-11', '205'],
      ['2-5', '207'],
      ['2-7', '211'],
    ])
  })

  it('sortiert nach laufender Nummer', () => {
    const list = [mk('3', 10), mk('3', 2), mk('3', 1)]
    expect(sortedByStartNr(list).map((p) => p.startNr)).toEqual(['301', '302', '310'])
  })

  it('ordnet nach Größe (klein → groß), leere Größe ans Ende', () => {
    const list = [mk('3', 1, 'XL'), mk('3', 2, 'XS'), mk('3', 3, ''), mk('3', 4, 'M')]
    expect(orderBySize(list).map((p) => p.groesse)).toEqual(['XS', 'M', 'XL', ''])
  })

  it('vergibt fortlaufende Nummern in Reihenfolge', () => {
    const list = [mk('E', 5), mk('E', 9), mk('E', 2)]
    expect(renumberSequential(list).map((p) => p.startNr)).toEqual(['E01', 'E02', 'E03'])
  })

  it('verschiebt Starter an Anfang/Ende/um-eins', () => {
    const list = [mk('E', 1), mk('E', 2), mk('E', 3)]
    const ids = (l: Starter[]) => l.map((p) => p.id)
    expect(ids(moveInOrder(list, 'E-3', 'first'))).toEqual(['E-3', 'E-1', 'E-2'])
    expect(ids(moveInOrder(list, 'E-1', 'last'))).toEqual(['E-2', 'E-3', 'E-1'])
    expect(ids(moveInOrder(list, 'E-1', 'down'))).toEqual(['E-2', 'E-1', 'E-3'])
    expect(ids(moveInOrder(list, 'E-3', 'up'))).toEqual(['E-1', 'E-3', 'E-2'])
  })
})

describe('duplicateStartNrIds', () => {
  const s = (id: string, klasse: ClassId, startNr: string): Starter => ({
    id,
    startNr,
    klasse,
    vorname: '',
    nachname: id,
    verein: '',
    bundesland: '',
    geburtsdatum: '',
    groesse: '',
  })

  it('klassenbasiert: doppelt nur innerhalb einer Klasse, leere zählen nicht', () => {
    const list = [s('a', '1', '7'), s('b', '2', '7'), s('c', '1', '101'), s('d', '1', '101'), s('e', '1', ''), s('f', '1', '')]
    expect([...duplicateStartNrIds(list, 'klasse')].sort()).toEqual(['c', 'd'])
  })

  it('klassisch: doppelt über alle Klassen hinweg', () => {
    const list = [s('a', '1', '7'), s('b', '2', '7'), s('c', '3', '8')]
    expect([...duplicateStartNrIds(list, 'klassisch')].sort()).toEqual(['a', 'b'])
  })
})
