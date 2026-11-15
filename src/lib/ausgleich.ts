import type { AppState, ClassId, Starter } from '../types'
import { CLASS_IDS } from '../domain/classes'
import { ausgleichKg } from '../domain/gewicht'
import { sortedByStartNr } from '../domain/startnumbers'
import { sollgewichtOf } from '../config/catalog'
import { besetzungText, zeigtCoPilot } from './besetzung'

// „Ausgleichsgewichte“: die Gewichtsliste für den Steg, je Klasse ein Blatt (Vorbild: Blätter
// „Gewichte_Druck_K…“ der Excel-Mappe). Wer am Steg die Gewichte ins Boot legt, liest hier je
// Startnummer das Ausgleichsgewicht ab und hakt es je Lauf ab. Rein, ohne DOM.
//
// Das Ausgleichsgewicht rechnet dieselbe Funktion wie die Verwiegung (domain/gewicht.ts
// `ausgleichKg`): Durchschnittsgewicht der Klasse minus gewogenes Gewicht, auf ganze kg
// gerundet; nichts, wenn der Starter nicht leichter ist.

export type AusgleichStand = Pick<AppState, 'starters' | 'regelwerk' | 'sollgewicht' | 'boote' | 'coPiloten'>

export interface AusgleichZeile {
  starter: Starter
  /**
   * Ausgleichsgewicht in ganzen kg; `null` = gewogen, keines nötig; `undefined` = noch nicht
   * gewogen. Die Liste schreibt den dritten Fall aus („nicht gewogen“): Ein leeres Feld hieße
   * am Steg „kein Ausgleich nötig“ – und ein zu leichter Starter führe ohne Gewicht.
   */
  ausgleich: number | null | undefined
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
    const zeilen = starter.map((p) => ({ starter: p, ausgleich: ausgleichKg(p.gewicht, soll) }))
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
