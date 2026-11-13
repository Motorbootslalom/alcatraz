import { describe, expect, it } from 'vitest'
import {
  PRINT_RESERVE_MM,
  PX_PER_MM,
  autoPageSize,
  blockSeiten,
  overflowRows,
  pageChunks,
  printableHeightPx,
  rowsThatFit,
} from './paging'

const nums = (n: number) => Array.from({ length: n }, (_, i) => String(301 + i))
const sizes = (chunks: string[][]) => chunks.map((c) => c.length)

describe('pageChunks', () => {
  it('ohne Zeilen/Seite und ohne Messung bleibt alles auf einer Seite', () => {
    expect(sizes(pageChunks(nums(40), 0))).toEqual([40])
  })

  it('teilt nach Zeilen/Seite auf (ohne Schwelle wie bisher)', () => {
    expect(sizes(pageChunks(nums(25), 15))).toEqual([15, 10])
    expect(sizes(pageChunks(nums(16), 15))).toEqual([15, 1])
    expect(sizes(pageChunks(nums(15), 15))).toEqual([15])
  })

  it('mit Schwelle: erst ab so vielen Startern aufteilen', () => {
    // Beispiel: ab 25 Startern je 15 pro Seite, 16-24 bleiben eine Seite.
    expect(sizes(pageChunks(nums(25), 15, 25))).toEqual([15, 10])
    expect(sizes(pageChunks(nums(30), 15, 25))).toEqual([15, 15])
    expect(sizes(pageChunks(nums(24), 15, 25))).toEqual([24])
    expect(sizes(pageChunks(nums(16), 15, 25))).toEqual([16])
  })

  it('automatisch (Zeilen/Seite 0) mit gemessener Kapazität', () => {
    expect(sizes(pageChunks(nums(20), 0, 0, 20))).toEqual([20])
    expect(sizes(pageChunks(nums(24), 0, 0, 20))).toEqual([15, 9])
    expect(sizes(pageChunks(nums(58), 0, 0, 20))).toEqual([20, 20, 18])
  })

  it('feste Zeilen/Seite gelten, solange jede Seite aufs Blatt passt', () => {
    expect(sizes(pageChunks(nums(25), 15, 25, 20))).toEqual([15, 10])
    expect(sizes(pageChunks(nums(20), 15, 25, 20))).toEqual([20]) // Steg: 20 passen
  })

  it('passt eine feste Seite nicht aufs Blatt, wird automatisch geteilt', () => {
    // Tor 1/3/5: höchstens 19 Starter je Blatt; 15 / 25 würde 20 zusammenlassen.
    expect(sizes(pageChunks(nums(20), 15, 25, 19))).toEqual([10, 10])
    // Fester Wert 20 bei nur 18 passenden: 40 → 15 + 15 + 10 statt 20 + 20
    expect(sizes(pageChunks(nums(40), 20, 0, 18))).toEqual([15, 15, 10])
  })

  it('liefert für eine leere Klasse genau einen leeren Block', () => {
    expect(pageChunks([], 15, 25)).toEqual([[]])
    expect(pageChunks([], 0)).toEqual([[]])
    expect(pageChunks([], 0, 0, 20)).toEqual([[]])
  })
})

describe('autoPageSize (5er-Schritte: Mitte, Drittel, …)', () => {
  it('passt auf eine Seite → alle', () => {
    expect(autoPageSize(20, 20)).toBe(20)
    expect(autoPageSize(7, 20)).toBe(7)
  })

  it('zwei Seiten: in der Mitte, auf 5 aufgerundet', () => {
    expect(autoPageSize(24, 20)).toBe(15) // 15 + 9
    expect(autoPageSize(21, 20)).toBe(15) // 15 + 6
    expect(autoPageSize(40, 20)).toBe(20) // 20 + 20
  })

  it('drei Seiten: im Drittel, auf 5 aufgerundet', () => {
    expect(autoPageSize(58, 20)).toBe(20) // 20 + 20 + 18
    expect(autoPageSize(41, 20)).toBe(15) // 15 + 15 + 11
  })

  it('ohne Messung eine Seite; sehr kleine Kapazität direkt', () => {
    expect(autoPageSize(58, 0)).toBe(58)
    expect(autoPageSize(10, 3)).toBe(3)
  })

  it('kostet das Aufrunden eine Seite, wird nur gleichmäßig geteilt', () => {
    expect(autoPageSize(20, 9)).toBe(7) // 7 + 7 + 6 statt 5 + 5 + 5 + 5
    expect(autoPageSize(20, 8)).toBe(7) // 7 + 7 + 6
    expect(autoPageSize(19, 9)).toBe(7) // 7 + 7 + 5
  })
})

describe('Messung', () => {
  const seite = printableHeightPx(297) // 281 mm nutzbar

  it('overflowRows: passt → 0 (mit Rundungs-Toleranz)', () => {
    expect(overflowRows(seite, 297, 25)).toBe(0)
    expect(overflowRows(seite + 0.8, 297, 25)).toBe(0)
  })

  it('overflowRows: zu hoch → aufgerundete Zahl Zeilen', () => {
    // 24 mm zu hoch bei 6,5 mm Zeilenhöhe → 4 Zeilen zu viel
    expect(overflowRows(seite + 24 * PX_PER_MM, 297, 6.5 * PX_PER_MM)).toBe(4)
    expect(overflowRows(seite + 2, 297, 25)).toBe(1)
  })

  it('overflowRows: Querformat rechnet mit 210 mm', () => {
    expect(overflowRows(printableHeightPx(210), 210, 25)).toBe(0)
  })

  it('rowsThatFit: Zeilen, die neben Kopf/Fuß auf die Seite passen (mit Reserve)', () => {
    const reserve = PRINT_RESERVE_MM * PX_PER_MM
    expect(rowsThatFit(seite - reserve - 23 * 25, 25, 297)).toBe(23)
    expect(rowsThatFit(seite - reserve - 23 * 25 + 1, 25, 297)).toBe(22)
    expect(rowsThatFit(100, 0, 297)).toBe(0)
  })

  it('rowsThatFit: eine Seite, die ohne Reserve genau passt, gilt als zu voll', () => {
    // Steg: 20 Starter + 3 Leerzeilen füllten das Blatt bis auf 0,1 mm.
    const rowPx = 6.1 * PX_PER_MM
    expect(rowsThatFit(seite - 0.1 * PX_PER_MM - 23 * rowPx, rowPx, 297)).toBe(22)
  })
})

