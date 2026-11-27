import type { AppState, ClassId, CoPilot, CoPilotRolle, Starter } from '../types'
import { CLASS_IDS } from '../domain/classes'
import { AUSGLEICH_STUFE_VORGABE, ausgleichKg } from '../domain/gewicht'
import { sortedByStartNr } from '../domain/startnumbers'
import { sollgewichtOf } from '../config/catalog'
import { besetzungsKlassen, besetzungText, CO_PILOT_ROLLEN, coPilotName, zeigtCoPilot } from './besetzung'

// „Ausgleichsgewichte“: die Gewichtsliste für den Steg, je Klasse ein Blatt (Vorbild: Blätter
// „Gewichte_Druck_K…“ der Excel-Mappe). Wer am Steg die Gewichte ins Boot legt, liest hier je
// Startnummer das Ausgleichsgewicht ab und hakt es je Lauf ab. Rein, ohne DOM.
//
// Das Ausgleichsgewicht rechnet EINE Funktion ({@link ausgleichVon}) für diese Liste, die Liste nach Regel 960
// Pkt. 3.7 (lib/teamListe.ts), die Verwiegung und das Steg-Gerät: Durchschnittsgewicht der Klasse minus gewogenes
// Gewicht, gerundet auf die Abstufung des Ausgleichsgewichts (AppState.ausgleichStufe, Vorgabe 1 kg; ab der
// Hälfte aufwärts, domain/gewicht.ts rundeAufStufe – Nutzer 24.11.2026); nichts, wenn der Starter nicht leichter ist.
//
// Seit 26.11.2026 (R11-07) auch die Co-Piloten ({@link coPilotAusgleichVon}): Bei wechselnden Co-Piloten muss „das
// Gesamtgewicht in der jeweiligen Klasse und jedem Lauf gleich“ sein (DM-Reglement C3) – wer leichter ist als der
// schwerste Co-Pilot seiner Klasse (bzw. aller Klassen mit Startern, AppState.coPilotAusgleich), bekommt den Unterschied, mit
// derselben Abstufung und Rundung wie ein Fahrer ({@link ausgleichAufStufe}). Getrennt vom Ausgleich des Fahrers.

export type AusgleichStand = Pick<AppState, 'starters' | 'regelwerk' | 'sollgewicht' | 'ausgleichStufe' | 'boote' | 'coPiloten' | 'coPilotAusgleich'>

/**
 * Was die Rechnung braucht. `ausgleichStufe` fehlt nur, wo es keine Veranstaltung gibt (Übung auf dem Gerät,
 * wkr/uebung.ts) – dann gilt die Vorgabe {@link AUSGLEICH_STUFE_VORGABE}. Wer einen Stand hat, gibt ihn ganz.
 */
export type AusgleichRechnung = Pick<AppState, 'regelwerk' | 'sollgewicht'> & Partial<Pick<AppState, 'ausgleichStufe'>>

export interface AusgleichZeile {
  starter: Starter
  /**
   * Ausgleichsgewicht in kg, ein Vielfaches der Abstufung (bei 0,5 kg also auch „1,5“); `null` = gewogen, keines
   * nötig; `undefined` = noch nicht gewogen. Die Liste schreibt den dritten Fall aus („nicht gewogen“): Ein leeres
   * Feld hieße am Steg „kein Ausgleich nötig“ – und ein zu leichter Starter führe ohne Gewicht.
   */
  ausgleich: number | null | undefined
}

/**
 * Das Ausgleichsgewicht eines Starters – die EINE Rechnung für die Liste „Ausgleichsgewichte“, die Liste nach Regel 960
 * Pkt. 3.7, die Verwiegung und das Steg-Gerät der WKR-Erfassung ({@link ausgleichAmSteg}): Durchschnittsgewicht der
 * Klasse (eigener Wert der Veranstaltung, sonst der des Regelwerks) minus gewogenes Gewicht, gerundet auf die Abstufung
 * der Veranstaltung (24.11.2026), über domain/gewicht.ts `ausgleichKg`. Werte wie {@link AusgleichZeile}.
 */
export function ausgleichVon(stand: AusgleichRechnung, starter: Pick<Starter, 'klasse' | 'gewicht'>): number | null | undefined {
  return ausgleichAufStufe(stand, starter.gewicht, sollgewichtOf(stand.regelwerk, stand.sollgewicht, starter.klasse))
}

/**
 * DIE Rechnung „Bezugsgewicht minus gewogenes Gewicht, gerundet auf die Abstufung der Veranstaltung“ – für Fahrer
 * ({@link ausgleichVon}, Bezug = Durchschnittsgewicht der Klasse) und Co-Piloten ({@link coPilotAusgleichVon}, Bezug =
 * schwerster Co-Pilot; R11-07, 26.11.2026). Werte wie domain/gewicht.ts `ausgleichKg`.
 */
