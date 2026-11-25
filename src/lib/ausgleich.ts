import type { AppState, ClassId, Starter } from '../types'
import { CLASS_IDS } from '../domain/classes'
import { AUSGLEICH_STUFE_VORGABE, ausgleichKg } from '../domain/gewicht'
import { sortedByStartNr } from '../domain/startnumbers'
import { sollgewichtOf } from '../config/catalog'
import { besetzungText, zeigtCoPilot } from './besetzung'

// „Ausgleichsgewichte“: die Gewichtsliste für den Steg, je Klasse ein Blatt (Vorbild: Blätter
// „Gewichte_Druck_K…“ der Excel-Mappe). Wer am Steg die Gewichte ins Boot legt, liest hier je
// Startnummer das Ausgleichsgewicht ab und hakt es je Lauf ab. Rein, ohne DOM.
//
// Das Ausgleichsgewicht rechnet EINE Funktion ({@link ausgleichVon}) für diese Liste, die Liste nach Regel 960
// Pkt. 3.7 (lib/teamListe.ts), die Verwiegung und das Steg-Gerät: Durchschnittsgewicht der Klasse minus gewogenes
// Gewicht, gerundet auf die Abstufung des Ausgleichsgewichts (AppState.ausgleichStufe, Vorgabe 1 kg; ab der
// Hälfte aufwärts, domain/gewicht.ts rundeAufStufe – Nutzer 24.11.2026); nichts, wenn der Starter nicht leichter ist.

export type AusgleichStand = Pick<AppState, 'starters' | 'regelwerk' | 'sollgewicht' | 'ausgleichStufe' | 'boote' | 'coPiloten'>

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
  return ausgleichKg(starter.gewicht, sollgewichtOf(stand.regelwerk, stand.sollgewicht, starter.klasse), stand.ausgleichStufe ?? AUSGLEICH_STUFE_VORGABE)
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
  /** Der Co-Pilot der Klasse; `undefined` = die Klasse fährt ohne (das Feld entfällt), leer = von Hand einzutragen. */
  coPilot: string | undefined
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
        coPilot: zeigtCoPilot(stand, klasse) ? besetzungText(stand.coPiloten, klasse) : undefined,
        zeilen,
        ungewogen: zeilen.filter((z) => z.ausgleich === undefined).length,
      },
    ]
  })
}
