import { parseClassNumber, startNrPrefix, type StartNrPraefixe } from './startnumbers'
import type { ClassId, OriginMode, Starter } from '../types'
import { birthYearRange } from './classes'
import { CLUBS, BUNDESLAENDER } from '../data/clubs'
import { VORNAMEN_M, VORNAMEN_W, NACHNAMEN } from '../data/names'
import { SIZES } from './sizes'

/**
 * Staaten für erfundene Starter eines internationalen Wettkampfs – so, dass jede eine Flagge hat
 * (domain/flaggen.ts). Nationen sind international (Entscheidung des Nutzers vom 15.11.2026): der
 * englische Name, das Kürzel dazu ist der dreistellige Code (Lithuania → LTU).
 */
export const LAENDER = ['Germany', 'Austria', 'Switzerland', 'Poland', 'Czechia', 'Slovakia', 'Latvia', 'Estonia', 'Lithuania', 'Italy', 'Hungary', 'Sweden', 'Netherlands']

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** Eine Herkunft der erfundenen Starter: Verein mit Bundesland, nur Bundesland oder Staat. */
export interface BeispielHerkunft {
  verein: string
  bundesland: string
  land?: string
}

/** Alle Herkünfte, aus denen die Beispieldaten würfeln – je nach Art der Herkunft. */
function herkunftsPool(originMode: OriginMode): BeispielHerkunft[] {
  if (originMode === 'land') return LAENDER.map((land) => ({ verein: '', bundesland: '', land }))
  if (originMode === 'bundesland') return BUNDESLAENDER.map((bundesland) => ({ verein: '', bundesland }))
  return CLUBS.map((c) => ({ verein: c.name, bundesland: c.bundesland }))
}

/**
 * So viele verschiedene Herkünfte, zufällig gewählt – für ein Beispiel-Starterfeld mit wenigen
 * Herkünften, an dem sich die Mannschaftswertung prüfen lässt. Welche Art, sagt `originMode`
 * (Verein, Bundesland oder Land); unter UIM ruft die Oberfläche immer mit „Land“ (Nationen,
 * components/BeispieldatenPanel.vue). Mehr, als es gibt, sind alle.
 */
export function beispielHerkuenfte(originMode: OriginMode, anzahl: number): BeispielHerkunft[] {
  const pool = herkunftsPool(originMode)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.max(1, Math.floor(anzahl)))
}

function uid(): string {
  return 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

/**
 * Ermittelt die nächste freie laufende Nummer für eine Klasse anhand der
 * bereits vergebenen Startnummern (Format Präfix + zweistellige Zahl).
 */
function nextStartNr(klasse: ClassId, existing: Starter[], praefixe?: StartNrPraefixe): string {
  const prefix = startNrPrefix(klasse, praefixe)
  let max = 0
  // Wie beim Hinzufügen von Hand (domain/startnumbers.ts `parseClassNumber`): In der Klasse E zählen E und D.
  for (const p of existing) if (p.klasse === klasse) max = Math.max(max, parseClassNumber(p.startNr, klasse, praefixe) ?? 0)
  return prefix + pad2(max + 1)
}

/** Zufälliges gültiges Geburtsdatum (ISO) im Jahrgangsbereich der Klasse. */
function randomGeburtsdatum(klasse: ClassId, eventJahr: number): string {
  const [fromYear, toYear] = birthYearRange(klasse, eventJahr)
  const year = randInt(fromYear, toYear)
  const month = randInt(1, 12)
  const daysInMonth = new Date(year, month, 0).getDate()
  const day = randInt(1, daysInMonth)
  return `${year}-${pad2(month)}-${pad2(day)}`
}

/** Generiert einen einzelnen Teilnehmer. `existing` dient der Startnummern-Vergabe. */
export function generateStarter(
  klasse: ClassId,
  eventJahr: number,
  originMode: OriginMode,
  existing: Starter[],
  /** Präfixe der Startnummern laut Regelwerk (domain/startnumbers.ts). */
  praefixe?: StartNrPraefixe,
  /** Die Herkunft steht fest (begrenzte Zahl der Herkünfte, reihum verteilt) statt gewürfelt. */
  herkunft?: BeispielHerkunft,
  /** Mit Geschlecht – nur unter einem Regelwerk mit der Liste nach Regel 960, Pkt. 3.7 (UIM). */
  mitGeschlecht = true,
): Starter {
  const female = Math.random() < 0.5
  const vorname = pick(female ? VORNAMEN_W : VORNAMEN_M)
  const nachname = pick(NACHNAMEN)

  let verein: string
  let bundesland: string
  let land: string | undefined
  if (herkunft) {
    ;({ verein, bundesland, land } = herkunft)
  } else if (originMode === 'land') {
    // International: nur der Staat.
    land = pick(LAENDER)
    verein = ''
    bundesland = ''
  } else if (originMode === 'bundesland') {
    // Reiner Bundesland-Modus: kein konkreter Verein, nur das Bundesland.
    bundesland = pick(BUNDESLAENDER)
    verein = ''
  } else {
    const club = pick(CLUBS)
    verein = club.name
    bundesland = club.bundesland
  }

  return {
    id: uid(),
    startNr: nextStartNr(klasse, existing, praefixe),
    vorname,
    nachname,
    verein,
    bundesland,
    ...(land ? { land } : {}),
    geburtsdatum: randomGeburtsdatum(klasse, eventJahr),
    klasse,
    groesse: pick(SIZES as readonly string[] as string[]),
    // Folgt dem gewürfelten Vornamen – so lässt sich die Liste nach Regel 960, Pkt. 3.7 ausprobieren.
    // Unter der DM nicht: Dort fragt keine Liste danach, und die Spalte stünde sonst im Starter-Reiter.
    ...(mitGeschlecht ? { geschlecht: female ? ('F' as const) : ('M' as const) } : {}),
  }
}

/**
 * Generiert `count` Teilnehmer für eine Klasse. Die Startnummern werden fortlaufend
 * unter Berücksichtigung bereits vorhandener Teilnehmer vergeben.
 */
export function generateStarters(
  klasse: ClassId,
  count: number,
  eventJahr: number,
  originMode: OriginMode,
  existing: Starter[],
  praefixe?: StartNrPraefixe,
  /**
   * Nur diese Herkünfte, reihum: Der n-te Starter über alle Klassen (`existing` zählt mit)
   * bekommt die n-te – so hat jede Herkunft Starter in jeder Klasse. Fehlt = gewürfelt.
   */
  herkuenfte?: readonly BeispielHerkunft[],
  /** Mit Geschlecht (Regel 960, Pkt. 3.7); unter der DM `false`. */
  mitGeschlecht = true,
): Starter[] {
  const result: Starter[] = []
  const pool = [...existing]
  for (let i = 0; i < count; i++) {
    const p = generateStarter(klasse, eventJahr, originMode, pool, praefixe, herkuenfte && herkuenfte.length > 0 ? herkuenfte[pool.length % herkuenfte.length] : undefined, mitGeschlecht)
    result.push(p)
    pool.push(p)
  }
  return result
}
