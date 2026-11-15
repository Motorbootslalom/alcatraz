import type { OriginMode, Starter } from '../types'
import { CLASS_IDS } from './classes'

/**
 * Verwiegung. Jede Klasse hat ein Durchschnittsgewicht (aus dem Regelwerk, siehe
 * config/catalog; DM-Reglement C3, UIM 960 Pkt. 3.7); wer leichter ist, bekommt den
 * Unterschied als Ausgleichsgewicht ins Boot.
 */

/**
 * Ausgleichsgewicht in ganzen kg (ab ,5 aufgerundet).
 *
 * - `undefined`: noch nicht gewogen. Bewusst kein Zahlenwert – die alte
 *   Excel-Liste druckte hier das volle Durchschnittsgewicht als Ausgleich.
 * - `null`: gewogen, kein Ausgleichsgewicht nötig.
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

/**
 * Ein Gewicht, wie es auf einer Liste steht: mit dem Dezimalzeichen der Listensprache – deutsch
 * „28,7“, englisch „28.7“ (wie die Zeiten, lib/ergebnisText.ts). Eine Stelle für alle Listen,
 * damit dasselbe Gewicht nicht auf der Gewichtsliste je Herkunft mit Komma und auf der Liste nach
 * Pkt. 3.7 mit Punkt steht.
 */
export function gewichtText(kg: number, sprache: 'de' | 'en'): string {
  const text = String(kg)
  return sprache === 'de' ? text.replace('.', ',') : text
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
 *
 * `schluessel` sagt, welche Schreibweisen dieselbe Herkunft sind („NRW“ und
 * „Nordrhein-Westfalen“) – derselbe wie für Starterlisten und Mannschaftswertung
 * (lib/pokal.ts `mannschaftSchluessel`), damit der Mannschaftsleiter EIN Blatt bekommt.
 * Im Kopf steht die häufigste Schreibweise, bei Gleichstand die zuerst genannte. Ohne
 * Angabe zählt die Schreibweise selbst.
 */
export function gewichtsGruppen(starters: readonly Starter[], mode: OriginMode, schluessel: (name: string) => string = (name) => name): GewichtsGruppe[] {
  const originOf = (p: Starter) => (mode === 'none' ? '' : mode === 'land' ? (p.land ?? '') : mode === 'bundesland' ? p.bundesland : p.verein || p.bundesland)
  const groups = new Map<string, { starters: Starter[]; namen: Map<string, number> }>()
  for (const p of starters) {
    const origin = originOf(p).replace(/\s+/g, ' ').trim()
    const k = origin === '' ? '' : schluessel(origin)
    const g = groups.get(k) ?? { starters: [], namen: new Map<string, number>() }
    groups.set(k, g)
    g.starters.push(p)
    g.namen.set(origin, (g.namen.get(origin) ?? 0) + 1)
  }
  const order = (a: Starter, b: Starter) =>
    CLASS_IDS.indexOf(a.klasse) - CLASS_IDS.indexOf(b.klasse) ||
    a.nachname.localeCompare(b.nachname, 'de') ||
    a.vorname.localeCompare(b.vorname, 'de')
  return [...groups.values()]
    // Map behält die Reihenfolge des Einfügens: Bei gleicher Häufigkeit gewinnt die erste Schreibweise.
    .map((g) => ({ origin: [...g.namen].reduce((a, b) => (b[1] > a[1] ? b : a))[0], starters: [...g.starters].sort(order) }))
    .sort((a, b) => a.origin.localeCompare(b.origin, 'de'))
}
