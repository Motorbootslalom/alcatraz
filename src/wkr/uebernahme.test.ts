import { describe, expect, it } from 'vitest'
import type { Eingaben, WkrZeile } from '../types'
import { haengeAn, vereinigeDisq, vereinigt, wendeZeileAn, zeilenPruefsumme } from './uebernahme'

// Die Kernregel der Übernahme (Plan §4, §9.1): gleich → nichts, vorher → setzen, sonst Konflikt; Steg gemeinsam:
// Disq. vereinigt (Wegfall nur als Konflikt), Bemerkung angehängt.

const L = 'manoevrieren/1'
const zeile = (zellen: WkrZeile['zellen'], weitere: string[] = []) => ({ lauf: L, weitere, starter: 'k1', zellen })
const mit = (werte: Record<string, string>): Eingaben => ({ [L]: { k1: werte } })

describe('wendeZeileAn', () => {
  it('leere Zelle, gleicher Wert, Stand = vorher → übernommen; anders belegt → Konflikt, Stand bleibt', () => {
    const e = mit({ a: '5', b: '10', c: '15' })
    const r = wendeZeileAn(e, zeile([
      { feld: 'neu', wert: '5', vorher: '' },
      { feld: 'a', wert: '5', vorher: '' },
      { feld: 'b', wert: '15', vorher: '10' },
      { feld: 'c', wert: '10', vorher: '' },
    ]))
    expect(r.eingaben[L].k1).toEqual({ a: '5', b: '15', c: '15', neu: '5' })
    expect(r.konflikte).toEqual([{ feld: 'c', wert: '10', steht: '15', grund: 'zelle' }])
  })

  it('vom Bediener geleerte Zelle, die das Gerät gesetzt hatte: Konflikt, keine leere Zelle', () => {
    const r = wendeZeileAn({}, zeile([{ feld: 'a', wert: '10', vorher: '5' }]))
    expect(r.konflikte).toEqual([{ feld: 'a', wert: '10', steht: '', grund: 'zelle' }])
    expect(r.eingaben).toEqual({})
  })

  it('Bojenzelle: Papier „5“ gegen Gerät „5, J“ ist abweichend – Rückfrage, kein Zusammenführen (W4-12, BZ5, 21.11.2026; Zellform BZ6 22.11.2026)', () => {
    const e = mit({ 't1a|hin seiteA': '5' })
    const r = wendeZeileAn(e, zeile([{ feld: 't1a|hin seiteA', wert: '5, J', vorher: '' }]))
    expect(r.konflikte).toEqual([{ feld: 't1a|hin seiteA', wert: '5, J', steht: '5', grund: 'zelle' }])
    expect(r.eingaben).toBe(e)
    // Korrektur des eigenen Werts („5“ → „5, J“) geht still durch.
    expect(wendeZeileAn(e, zeile([{ feld: 't1a|hin seiteA', wert: '5, J', vorher: '5' }])).eingaben[L].k1).toEqual({ 't1a|hin seiteA': '5, J' })
    // Mehrere Buchstaben (R7-14): gleiche Zelle = String-gleich (Katalogfolge) → nichts zu tun; ein Buchstabe mehr → Rückfrage.
    const zwei = mit({ 't1a|hin seiteA': '5, J, D' })
    expect(wendeZeileAn(zwei, zeile([{ feld: 't1a|hin seiteA', wert: '5, J, D', vorher: '' }])).eingaben).toBe(zwei)
    expect(wendeZeileAn(e, zeile([{ feld: 't1a|hin seiteA', wert: '5, J, D', vorher: '' }])).konflikte).toHaveLength(1)
  })

  it('nichts zu tun: dieselben Eingaben (Referenz)', () => {
    const e = mit({ a: '5' })
    expect(wendeZeileAn(e, zeile([{ feld: 'a', wert: '5', vorher: '' }])).eingaben).toBe(e)
    expect(wendeZeileAn(e, zeile([])).eingaben).toBe(e)
  })

  it('weitere Läufe (Vorsteg, Versuche nacheinander) bekommen denselben Wert', () => {
    const r = wendeZeileAn({}, zeile([{ feld: 'disq@vorsteg', wert: 'X', vorher: '' }], ['manoevrieren/2']))
    expect(r.eingaben).toEqual({ [L]: { k1: { 'disq@vorsteg': 'X' } }, 'manoevrieren/2': { k1: { 'disq@vorsteg': 'X' } } })
  })

  it('Disq. am Steg wird vereinigt; Wegfall nur als Konflikt „entfernt“', () => {
    const e = mit({ 'disq@steg': 'A' })
    const dazu = wendeZeileAn(e, zeile([{ feld: 'disq@steg', wert: 'S', vorher: '', vereinige: true }]))
    expect(dazu.eingaben[L].k1['disq@steg']).toBe('A, S')
    expect(dazu.konflikte).toEqual([])
    // Das Anlegen nimmt sein S zurück, das Ablegen hat inzwischen F gesetzt: S bleibt bis zur Entscheidung.
    const e2 = mit({ 'disq@steg': 'A, S, F' })
    const weg = wendeZeileAn(e2, zeile([{ feld: 'disq@steg', wert: '', vorher: 'S', vereinige: true }]))
    expect(weg.eingaben).toBe(e2)
    expect(weg.konflikte).toEqual([{ feld: 'disq@steg', wert: 'A, F', steht: 'A, S, F', grund: 'entfernt' }])
  })

  it('X „nicht gestartet“ kommt am Steg nie still neben andere Buchstaben – Rückfrage `zelle` (Prüfbefund 24.11.2026, NG6/BZ2)', () => {
    // Gegenrichtung zu wkr/zeile.ts (dort kommt „Nicht gestartet“ ohne `vereinige`): X steht, der andere Teil bringt S.
    const x = mit({ 'disq@steg': 'X' })
    const s = wendeZeileAn(x, zeile([{ feld: 'disq@steg', wert: 'S', vorher: '', vereinige: true }]))
    expect(s.eingaben).toBe(x)
    expect(s.konflikte).toEqual([{ feld: 'disq@steg', wert: 'S', steht: 'X', grund: 'zelle' }])
    // Ein X MIT `vereinige` (älteres Gerät) neben „A“ ebenso.
    const a = mit({ 'disq@steg': 'A' })
    expect(wendeZeileAn(a, zeile([{ feld: 'disq@steg', wert: 'X', vorher: '', vereinige: true }])).konflikte).toEqual([{ feld: 'disq@steg', wert: 'X', steht: 'A', grund: 'zelle' }])
    // Hat der Bediener „X, A“ selbst geschrieben, gilt das Vereinigen weiter (sein Entscheid).
    const vonHand = mit({ 'disq@steg': 'X, A' })
    expect(wendeZeileAn(vonHand, zeile([{ feld: 'disq@steg', wert: 'S', vorher: '', vereinige: true }])).eingaben[L].k1['disq@steg']).toBe('X, A, S')
    // Rückfrage `start`, für das Gerät entschieden: dessen Wert gilt, statt zu mischen.
    expect(vereinigt('disq@steg', 'X', 'S', '')).toBe('S')
    expect(vereinigt('disq@steg', 'A', 'X', '')).toBe('X')
    expect(vereinigt('disq@steg', 'A', 'S', '')).toBe('A, S')
  })

  it('Bemerkung am Steg wird angehängt, nie ersetzt', () => {
    const e = mit({ 'bemerkung@steg': 'Leine' })
    const r = wendeZeileAn(e, zeile([{ feld: 'bemerkung@steg', wert: 'Fender', vorher: '', vereinige: true }]))
    expect(r.eingaben[L].k1['bemerkung@steg']).toBe('Leine; Fender')
  })
})