describe('blockSeiten: mehrere Klassen auf einer Liste', () => {
  it('ohne Messung steht alles auf einer Seite', () => {
    expect(blockSeiten([4, 6], 0)).toEqual([[{ block: 0, von: 0, bis: 4 }, { block: 1, von: 0, bis: 6 }]])
    expect(blockSeiten([], 10)).toEqual([[]])
  })

  it('füllt die Seite und hält einen Block zusammen (jeder kostet eine Überschriftzeile)', () => {
    // 4+1 und 6+1 passen in 12; der dritte Block rückt auf die nächste Seite.
    expect(blockSeiten([4, 6, 3], 12)).toEqual([
      [{ block: 0, von: 0, bis: 4 }, { block: 1, von: 0, bis: 6 }],
      [{ block: 2, von: 0, bis: 3 }],
    ])
  })

  it('teilt nur einen Block, der allein nicht auf eine Seite passt', () => {
    // Auf leerer Seite: Seiten füllen, der Rest zuletzt.
    expect(blockSeiten([25], 12)).toEqual([
      [{ block: 0, von: 0, bis: 11 }],
      [{ block: 0, von: 11, bis: 22 }],
      [{ block: 0, von: 22, bis: 25 }],
    ])
    // Nach dem Rest eines geteilten Blocks geht es auf derselben Seite weiter.
    expect(blockSeiten([25, 2], 12).at(-1)).toEqual([{ block: 0, von: 22, bis: 25 }, { block: 1, von: 0, bis: 2 }])
  })

  it('ein geteilter Block beginnt auf der laufenden Seite, wenn er dadurch nicht in mehr Stücke zerfällt', () => {
    // 25 Zeilen brauchen ohnehin drei Stücke: 8 passen noch unter den ersten Block – ein Blatt gespart.
    expect(blockSeiten([2, 25], 12)).toEqual([
      [{ block: 0, von: 0, bis: 2 }, { block: 1, von: 0, bis: 8 }],
      [{ block: 1, von: 8, bis: 19 }],
      [{ block: 1, von: 19, bis: 25 }],
    ])
    // 30 Zeilen: drei volle Seiten reichen fast, mit dem Anfang auf Seite 1 wären es vier Stücke – also neue Seite.
    expect(blockSeiten([3, 30], 12).map((s) => s.map((t) => t.bis - t.von))).toEqual([[3], [11], [11], [8]])
    // Zu wenig Platz für ein ordentliches Stück: neue Seite.
    expect(blockSeiten([8, 14], 12).map((s) => s.map((t) => t.bis - t.von))).toEqual([[8], [11], [3]])
  })

  it('kein Blatt für eine einzelne Zeile: auf dem letzten Stück stehen mindestens drei Starter', () => {
    expect(blockSeiten([23], 12).map((s) => s.map((t) => t.bis - t.von))).toEqual([[11], [9], [3]])
    expect(blockSeiten([12], 12).map((s) => s.map((t) => t.bis - t.von))).toEqual([[9], [3]])
  })

  it('Leerzeilen sind kein Grund für ein weiteres Blatt: Sie entfallen bis auf eine, Starter nie', () => {
    // 9 Starter + 3 Leerzeilen bei 11 Zeilen Platz: eine Seite mit 2 Leerzeilen.
    expect(blockSeiten([12], 12, [3])).toEqual([[{ block: 0, von: 0, bis: 11 }]])
    // 14 Starter + 3 Leerzeilen bei 15 Zeilen Platz: eine Leerzeile bleibt.
    expect(blockSeiten([17], 16, [3])).toEqual([[{ block: 0, von: 0, bis: 15 }]])
    // 20 Starter + 3 Leerzeilen: zwei Seiten statt drei.
    expect(blockSeiten([23], 12, [3]).map((s) => s.map((t) => t.bis - t.von))).toEqual([[11], [11]])
    // Passt nicht einmal eine Leerzeile dazu, wird geteilt – der Rest besteht nie nur aus Leerzeilen.
    expect(blockSeiten([18], 16, [3])).toEqual([[{ block: 0, von: 0, bis: 12 }], [{ block: 0, von: 12, bis: 18 }]])
    // Wer auf die Seite passt, behält alle Leerzeilen (auch wenn er dafür auf die nächste rückt).
    expect(blockSeiten([5, 8], 12, [3, 3])).toEqual([[{ block: 0, von: 0, bis: 5 }], [{ block: 1, von: 0, bis: 8 }]])
  })

  it('ein Block ohne Zeilen behält seine Überschrift', () => {
    expect(blockSeiten([0, 2], 10)).toEqual([[{ block: 0, von: 0, bis: 0 }, { block: 1, von: 0, bis: 2 }]])
  })
})