export function ausgleichAufStufe(stand: Partial<Pick<AppState, 'ausgleichStufe'>>, gewicht: number | undefined, bezug: number): number | null | undefined {
  return ausgleichKg(gewicht, bezug, stand.ausgleichStufe ?? AUSGLEICH_STUFE_VORGABE)
}

/** Was die Rechnung für die Co-Piloten braucht (R11-07, 26.11.2026). */
export type CoPilotStand = Pick<AppState, 'regelwerk' | 'starters' | 'coPiloten' | 'coPilotAusgleich'> & Partial<Pick<AppState, 'ausgleichStufe'>>

/**
 * Die Person einer Rolle, wenn sie für den Ausgleich zählt: nur mit Namen. Prüfbefund 27.11.2026: Wer den Namen eines
 * Ersatzes löscht („er fällt weg“), lässt sein Gewicht im Stand stehen (lib/besetzung.ts setzeCoPilotName – beim
 * Neutippen eines Namens soll es nicht verloren gehen); als Bezug gälte sonst eine Person, die es nicht mehr gibt, und
 * der eingeteilte Co-Pilot bekäme Ballast gegen niemanden. Auslegung 27.11.2026 (offen zur Bestätigung).
 */
function benannt(stand: Pick<CoPilotStand, 'coPiloten'>, klasse: ClassId, rolle: CoPilotRolle): CoPilot | undefined {
  const p = stand.coPiloten[klasse]?.[rolle]
  return p && p.name.trim() !== '' ? p : undefined
}

/**
 * Die Klassen, deren Co-Piloten bei „über alle Co-Piloten“ eine Gruppe bilden (Prüfbefund 27.11.2026): die Klassen, in
 * denen Starter stehen – nur deren Co-Piloten sitzen je im Boot. Ein Co-Pilot einer Klasse ohne Starter (etwa von
 * „Beispiel-Co-Piloten“, die jede Klasse mit Co-Pilot füllen) darf den Bezug nicht hochziehen. Die eigene Klasse zählt
 * immer mit (der Block „Besetzung“ zeigt auch dort einen Wert). Solange noch gar kein Starter eingetragen ist, gelten
 * alle Klassen der Besetzung (lib/besetzung.ts besetzungsKlassen) – sonst zeigte der Block bis dahin Werte je Klasse,
 * obwohl „über alle“ gewählt ist. Auslegung 27.11.2026 (offen zur Bestätigung).
 */
function ausgleichsKlassen(stand: CoPilotStand, klasse: ClassId): ClassId[] {
  if (stand.coPilotAusgleich !== 'alle') return [klasse]
  const mitStartern = new Set(stand.starters.map((p) => p.klasse))
  return mitStartern.size === 0 ? [...new Set([...besetzungsKlassen(stand), klasse])] : [...new Set([...mitStartern, klasse])]
}

/**
 * Ausgleichsgewicht eines Co-Piloten (R11-07, 26.11.2026):
 * - eine Zahl (kg, Vielfaches der Abstufung; auch 0 = auf 0 gerundet) bzw. `null` = gewogen, keines nötig (er ist der
 *   schwerste seiner Gruppe);
 * - `'fehlt'` = nicht gewogen, aber andere Co-Piloten seiner Gruppe sind es – dann fehlt sein Wert wirklich;
 * - `undefined` = er hat kein Gewicht und niemand in seiner Gruppe hat eines (keiner wird ausgeglichen) bzw. die
 *   Rolle ist nicht besetzt – oder hat keinen Namen ({@link benannt}, 27.11.2026).
 *
 * Gruppe nach AppState.coPilotAusgleich: `klasse` = Co-Pilot und Ersatz seiner Klasse; `alle` = die Co-Piloten der
 * Klassen mit Startern ({@link ausgleichsKlassen}). Bezug = der schwerste gewogene, benannte Co-Pilot der Gruppe.
 * Auslegung 26.11.2026 (offen zur Bestätigung): Wer kein Gewicht hat, zählt für den Bezug nicht – „nicht gewogen“
 * steht nur da, wo andere seiner Gruppe gewogen sind.
 */
export function coPilotAusgleichVon(stand: CoPilotStand, klasse: ClassId, rolle: CoPilotRolle): number | null | 'fehlt' | undefined {
  const selbst = benannt(stand, klasse, rolle)
  if (!selbst) return undefined
  const gewichte = ausgleichsKlassen(stand, klasse).flatMap((k) => CO_PILOT_ROLLEN.map((r) => benannt(stand, k, r)?.gewicht).filter((kg): kg is number => kg !== undefined))
  if (gewichte.length === 0) return undefined
  if (selbst.gewicht === undefined) return 'fehlt'
  return ausgleichAufStufe(stand, selbst.gewicht, Math.max(...gewichte))
}

