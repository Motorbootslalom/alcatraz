import type { PokalPlatzVariante, PokalVariante } from '../config/schema'
import type { ClassId } from './starter'
import type { OriginStyle } from './einstellungen'

// Erfasste Werte (Eingaben) und was die Wertung daraus macht: Mannschaftswertung, Streichläufe, Stand
// und Fassungen der Wertungslisten, Disziplinen.

/**
 * Pokalauswertung je Herkunft: was die Veranstaltung abweichend von Regelwerk und
 * Einstellungen festlegt (config/pokal.ts `pokalRegeln`). Gehört zur Veranstaltung wie die
 * Wertung – in Sicherung und Vorlage.
 */
export interface PokalEinstellungen {
  /** Variante → an/aus, und nur was von der Vorgabe des Regelwerks abweicht. */
  varianten: Partial<Record<PokalVariante, boolean>>
  /** Eigene Punkte für Platz 1, 2, 3 …; fehlt = die Vorgabe aus einstellungen.yaml. */
  punkte: Partial<Record<PokalPlatzVariante, number[]>>
  /** UIM: eigene Zahl der Besten je Herkunft; fehlt = die des Regelwerks (5). */
  beste?: number
  /** UIM: eigene Mindestzahl der Starter je Herkunft; fehlt = die des Regelwerks (5). */
  mindestens?: number
  /** Nur Starter zählen, die im Reiter „Starter“ dafür ausgewählt sind (`Starter.pokal`). */
  nurAuswahl: boolean
}

/**
 * Erfasste Werte der Wettkampfrichter-Listen: Lauf-Schlüssel → Starter-ID → Feld-Kennung →
 * Rohwert, z. B. `eingaben["manoevrieren/1"]["p_ab12"]["t1a|hin seiteA"] = "5"`.
 *
 * - Der Lauf-Schlüssel nennt Disziplin und Lauf (lib/eingaben.ts `laufSchluessel`); Listen
 *   ohne Lauf (Knoten) stehen unter Lauf 0.
 * - Die Zeile ist die **Starter-ID**, nie die Startnummer: Nummern dürfen sich ändern, und
 *   die Klasse folgt aus dem Starter.
 * - Die Feld-Kennung (config/feld.ts) sagt, *was* erfasst ist, nicht wo es steht: Bojen,
 *   Fehler und Zeiten sind in jedem Aufbau dasselbe Feld; Disq., Bemerkung und der Haken
 *   „erfasst“ gehören zu ihrer Liste (`disq@steg`).
 *
 * Jede Zelle ist damit für sich benannt. Erfassen später mehrere Wettkampfrichter an eigenen
 * Geräten, lassen sich ihre Eingaben Zelle für Zelle zusammenführen (Action `SET_EINGABEN`).
 */
export type Eingaben = Record<string, Record<string, Record<string, string>>>

/**
 * Wie viele Läufe je Starter gestrichen werden. `auto` ist die Regel der Deutschen
 * Meisterschaft: ab drei Läufen einer, sonst keiner. Eine Zahl legt der Rennleiter fest
 * (z. B. 1 bei zwei Läufen: der schlechtere wird gestrichen; 0: alle zählen).
 */
export type Streichlaeufe = 'auto' | number

/**
 * Wann sich eine Wertungsliste zuletzt geändert hat (lib/listenStand.ts). `zeit` fehlt, wenn
 * der Zeitpunkt nicht bekannt ist – etwa bei einem Stand aus der Zeit vor dieser Angabe: Die
 * Liste zeigt dann nichts statt eines erfundenen Zeitpunkts.
 */
export interface ListenStand {
  /** Prüfsumme dessen, was auf der Liste steht. */
  inhalt: number
  /** Zeitpunkt der letzten Änderung in Millisekunden seit 1970. */
  zeit?: number
}

/**
 * Die Disziplinen der Wertung nach Regel 960: Manövrieren („manoeuvring“) und Parallelslalom
 * („parallel slalom“). Unter der DM gibt es nur das Manövrieren.
 */
export type WertungsDisziplin = 'manoever' | 'parallel'

/**
 * „Disziplin nicht werten“ je Disziplin und Klasse (lib/disziplinen.ts): Die Disziplin zählt für
 * die genannten Klassen nicht in Einzel- und Mannschaftswertung – etwa weil sie in einer Klasse
 * abgebrochen wurde und der O.O.D. sie dann auch für fertige Klassen streicht. Regel 960 regelt
 * das nicht (nur Pkt. 5.1: „Drivers must complete the relevant stage and cross the finishing
 * line in order to be classified for the stage.“) – eine Entscheidung des O.O.D. vor Ort.
 */
export type NichtWerten = Partial<Record<WertungsDisziplin, ClassId[]>>

export type ErgebnisNamen = 'voll' | 'kurz' | 'ohne'
/** Herkunft auf den Wertungslisten: gar nicht oder in einer der Darstellungen der Listen. */
export type ErgebnisHerkunft = 'aus' | OriginStyle
export type ErgebnisFassung = 'aushang' | 'intern'
export interface ErgebnisListenOptionen {
  aushang: { namen: ErgebnisNamen; herkunft: ErgebnisHerkunft }
  intern: { herkunft: ErgebnisHerkunft }
}
