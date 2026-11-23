import { parseClassNumber, startNrPrefix, type StartNrPraefixe } from './startnumbers'
import type { ClassId, EventKind, OriginMode, Starter } from '../types'
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

/**
 * Anteile der Klassen an einem Beispiel-Starterfeld, in Prozent (Wunsch des Nutzers vom 21.11.2026:
 * „Wenige Klasse E/Dolphin, dann werden es zu Klasse 4 und 5 die meisten, 6 wieder relativ wenig und
 * dann noch mal mehr … bei Klasse 7“). Herkunft: Anteile aus drei Starterlisten 2025/2026 (53, 151 und
 * 56 Starter) – ausgewertet wurden nur diese Anteile, keine Namen, Vereine oder Daten aus den Listen.
 * Unter UIM gilt dasselbe (Dolphin = E); fehlende Klassen (6, 7) fallen weg, der Rest wird neu gewichtet.
 */
export const BEISPIEL_KLASSEN_ANTEILE: Readonly<Record<string, number>> = { E: 4, 1: 9, 2: 13, 3: 15, 4: 15, 5: 18, 6: 11, 7: 15 }

/** Größenordnung eines Beispiel-Starterfelds: Clubmeisterschaft, Meisterschaft der Vereine, der Bundesländer/Länder. */
export type BeispielFeldArt = 'club' | 'verein' | 'land'

/**
 * Wie viele Starter ein Beispielfeld je Art insgesamt hat, von–bis (Wunsch des Nutzers vom 21.11.2026:
 * Clubmeisterschaft ungefähr 10–20, Meisterschaft mit Vereinen 45–75, Bundesland und Land 100–160).
 */
export const BEISPIEL_STARTERZAHL: Readonly<Record<BeispielFeldArt, readonly [number, number]>> = {
  club: [10, 20],
  verein: [45, 75],
  land: [100, 160],
}

/**
 * Die Art des Felds aus Art und Herkunft der Veranstaltung. Auslegung vom 21.11.2026: Die Clubmeisterschaft
 * geht vor (gleich welche Herkunft); eine Meisterschaft ohne Herkunft zählt wie eine mit Vereinen – genannt
 * hat der Nutzer sie nicht. Nutzer 21.11.2026 (Fragenseite R6-01): „Clubmeisterschaft ist eine Meisterschaft
 * ohne Vereine, jedoch mit mehreren Klassen auf einem Blatt.“ Daraus (21.11.2026): Die Größe 10–20 bleibt
 * (vom Nutzer so genannt); die Starter bekommen keine Herkunft (beispielHerkunft, BS1); mehrere Klassen auf
 * einem Blatt sind die gemeinsamen WKR-Bögen der Clubmeisterschaft (lib/wkrListen.ts, „Papier sparen“) –
 * die Wertungslisten bleiben je Klasse (Rangliste je Klasse, Entscheidung 12.11.2026) – bestätigt 22.11.2026 (R7-49).
 */
export function beispielFeldArt(eventKind: EventKind, originMode: OriginMode): BeispielFeldArt {
  if (eventKind === 'club') return 'club'
  return originMode === 'bundesland' || originMode === 'land' ? 'land' : 'verein'
}

/**
 * Die Herkunft der Beispielstarter: die der Veranstaltung (Entscheidung 15.11.2026) – außer bei der
 * Clubmeisterschaft. Auslegung BS1 vom 21.11.2026 (aus R6-01 „ohne Vereine“, bestätigt 22.11.2026 R7-48): Dort
 * bekommen sie nie eine Herkunft, auch wenn die Veranstaltung nach dem Wechsel zur Clubmeisterschaft
 * (SET_EVENT_KIND setzt „ohne“) von Hand wieder eine bekommen hat. Die Einstellung selbst bleibt, wie gewählt.
 */
export function beispielHerkunft(eventKind: EventKind, originMode: OriginMode): OriginMode {
  return eventKind === 'club' ? 'none' : originMode
}

/** Eine Gesamtzahl im Bereich der Art, gleichverteilt aus `zufall` (aus einer Saat, lib/beispielwerte.ts zufallAus). */
export function beispielGesamt(art: BeispielFeldArt, zufall: () => number): number {
  const [von, bis] = BEISPIEL_STARTERZAHL[art]
  return von + Math.min(bis - von, Math.floor(zufall() * (bis - von + 1)))
}

