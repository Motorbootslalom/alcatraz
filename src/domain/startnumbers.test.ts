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
} from './startnumbers'
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
