import { describe, expect, it } from 'vitest'
import { codeAnzahlen, codeHoechstens, codesUeberMax, normalizeCodeCell } from './codes'
import { WKR_ANNAHMEN } from '../wkr/annahmen'

const AB = new Set(['3', '4', '5']) // Steg Ablegen
const AN = new Set(['7', '8', '9', '10', '11', '12']) // Steg Anlegen
const DISQ = new Set(['A', 'B', 'G', 'J', 'K', 'X'])

describe('normalizeCodeCell', () => {
  it('sortiert gültige Codes numerisch und trennt mit ", "', () => {
    expect(normalizeCodeCell('5 3 4', AB, DISQ)).toBe('3, 4, 5')
    expect(normalizeCodeCell('12; 9 / 8', AN, DISQ)).toBe('8, 9, 12')
  })

  it('verwirft Codes, die nicht zum Spalten-Katalog gehören', () => {
    // 12 gehört zu Anlegen, nicht zu Ablegen → wird verworfen
    expect(normalizeCodeCell('12 4 3', AB, DISQ)).toBe('3, 4')
    // 3 gehört zu Ablegen, nicht zu Anlegen → wird verworfen
    expect(normalizeCodeCell('3 9', AN, DISQ)).toBe('9')
  })

  it('lässt erlaubte Disqualifikations-Buchstaben zu (groß, hinten, ohne Dubletten)', () => {
    expect(normalizeCodeCell('3 k', AB, DISQ)).toBe('3, K')
    expect(normalizeCodeCell('k K j', AB, DISQ)).toBe('J, K')
  })

  it('verwirft nicht erlaubte Buchstaben', () => {
    expect(normalizeCodeCell('3 z', AB, DISQ)).toBe('3') // Z nicht in DISQ
  })

  it('fasst Mehrfachnennungen zu „2x3“ zusammen', () => {
    expect(normalizeCodeCell('3 3 4', AB, DISQ)).toBe('2x3, 4')
    expect(normalizeCodeCell('3, 3, 3', AB, DISQ)).toBe('3x3')
    expect(normalizeCodeCell('2x3, 3', AB, DISQ)).toBe('3x3')
  })

  it('versteht „2x3“ in jeder Schreibweise und sortiert nach Code', () => {
    for (const eingabe of ['2x3', '2X3', '2 x 3', '2×3']) expect(normalizeCodeCell(eingabe, AB, DISQ)).toBe('2x3')
    expect(normalizeCodeCell('5 2x3 k', AB, DISQ)).toBe('2x3, 5, K')
    expect(normalizeCodeCell('1x3', AB, DISQ)).toBe('3')
  })

  it('verwirft Faktoren mit ungültigem Code oder ohne Anzahl', () => {
    expect(normalizeCodeCell('2x99', AB, DISQ)).toBe('')
    expect(normalizeCodeCell('0x3', AB, DISQ)).toBe('')
  })

  it('verwechselt den Faktor nicht mit dem Disq-Buchstaben X', () => {
    expect(normalizeCodeCell('2x3', AB, DISQ)).not.toContain('X')
    expect(normalizeCodeCell('2x', AB, DISQ)).toBe('')
    expect(normalizeCodeCell('x3', AB, DISQ)).toBe('')
    expect(normalizeCodeCell('x', AB, DISQ)).toBe('X') // allein: „Nicht gestartet“
    expect(normalizeCodeCell('3 x', AB, DISQ)).toBe('3, X')
  })

  it('leert sauber', () => {
    expect(normalizeCodeCell('', AB, DISQ)).toBe('')
    expect(normalizeCodeCell('99 z', AB, DISQ)).toBe('')
  })
})

describe('Höchstzahl je Code (Nutzer 24.11.2026, WKR_ANNAHMEN CM1/CM2)', () => {
  it('codeHoechstens: Angabe des Regelwerks, sonst die allgemeine Grenze', () => {
    expect(codeHoechstens({ max: 1 })).toBe(1)
    expect(codeHoechstens({})).toBe(WKR_ANNAHMEN.codeMaxAllgemein)
  })

  it('codeAnzahlen zählt jede Schreibweise zusammen („2x6, 6“ = 3), Buchstaben und Unfertiges zählen nicht', () => {
    expect([...codeAnzahlen('3, 2x6, 6, A')]).toEqual([['3', 1], ['6', 3]])
    expect([...codeAnzahlen('2 x 06, 0x3, 2x')]).toEqual([['6', 2]])
  })

  it('codesUeberMax: nur Codes des Katalogs über ihrer Grenze, mit dem Buchstaben danach', () => {
    const katalog = [{ code: '1', max: 1 }, { code: '20', max: 2, danach: 'D' }, { code: '2' }]
    expect(codesUeberMax('1, 2x20, 3x2', katalog)).toEqual([])
    expect(codesUeberMax('2x1, 3x20, 4x2, 9x99', katalog)).toEqual([
      { code: '1', anzahl: 2, max: 1 },
      { code: '20', anzahl: 3, max: 2, danach: 'D' },
      { code: '2', anzahl: 4, max: WKR_ANNAHMEN.codeMaxAllgemein },
    ])
  })
})
