import { codeEntries, parseCodeEntry } from './codes'
import type { Column, ErrorDef, SheetDef } from '../types'

// Unverändert aus dem Fehlerpunkte-Prototyp (lib/scoring.ts); `columnsForClass` und
// `defFuerKlasse` stehen hier in lib/bogen.ts.

// Berechnet die Zeilen-Ergebnisse eines Bogens aus den Zellwerten.
//
// Regeln:
//   • 'buoy'-Zelle: enthält sie eine Zahl → das ist die Punktzahl direkt
//                   (der WKR trägt 5, 10, 15 … ein, nicht die Anzahl).
//                   enthält sie einen Buchstaben A-X → Disqualifikation an
//                   genau dieser Stelle (zählt nicht als Punkte).
//   • 'code'-Zelle: kommagetrennte Fehlercodes → Punkte laut errorTable.
//                   Die Punkte erscheinen (read-only) in der zugehörigen pointsCol:
//                   als Summe, bei `einzeln` einzeln in der Reihenfolge der Codes
//                   („5 + 5“).
//   • 'points'-Zelle: direkte Punkteingabe.
//   • 'disq'-Zelle: Disqualifikations-Buchstabe für die ganze Zeile.
//
// Σ (sumColumnKey) = Summe aller Bojen-, Code- und Punkte-Beiträge der Zeile.

export interface DisqHit {
  /** Spalten-/Bereichsbezeichnung, an der die Disqualifikation notiert wurde. */
  where: string
  code: string
}

export interface RowScore {
  /** Gesamt-Fehlerpunkte der Zeile. */
  sum: number
  /** Berechnete Punkte je 'sum'-Spalte (Schlüssel → Punkte). */
  computedCols: Record<string, number>
  /** Punkte einzeln je Spalte mit `einzeln`, z. B. "5 + 5". */
  einzelPunkte: Record<string, string>
  /** Disqualifikations-Treffer (aus Disq-Spalte und Bojen-Zellen). */
  disqs: DisqHit[]
}

/** Zellschlüssel für Wert-Map: "nr:colKey" bzw. "nr:colKey#subIndex". */
export function cellKey(nr: string, colKey: string, subIndex?: number): string {
  return subIndex === undefined ? `${nr}:${colKey}` : `${nr}:${colKey}#${subIndex}`
}

/** Alle Zellschlüssel, die eine Spalte in einer Zeile erzeugt. */
export function columnCellKeys(nr: string, col: Column): string[] {
  if (col.sub && col.sub.length > 0) {
    return col.sub.map((_, i) => cellKey(nr, col.key, i))
  }
  return [cellKey(nr, col.key)]
}

const LETTER = /^[A-Za-z]$/

/** Eine Bojen-Zelle: Punkte (5, 10, 15 … direkt eingetragen) oder ein Disq-Buchstabe. */
export function bojenWert(raw: string): { punkte: number; disq?: string } {
  const v = raw.trim()
  if (LETTER.test(v)) return { punkte: 0, disq: v.toUpperCase() }
  return { punkte: parseInt(v, 10) || 0 }
}

/** Die Buchstaben einer Disq-Zelle. */
export function disqCodes(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => c !== '')
}

/** Die Disq-Buchstaben einer Fehler-Spalte. */
export function codeDisqs(raw: string): string[] {
  return codeEntries(raw)
    .map((entry) => entry.toUpperCase())
    .filter((c) => LETTER.test(c))
}

/** Die Punkte einer Fehler-Spalte je Eintrag, in dessen Reihenfolge. */
export function errorParts(table: ErrorDef[] | undefined, raw: string): Array<{ anzahl: number; punkte: number }> {
  if (!table) return []
  return codeEntries(raw).flatMap((entry) => {
    const parsed = parseCodeEntry(entry)
    const found = parsed && table.find((e) => e.code === parsed.code)
    return parsed && found ? [{ anzahl: parsed.anzahl, punkte: found.punkte }] : []
  })
}

export function scoreRow(
  def: SheetDef,
  nr: string,
  get: (key: string) => string,
): RowScore {
  let sum = 0
  const computedCols: Record<string, number> = {}
  const einzelPunkte: Record<string, string> = {}
  const einzelnSpalten = new Set(def.columns.filter((c) => c.einzeln).map((c) => c.key))
  const disqs: DisqHit[] = []

  for (const col of def.columns) {
    if (col.kind === 'buoy') {
      const keys = columnCellKeys(nr, col)
      col.sub && col.sub.length > 0
        ? col.sub.forEach((subLabel, i) => {
            handleBuoy(get(keys[i]), `${col.label} ${subLabel}`)
          })
        : handleBuoy(get(keys[0]), col.label)
    } else if (col.kind === 'code') {
      // Eigener Spalten-Katalog (Steg AB/AN) hat Vorrang vor dem positionsweiten.
      const raw = get(cellKey(nr, col.key))
      const parts = errorParts(col.errorTable ?? def.errorTable, raw)
      const pts = parts.reduce((s, p) => s + p.anzahl * p.punkte, 0)
      sum += pts
      if (col.pointsCol) computedCols[col.pointsCol] = (computedCols[col.pointsCol] ?? 0) + pts
      if (col.pointsCol && einzelnSpalten.has(col.pointsCol) && parts.length > 0) {
        einzelPunkte[col.pointsCol] = parts
          .map((p) => (p.anzahl > 1 ? `${p.anzahl}x${p.punkte}` : String(p.punkte)))
          .join(' + ')
      }
      // Ein Disq-Buchstabe in einer Fehler-Spalte markiert die Disqualifikation
      // an dieser Stelle (wie in den Bojen-Zellen).
      for (const c of codeDisqs(raw)) disqs.push({ where: col.label, code: c })
    } else if (col.kind === 'points') {
      const v = parseInt(get(cellKey(nr, col.key)), 10)
      if (!Number.isNaN(v)) sum += v
    } else if (col.kind === 'disq') {
      for (const c of disqCodes(get(cellKey(nr, col.key)))) disqs.push({ where: col.label, code: c })
    }
  }

  function handleBuoy(raw: string, where: string) {
    const { punkte, disq } = bojenWert(raw)
    sum += punkte
    if (disq) disqs.push({ where, code: disq })
  }

  return { sum, computedCols, einzelPunkte, disqs }
}

/** Text einer Summen-Spalte: die einzelnen Punkte, falls vorhanden, sonst die Summe (0 bleibt leer). */
export function summenText(score: RowScore, colKey: string): string {
  const einzeln = score.einzelPunkte[colKey]
  if (einzeln) return einzeln
  const val = colKey in score.computedCols ? score.computedCols[colKey] : score.sum
  return val > 0 ? String(val) : ''
}

/** Kurztext der Disqualifikationen einer Zeile, z. B. "G @ Tor 3 H K". */
export function formatDisqs(disqs: DisqHit[]): string {
  return disqs.map((d) => `${d.code} @ ${d.where}`).join(', ')
}
