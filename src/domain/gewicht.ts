import type { OriginMode, Starter } from '../types'
import { CLASS_IDS } from './classes'

/**
 * Verwiegung. Jede Klasse hat ein Standardgewicht (aus dem Regelwerk, siehe
 * config/catalog); wer leichter ist, bekommt den Unterschied als Zusatzgewicht
 * ins Boot.
 */

/**
 * Zusatzgewicht in ganzen kg (ab ,5 aufgerundet).
 *
 * - `undefined`: noch nicht gewogen. Bewusst kein Zahlenwert – die alte
 *   Excel-Liste druckte hier das volle Standardgewicht als Ausgleich.
 * - `null`: gewogen, kein Zusatzgewicht nötig.
 */
export function ausgleichKg(gewicht: number | undefined, soll: number): number | null | undefined {
  if (gewicht === undefined) return undefined
  if (gewicht >= soll) return null
  return Math.floor(soll - gewicht + 0.5)
}

/** Eingabe „45“, „45,5“ oder „45.5 kg“ → Zahl; leer oder Unsinn → `undefined` (nicht gewogen). */
export function parseGewicht(text: string): number | undefined {
  const value = parseFloat(text.replace(',', '.'))
  return Number.isFinite(value) && value > 0 && value < 300 ? Math.round(value * 10) / 10 : undefined
}

export interface GewichtsGruppe {
  /** Verein, Bundesland oder Land; `''`, wenn die Veranstaltung keine Herkunft führt. */
  origin: string
  starters: Starter[]
}

/**
 * Starter für die Gewichtslisten: je Herkunft eine Liste, darin nach Klasse
 * (E, 1, 2 …), Nachname, Vorname. Die Reihenfolge hängt bewusst nicht an der
 * Startnummer – gewogen wird beim Check-in, oft bevor es Nummern gibt.
 */
export function gewichtsGruppen(starters: Starter[], mode: OriginMode): GewichtsGruppe[] {
  const originOf = (p: Starter) => (mode === 'none' ? '' : mode === 'bundesland' ? p.bundesland : p.verein || p.bundesland)
  const groups = new Map<string, Starter[]>()
  for (const p of starters) {
    const origin = originOf(p).trim()
    groups.set(origin, [...(groups.get(origin) ?? []), p])
  }
  const order = (a: Starter, b: Starter) =>
    CLASS_IDS.indexOf(a.klasse) - CLASS_IDS.indexOf(b.klasse) ||
    a.nachname.localeCompare(b.nachname, 'de') ||
    a.vorname.localeCompare(b.vorname, 'de')
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b, 'de'))
    .map(([origin, list]) => ({ origin, starters: [...list].sort(order) }))
}