/**
 * Verteilt `gesamt` Starter nach BEISPIEL_KLASSEN_ANTEILE auf die Klassen – Verfahren der größten Reste,
 * damit die Summe genau stimmt. Gleiche Reste: die Klasse mit dem größeren Anteil zuerst, dann die
 * Folge der Klassen. Kleine Felder dürfen in einer Klasse 0 haben (meist E). Eine Klasse ohne Anteil
 * (eigenes Regelwerk) bekommt den Durchschnitt. Unter UIM dieselbe Gesamtzahl auf die Klassen des
 * Regelwerks – bestätigt 21.11.2026 (Fragenseite R6-04).
 *
 * `fest` (BS4, Nutzer 22.11.2026 R7-51: „Manuelle Anpassung soll berücksichtigt werden. Mit einem Reset-Knopf.“; noch
 * zu bestätigen): Von Hand gesetzte Klassen behalten ihre Zahl; nur der Rest max(0, gesamt − Σ fest) wird nach
 * denselben Anteilen und derselben Rundung auf die übrigen verteilt. Ist Σ fest größer als `gesamt`, bleiben die
 * festen stehen und die übrigen bekommen 0 – die Summe weicht dann ab (die Oberfläche zeigt sie).
 * Bestätigt 23.11.2026 (R9-14).
 */
export function verteileAufKlassen(gesamt: number, klassen: readonly ClassId[], fest: Partial<Record<ClassId, number>> = {}): Record<ClassId, number> {
  const feste = klassen.filter((k) => typeof fest[k] === 'number' && Number.isFinite(fest[k]))
  if (feste.length > 0) {
    const festSumme = feste.reduce((s, k) => s + Math.max(0, Math.floor(fest[k]!)), 0)
    const uebrige = verteileAufKlassen(Math.max(0, Math.floor(gesamt) - festSumme), klassen.filter((k) => !feste.includes(k)))
    const out = {} as Record<ClassId, number>
    for (const k of klassen) out[k] = feste.includes(k) ? Math.max(0, Math.floor(fest[k]!)) : uebrige[k]
    return out
  }
  const ergebnis = {} as Record<ClassId, number>
  if (klassen.length === 0) return ergebnis
  const bekannt = Object.values(BEISPIEL_KLASSEN_ANTEILE)
  const mittel = bekannt.reduce((a, b) => a + b, 0) / bekannt.length
  const anteile = klassen.map((k) => BEISPIEL_KLASSEN_ANTEILE[k] ?? mittel)
  const summe = anteile.reduce((a, b) => a + b, 0)
  const n = Math.max(0, Math.floor(gesamt))
  const quoten = anteile.map((a) => (n * a) / summe)
  klassen.forEach((k, i) => (ergebnis[k] = Math.floor(quoten[i])))
  let rest = n - klassen.reduce((s, k) => s + ergebnis[k], 0)
  const folge = klassen.map((_, i) => i).sort((a, b) => quoten[b] - Math.floor(quoten[b]) - (quoten[a] - Math.floor(quoten[a])) || anteile[b] - anteile[a] || a - b)
  for (const i of folge) {
    if (rest <= 0) break
    ergebnis[klassen[i]]++
    rest--
  }
  return ergebnis
}

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

/**
 * Alle Herkünfte, aus denen die Beispieldaten würfeln – je nach Art der Herkunft. Ohne Herkunft
 * (`none`, etwa bei der Clubmeisterschaft) gibt es keine: Die Starter bleiben ohne.
 */
function herkunftsPool(originMode: OriginMode): BeispielHerkunft[] {
  if (originMode === 'none') return []
  if (originMode === 'land') return LAENDER.map((land) => ({ verein: '', bundesland: '', land }))
  if (originMode === 'bundesland') return BUNDESLAENDER.map((bundesland) => ({ verein: '', bundesland }))
  return CLUBS.map((c) => ({ verein: c.name, bundesland: c.bundesland }))
}

/**
 * So viele verschiedene Herkünfte, zufällig gewählt – für ein Beispiel-Starterfeld mit wenigen
 * Herkünften, an dem sich die Mannschaftswertung prüfen lässt. Welche Art, sagt `originMode`:
 * die Herkunft der Veranstaltung (Verein, Bundesland, Land), gleich unter welchem Regelwerk
 * (Entscheidung des Nutzers vom 15.11.2026, components/BeispieldatenPanel.vue). Mehr, als es gibt,
 * sind alle; ohne Herkunft (`none`) keine.
 */
export function beispielHerkuenfte(originMode: OriginMode, anzahl: number): BeispielHerkunft[] {
  const pool = herkunftsPool(originMode)
  if (pool.length === 0) return []
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
  } else if (originMode === 'none') {
    // Die Veranstaltung führt keine Herkunft (Clubmeisterschaft): Die Starter haben keine.
    verein = ''
    bundesland = ''
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