/** Ein Co-Pilot, wie er auf einer Liste steht: Rolle, Name (leer = von Hand einzutragen) und sein Ausgleichsgewicht. */
export interface CoPilotZeile {
  rolle: CoPilotRolle
  name: string
  /** Wie {@link coPilotAusgleichVon}; gedruckt wird nur eine Zahl über 0 bzw. „nicht gewogen“ – in Klammern. */
  ausgleich: number | null | 'fehlt' | undefined
}

/**
 * Die Co-Piloten einer Klasse für eine Liste (R11-07, 26.11.2026: „Beide Co-Piloten stehen untereinander auf den
 * Listen, damit beim Steg klar ist, wer die Alternative ist.“): `undefined` = die Klasse fährt ohne (das Feld entfällt,
 * lib/besetzung.ts zeigtCoPilot); sonst immer der eingeteilte Co-Pilot (auch leer, zum Eintragen von Hand) und, wenn
 * mit Namen eingetragen, darunter der Ersatz (ein Gewicht ohne Namen gibt kein leeres Feld „Ersatz-Co-Pilot“,
 * Prüfbefund 27.11.2026). Nie das Körpergewicht – nur das Ausgleichsgewicht.
 */
export function coPilotZeilen(stand: CoPilotStand, klasse: ClassId): CoPilotZeile[] | undefined {
  if (!zeigtCoPilot(stand, klasse)) return undefined
  return CO_PILOT_ROLLEN.filter((r) => r === 'haupt' || benannt(stand, klasse, r) !== undefined).map((rolle) => ({
    rolle,
    name: coPilotName(stand.coPiloten, klasse, rolle),
    ausgleich: coPilotAusgleichVon(stand, klasse, rolle),
  }))
}

/**
 * Das Ausgleichsgewicht für das Steg-Gerät der WKR-Erfassung (Nutzer 24.11.2026, WKR_ANNAHMEN AG1/AG2): kg wie
 * {@link ausgleichVon} (ein Vielfaches der Abstufung, also ggf. mit Nachkommastelle – das Gerät schreibt es mit dem
 * Dezimalzeichen der Liste), `0` = gewogen, keines nötig oder auf 0 gerundet; `'fehlt'` = noch nicht gewogen (wird
 * in der Verwiegung nachgetragen und kommt dann mit der nächsten Sicht von selbst aufs Gerät). `null` = die Klasse hat kein Durchschnittsgewicht (Regelwerk bzw.
 * Veranstaltung nennen keines) – dann steht am Steg gar nichts. Nie das Körpergewicht oder das Durchschnittsgewicht:
 * Die Sicht der Liste (wkr/sicht.ts) trägt nur diesen Wert.
 */
export function ausgleichAmSteg(stand: AusgleichRechnung, starter: Pick<Starter, 'klasse' | 'gewicht'>): number | 'fehlt' | null {
  if (!(sollgewichtOf(stand.regelwerk, stand.sollgewicht, starter.klasse) > 0)) return null
  const kg = ausgleichVon(stand, starter)
  return kg === undefined ? 'fehlt' : (kg ?? 0)
}

export interface AusgleichListe {
  klasse: ClassId
  /** Durchschnittsgewicht der Klasse in kg (0 = das Regelwerk nennt keines). */
  soll: number
  /** Das Boot der Klasse aus der Besetzung; leer = nicht festgelegt (das Feld bleibt zum Eintragen). */
  boot: string
  /**
   * Die Co-Piloten der Klasse ({@link coPilotZeilen}, 26.11.2026): `undefined` = die Klasse fährt ohne (das Feld
   * entfällt); sonst der eingeteilte (Name leer = von Hand einzutragen) und, wenn eingetragen, der Ersatz.
   */
  coPiloten: CoPilotZeile[] | undefined
  /** Die Starter der Klasse nach Startnummer. */
  zeilen: AusgleichZeile[]
  /** So viele Starter der Klasse sind noch nicht gewogen. */
  ungewogen: number
}

/**
 * Je Klasse mit Startern eine Liste, in der Reihenfolge der Klassen (E, 1, 2 …). `klassen`
 * schränkt ein (die Auswahl im Reiter); fehlt = alle.
 */
export function ausgleichListen(stand: AusgleichStand, klassen?: readonly ClassId[]): AusgleichListe[] {
  return CLASS_IDS.filter((k) => !klassen || klassen.includes(k)).flatMap((klasse) => {
    const starter = sortedByStartNr(stand.starters.filter((p) => p.klasse === klasse))
    if (starter.length === 0) return []
    const soll = sollgewichtOf(stand.regelwerk, stand.sollgewicht, klasse)
    const zeilen = starter.map((p) => ({ starter: p, ausgleich: ausgleichVon(stand, p) }))
    return [
      {
        klasse,
        soll,
        boot: besetzungText(stand.boote, klasse),
        coPiloten: coPilotZeilen(stand, klasse),
        zeilen,
        ungewogen: zeilen.filter((z) => z.ausgleich === undefined).length,
      },
    ]
  })
}
