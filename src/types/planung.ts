import type { ClassId, Starter } from './starter'
import type { OriginMode } from './einstellungen'

// Planung: Parcours mit Spuren, Boote, klassische Startnummern, der Planungsstand PlanState und die
// festgeschriebenen Startpläne des Parallelslaloms.

export type WechselFaktor = 1 | 2 | 3 | 4

/** Boot-Typ: kleines Boot (Klassen E–3) oder großes Boot (Klassen 4–7). */
export type BoatType = 'klein' | 'gross'

/** Anzahl der vorhandenen Boote je Typ. */
export interface BoatConfig {
  klein: number
  gross: number
}

/** Welche Verzahnung die einheitliche klassische Startnummer festlegt. */
export type RunningNumberSource = 'manoever' | 'parallel'

/**
 * Klassische, fortlaufende Startnummern (1, 2, 3, …), die den Startern in der
 * Reihenfolge der Verzahnung zugewiesen werden – zusätzlich zu den
 * klassenbasierten Startnummern (E01, 312, …).
 */
export interface RunningNumberConfig {
  /** Klassische Nummerierung anzeigen/zuweisen. */
  enabled: boolean
  /** Maßgebliche Verzahnung für die Reihenfolge (Standard: Manövrieren). */
  source: RunningNumberSource
  /** Startwert der Nummerierung (Standard 1). */
  start: number
  /** Rohtext der zu überspringenden (fehlenden) Nummern, z. B. "7, 13, 20". */
  skipText: string
}

/** Ein Element innerhalb einer Spur: entweder ein Klassen-Block oder eine Pause. */
export interface ClassItem {
  kind: 'class'
  klasse: ClassId
}

export interface PauseItem {
  kind: 'pause'
  id: string
  /** Länge der Pause in Takten (die Spur setzt so viele Starts aus). */
  length: number
}

export type TrackItem = ClassItem | PauseItem

export interface Parcours {
  id: string
  name: string
  /** Welche Klassen auf diesem Parcours fahren */
  classIds: ClassId[]
  wechselFaktor: WechselFaktor
  /**
   * Manuelle Spur-Anordnung. Jede innere Liste ist eine Spur mit ihren Klassen-
   * und Pausen-Blöcken in Abarbeitungsreihenfolge. Wenn undefined, wird
   * automatisch verteilt. Länge entspricht dem wechselFaktor.
   */
  tracks?: TrackItem[][]
}

export interface PlanState {
  eventName: string
  eventJahr: number
  originMode: OriginMode
  starters: Starter[]
  parcoursList: Parcours[]
  /** Vorhandene Boote je Typ (Ressourcenschranke für die Verzahnung). */
  boats: BoatConfig
  /** Wenn true, fährt Klasse 4 ausnahmsweise mit einem kleinen Boot. */
  class4Small: boolean
  /**
   * Parallel-Slalom: Die Klassen eines Bootstyps stehen nach ihrer kleinsten Startnummer
   * (statt in ihrer festen Folge). Sinnvoll bei genutzten klassischen Startnummern.
   */
  parallelOrderByStartNr: boolean
  /**
   * Parallelslalom: strenge Klassentrennung – Paare nur innerhalb einer Klasse, ein Dummy je
   * ungerader Klasse (Regel 960, Pkt. 4.4: „Two drivers from the same class shall start at the
   * same time“). Aus: Der Übrige einer ungeraden Klasse fährt gegen den ersten der nächsten
   * Klasse im gleichen Boot. Fehlt die Angabe, gilt streng.
   */
  parallelStreng?: boolean
  /** Festgeschriebene Startpläne des Parallelslaloms je Runde (planung/parallelRunden.ts). */
  parallelPlaene?: ParallelPlaene
  /** Klassische fortlaufende Startnummern (nach Verzahnung vergeben). */
  runningNumbers: RunningNumberConfig
}

/**
 * Runde des Parallelslaloms (Regel 960, Pkt. 5.2.2: „Parallel slalom preliminary heat /
 * semi-finals / finals“; Pkt. 5.2.6: „must re-run both attempts“). Eine Wiederholung heißt
 * `rerun-<runde>-<n>` (`rerun-pre-1`, `rerun-semi-2`): die n-te Wiederholung zum Vorlauf bzw. zum Halbfinale.
 *
 * Seit 21.11.2026 (Auftrag des Nutzers: „Kleines und großes Finale ist getrennt, wie Vorlauf und Halbfinale. Das
 * sind 4 in sich geschlossene Listen/Auswertungen.“) sind die Finals zwei Runden: `small` = Kleines Finale („compete
 * for the 3rd and 4th place“, Pkt. 4.4), gefahren vor `final` = Finale („compete for the 1st and 2nd place“).
 */
export type ParallelRunde = 'pre' | 'semi' | 'small' | 'final' | `rerun-${string}`

/**
 * Ein Start eines festgeschriebenen Plans: wer auf Racecourse A und B fährt. Gehalten werden
 * Starter-IDs, nie Startnummern (Nummern dürfen sich ändern); `null` ist der Dummy.
 */
export interface ParallelStartFest {
  a: string | null
  b: string | null
  /**
   * 1. oder 2. Attempt des Paares: Der frühere Start im Plan ist der 1. Attempt, im 2. sind
   * die Racecourses getauscht (Pkt. 4.4: „the drivers shall change boats and courses for the
   * second attempt“).
   */
  attempt: 1 | 2
  /** Block der Startreihenfolge, ab 0 (Organisation, nicht Regel 960). */
  block: number
  /** Bootstyp des Paares – steht hier, damit er auch gilt, wenn ein Starter nicht mehr da ist. */
  boot: BoatType
  /**
   * Die Klasse, für die dieser Start festgeschrieben wurde – nur in den Runden nach dem Vorlauf
   * (Halbfinale, Kleines Finale, Finale, Wiederholung): Sie werden je Klasse festgeschrieben und
   * gelöst, und der Plan einer Runde sammelt die Starts aller Klassen. Im Vorlauf fehlt die Angabe.
   * Um welche Plätze ein Finale geht, sagt seit 21.11.2026 die Runde (`small`/`final`) – das
   * frühere Feld `finale` entfällt (state/migrate.ts teilt alte Stände auf).
   */
  klasse?: ClassId
}

/** Der festgeschriebene Startplan einer Runde: Er wird nicht neu gerechnet. */
export interface ParallelPlanFest {
  runde: ParallelRunde
  starts: ParallelStartFest[]
}

export type ParallelPlaene = Partial<Record<ParallelRunde, ParallelPlanFest>>