describe('vereinigeDisq, haengeAn', () => {
  it('vereinigeDisq', () => {
    expect(vereinigeDisq('', 'A', '')).toEqual({ wert: 'A', entfernt: null })
    expect(vereinigeDisq('A', 'A, S', 'A')).toEqual({ wert: 'A, S', entfernt: null })
    expect(vereinigeDisq('A, S', 'A', 'A, S')).toEqual({ wert: 'A, S', entfernt: 'A' })
    // Was das Gerät entfernen will, steht nicht (mehr) da: kein Konflikt.
    expect(vereinigeDisq('A', '', 'S')).toEqual({ wert: 'A', entfernt: null })
  })

  it('haengeAn', () => {
    expect(haengeAn('', 'x', '')).toEqual({ wert: 'x' })
    expect(haengeAn('a', 'x', '')).toEqual({ wert: 'a; x' })
    expect(haengeAn('a; x', 'x', '')).toEqual({ wert: 'a; x' })
    expect(haengeAn('a; x', 'y', 'x')).toEqual({ wert: 'a; y' })
    expect(haengeAn('a; x', '', 'x')).toEqual({ konflikt: 'entfernt', wert: 'a' })
    expect(haengeAn('a', 'y', 'x')).toEqual({ konflikt: 'zelle', wert: 'y' })
  })
})

describe('zeilenPruefsumme', () => {
  it('gleich bei gleichen Werten, unabhängig von Reihenfolge und leeren Feldern', () => {
    const a = zeilenPruefsumme({ x: '5', y: '' }, ['x', 'y'])
    expect(a).toMatch(/^[0-9a-f]{8}$/)
    expect(zeilenPruefsumme({ x: '5' }, ['y', 'x'])).toBe(a)
    expect(zeilenPruefsumme({ x: '10' }, ['x', 'y'])).not.toBe(a)
    // Felder außerhalb der Liste zählen nicht.
    expect(zeilenPruefsumme({ x: '5', z: '1' }, ['x', 'y'])).toBe(a)
  })
})
