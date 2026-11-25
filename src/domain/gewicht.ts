import type { OriginMode, Starter } from '../types'
import { CLASS_IDS } from './classes'

/**
 * Verwiegung. Jede Klasse hat ein Durchschnittsgewicht (aus dem Regelwerk, siehe
 * config/catalog; DM-Reglement C3, UIM 960 Pkt. 3.7); wer leichter ist, bekommt den
 * Unterschied als Ausgleichsgewicht ins Boot.
 */

/**
 * Abstufung des Ausgleichsgewichts = das kleinste Gewichtsstück am Steg (AppState.ausgleichStufe, Nutzer 24.11.2026:
 * „kannst du noch einstellbar machen, wie kleinteilig die Zusatzgewichte sind. Vielleicht haben einige
 * halbe Kilos und bei anderen ist 2 kg das kleinste.“): Das Ausgleichsgewicht ist immer ein Vielfaches davon. Die
 * Vorgabe 1 kg ist das Verhalten vorher (ganze kg) – ohne Einstellung ändert sich nichts.
 */
export const AUSGLEICH_STUFE_VORGABE = 1
/** Die Stufen zur Auswahl in den Einstellungen; daneben ein eigener Wert in diesen Grenzen. */
export const AUSGLEICH_STUFEN = [0.1, 0.5, 1, 2] as const
export const AUSGLEICH_STUFE_MIN = 0.1
export const AUSGLEICH_STUFE_MAX = 10

/**
 * Eine brauchbare Stufe in kg oder `undefined` – für Reducer, migrate und die Einstellungen (EINE Prüfung). Auf 10 g
 * genau (Auslegung 24.11.2026: so geht auch 0,25 kg; feiner wiegt am Steg niemand ab), in den Grenzen
 * {@link AUSGLEICH_STUFE_MIN}–{@link AUSGLEICH_STUFE_MAX} kg.
 */
export function ausgleichStufeWert(kg: unknown): number | undefined {
  if (typeof kg !== 'number' || !Number.isFinite(kg)) return undefined
  const stufe = Math.round(kg * 100) / 100
  return stufe >= AUSGLEICH_STUFE_MIN && stufe <= AUSGLEICH_STUFE_MAX ? stufe : undefined
}

/** Eingabe „0,5“, „2“ oder „0.25 kg“ → Stufe; Unsinn oder außerhalb der Grenzen → `undefined`. */
export function parseAusgleichStufe(text: string): number | undefined {
  return ausgleichStufeWert(parseFloat(text.replace(',', '.')))
}

/** kg → ganze Gramm. In Gramm rechnet die Rundung, damit 0,1 + 0,2 nicht 0,30000000000000004 ergibt. */
const gramm = (kg: number) => Math.round(kg * 1000)

/**
 * DIE Rundung des Ausgleichsgewichts (Nutzer 24.11.2026: „Runden bitte nach den üblichen Mathe-Regeln. Kein
 * grundsätzliches Aufrunden.“): auf das nächste Vielfache von `stufe`, genau in der Mitte aufwärts. Bei 2 kg:
 * 0,9 → 0, 1,0 → 2, 2,9 → 2, 3,0 → 4; bei 0,5 kg: 1,2 → 1,0, 1,25 → 1,5. Ganzzahlig in Gramm, so ist „genau die
 * Mitte“ auch wirklich die Mitte (vorher `Math.floor(x + 0.5)` im Gleitkomma, das für 1 kg dasselbe tat).
 */
export function rundeAufStufe(kg: number, stufe: number): number {
  const s = gramm(stufe)
  if (!(s > 0)) return kg
  // ⌊(g + s/2) / s⌋ ohne Bruch: ⌊(2g + s) / 2s⌋ – auch für eine ungerade Grammzahl der Stufe exakt.
  return (Math.floor((2 * gramm(kg) + s) / (2 * s)) * s) / 1000
}

/**
 * Ausgleichsgewicht in kg, gerundet auf ein Vielfaches von `stufe` ({@link rundeAufStufe}; ab der Hälfte aufwärts).
 * Wer weniger als eine halbe Stufe leichter ist, bekommt 0 – am Steg dasselbe wie „keines nötig“.
 *
 * - `undefined`: noch nicht gewogen. Bewusst kein Zahlenwert – die alte
 *   Excel-Liste druckte hier das volle Durchschnittsgewicht als Ausgleich.
 * - `null`: gewogen, kein Ausgleichsgewicht nötig.
 *
 * Gerufen nur über lib/ausgleich.ts `ausgleichVon` (Stufe aus dem Stand) – Liste „Ausgleichsgewichte“, Liste nach
 * Regel 960 Pkt. 3.7, Verwiegung und Steg-Gerät nehmen so dieselbe Zahl.
 */
export function ausgleichKg(gewicht: number | undefined, soll: number, stufe: number): number | null | undefined {
  if (gewicht === undefined) return undefined
  const unterschied = gramm(soll) - gramm(gewicht)
  if (unterschied <= 0) return null
  return rundeAufStufe(unterschied / 1000, stufe)
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
