import type { ClassId, Starter } from '../types'
import { sizeRank } from './sizes'

/** Startnummern-Präfix je Klasse: E → "E", numerische Klassen → die Ziffer. */
export function startNrPrefix(klasse: ClassId): string {
  return klasse
}

/** Zweistellig auffüllen (E → E01), größere Zahlen bleiben unverändert. */
function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

/** Baut eine klassenbasierte Startnummer aus Klasse und laufender Nummer. */
export function makeStartNr(klasse: ClassId, n: number): string {
  return startNrPrefix(klasse) + pad2(n)
}

/**
 * Liest die laufende Nummer aus einer klassenbasierten Startnummer (Präfix +
 * Zahl). Liefert `null`, wenn das Präfix der Klasse fehlt oder kein numerischer
 * Teil vorhanden ist (z. B. importierte Nummern in anderem Schema).
 */
export function parseClassNumber(startNr: string, klasse: ClassId): number | null {
  const prefix = startNrPrefix(klasse)
  if (!startNr.startsWith(prefix)) return null
  const num = parseInt(startNr.slice(prefix.length), 10)
  return Number.isNaN(num) ? null : num
}

/**
 * Vergleich innerhalb einer Klasse: numerisch nach der ganzen Startnummer
 * (E01 < E02 < E10, 301 < 311, aber auch importierte 7 < 12); Nummern ohne
 * Ziffern ans Ende.
 */
function byNumber(a: Starter, b: Starter): number {
  const da = /\d/.test(a.startNr)
  const db = /\d/.test(b.startNr)
  if (da !== db) return da ? -1 : 1
  return a.startNr.localeCompare(b.startNr, 'de', { numeric: true })
}

/** Teilnehmer einer Klasse in der aktuellen Startnummern-Reihenfolge. */
export function sortedByStartNr(list: Starter[]): Starter[] {
  return [...list].sort(byNumber)
}

/**
 * Reihenfolge nach Konfektionsgröße (klein → groß). Bei gleicher Größe bleibt die
 * bisherige Startnummern-Reihenfolge erhalten (stabiler Tiebreak).
 */
export function orderBySize(list: Starter[]): Starter[] {
  return [...list].sort((a, b) => {
    const ra = sizeRank(a.groesse)
    const rb = sizeRank(b.groesse)
    if (ra !== rb) return ra - rb
    return byNumber(a, b)
  })
}

/**
 * Weist einer geordneten Starter-Liste fortlaufende klassenbasierte Startnummern
 * (1, 2, 3 …) zu und liefert die aktualisierten Teilnehmer in Eingangsreihenfolge.
 */
export function renumberSequential(ordered: Starter[]): Starter[] {
  return ordered.map((p, i) => ({ ...p, startNr: makeStartNr(p.klasse, i + 1) }))
}

/**
 * Verteilt die vorhandenen Nummern einer Klasse (aufsteigend) neu auf die
 * geordnete Starter-Liste. Der Nummernbestand bleibt erhalten – Lücken und
 * importierte Nummern (z. B. 205, 207, 311) gehen nicht verloren.
 */
export function redistributeNumbers(ordered: Starter[]): Starter[] {
  const numbers = sortedByStartNr(ordered).map((p) => p.startNr)
  return ordered.map((p, i) => ({ ...p, startNr: numbers[i] }))
}

/**
 * Verschiebt den Starter `id` innerhalb seiner (bereits geordneten) Liste an den
 * Anfang, ans Ende oder um eine Position und liefert die neue Reihenfolge.
 */
export function moveInOrder(
  ordered: Starter[],
  id: string,
  target: 'first' | 'last' | 'up' | 'down',
): Starter[] {
  const from = ordered.findIndex((p) => p.id === id)
  if (from < 0) return ordered
  const next = [...ordered]
  const [item] = next.splice(from, 1)
  let to: number
  switch (target) {
    case 'first':
      to = 0
      break
    case 'last':
      to = next.length
      break
    case 'up':
      to = Math.max(0, from - 1)
      break
    case 'down':
      to = Math.min(next.length, from + 1)
      break
  }
  next.splice(to, 0, item)
  return next
}

/**
 * IDs der Starter, deren Startnummer mehrfach vergeben ist. Leere Nummern zählen
 * nicht – sie dürfen offen bleiben, bis die Listen entstehen.
 *
 * Klassische Nummern müssen über die ganze Veranstaltung eindeutig sein,
 * klassenbasierte nur innerhalb ihrer Klasse.
 */
export function duplicateStartNrIds(starters: Starter[], mode: 'klasse' | 'klassisch'): Set<string> {
  const groups = new Map<string, string[]>()
  for (const p of starters) {
    const nr = p.startNr.trim().toUpperCase()
    if (!nr) continue
    const key = mode === 'klassisch' ? nr : `${p.klasse}|${nr}`
    groups.set(key, [...(groups.get(key) ?? []), p.id])
  }
  return new Set([...groups.values()].filter((ids) => ids.length > 1).flat())
}
