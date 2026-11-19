import type { ClassId, Starter } from '../types'
import { sizeRank } from './sizes'

/**
 * Was vor der laufenden Nummer einer klassenbezogenen Startnummer steht, je Klasse – soweit
 * das Regelwerk es nennt (YAML `startNrPraefix`, z. B. { E: E }: E01 auch dort, wo die Klasse
 * „Dolphin“ heißt). Für jede Klasse, die fehlt, steht ihre Kennung davor.
 */
export type StartNrPraefixe = Partial<Record<ClassId, string>>

/** Startnummern-Präfix je Klasse: was das Regelwerk nennt, sonst die Kennung (E → "E", 1 → "1"). */
export function startNrPrefix(klasse: ClassId, praefixe?: StartNrPraefixe): string {
  return praefixe?.[klasse] ?? klasse
}

/** Zweistellig auffüllen (E → E01), größere Zahlen bleiben unverändert. */
function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

/** Baut eine klassenbasierte Startnummer aus Klasse und laufender Nummer. */
export function makeStartNr(klasse: ClassId, n: number, praefixe?: StartNrPraefixe): string {
  return startNrPrefix(klasse, praefixe) + pad2(n)
}

/**
 * Die Buchstaben, die vor den Nummern der Klasse E (Dolphin) stehen können: Der Buchstabe lässt
 * sich in den Einstellungen umstellen (E oder D, config/catalog.ts `startNrPraefixe`), die schon
 * vergebenen Nummern bleiben dabei, wie sie sind.
 */
const DOLPHIN_PRAEFIXE = ['E', 'D'] as const

/**
 * Liest die laufende Nummer aus einer klassenbasierten Startnummer (Präfix +
 * Zahl). Liefert `null`, wenn das Präfix der Klasse fehlt oder kein numerischer
 * Teil vorhanden ist (z. B. importierte Nummern in anderem Schema).
 *
 * In der Klasse E zählen beide Buchstaben: Nach dem Umstellen von E auf D (oder zurück) geht die
 * Zählung bei der höchsten vergebenen Nummer weiter – sonst bekäme der nächste D01 neben E01,
 * und in der Sortierung stünde der Neue vor allen bisherigen.
 */
export function parseClassNumber(startNr: string, klasse: ClassId, praefixe?: StartNrPraefixe): number | null {
  const prefix = startNrPrefix(klasse, praefixe)
  const moegliche = klasse === 'E' ? [prefix, ...DOLPHIN_PRAEFIXE] : [prefix]
  const passt = moegliche.find((p) => startNr.startsWith(p))
  if (passt === undefined) return null
  const num = parseInt(startNr.slice(passt.length), 10)
  return Number.isNaN(num) ? null : num
}

/**
 * Startnummern vergleichen – die EINE Stelle dafür, damit jede Liste gleich sortiert. Numerisch
 * nach der ganzen Nummer (E01 < E02 < E10, 301 < 311, 7 < 12). Ein Präfix aus Buchstaben vor
 * den Ziffern zählt wie eine 0 (Entscheidung des Nutzers vom 15.11.2026): E01 und D01 stehen wie
 * 001 vor 101, 201 … – die Klasse mit Präfix ist die jüngste und fährt zuerst. Ohne das stünden
 * Buchstaben hinter allen Ziffern. Bei gleichem Wert steht die Nummer mit Präfix vorn (E101 vor
 * 101, E01 vor 1 – seit den DMYV-Westen E101–E130 vom 19.11.2026 haben E und 1 dieselben Zahlen,
 * und die Klasse E fährt zuerst, z. B. beim Ordnen der Klassen nach ihrer kleinsten Nummer);
 * sonst entscheidet die Schreibweise, damit die Reihenfolge fest ist.
 */
export function vergleicheStartNr(a: string, b: string): number {
  const praefix = /^[A-Za-zÄÖÜäöü]+(?=\d)/
  const wert = (nr: string) => nr.trim().replace(praefix, '0')
  const mitPraefix = (nr: string) => (praefix.test(nr.trim()) ? 0 : 1)
  return wert(a).localeCompare(wert(b), 'de', { numeric: true }) || mitPraefix(a) - mitPraefix(b) || a.trim().localeCompare(b.trim(), 'de', { numeric: true })
}

/**
 * Vergleich innerhalb einer Klasse: nach der Startnummer ({@link vergleicheStartNr}); Nummern
 * ohne Ziffern ans Ende.
 */
function byNumber(a: Starter, b: Starter): number {
  const da = /\d/.test(a.startNr)
  const db = /\d/.test(b.startNr)
  if (da !== db) return da ? -1 : 1
  return vergleicheStartNr(a.startNr, b.startNr)
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
export function renumberSequential(ordered: Starter[], praefixe?: StartNrPraefixe): Starter[] {
  return ordered.map((p, i) => ({ ...p, startNr: makeStartNr(p.klasse, i + 1, praefixe) }))
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
