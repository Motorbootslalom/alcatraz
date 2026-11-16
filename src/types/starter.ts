// Starter mit Klasse, Geschlecht und Art der Startnummern.

export type ClassId = 'E' | '1' | '2' | '3' | '4' | '5' | '6' | '7'

/**
 * Geschlecht eines Starters, wie Regel 960 (Pkt. 3.7 „Sex“) es auf der Liste je Team verlangt:
 * M (männlich), F (weiblich), D (divers), nA (keine Angabe) – Entscheidung des Nutzers vom
 * 15.11.2026 (domain/geschlecht.ts).
 */
export type Geschlecht = 'M' | 'F' | 'D' | 'nA'

export interface Starter {
  id: string
  startNr: string
  vorname: string
  nachname: string
  /** Vereinsname (immer gesetzt, kann als Herkunft angezeigt werden) */
  verein: string
  /** Bundesland des Vereins */
  bundesland: string
  /** Staat, für den ein Starter antritt (internationale Wettkämpfe); fehlt bei rein nationalen. */
  land?: string
  /** Geburtsdatum ISO (YYYY-MM-DD) */
  geburtsdatum: string
  klasse: ClassId
  /**
   * Konfektionsgröße (XS…XXXL), siehe lib/sizes. Bestimmt die Reihenfolge der
   * klassenbasierten Startnummern (klein → große Nummer). Kann leer sein.
   */
  groesse: string
  /** Gewicht aus der Verwiegung in kg; fehlt, solange nicht gewogen wurde. */
  gewicht?: number
  /**
   * Geschlecht, freiwillig: `M`, `F`, `D` oder `nA` (keine Angabe); fehlt = nicht erfasst. Gebraucht
   * allein für die Liste der Fahrer je Team nach Regel 960, Pkt. 3.7 („The list must contain:
   * … Sex“); die Wertung kennt es nicht. Eine Angabe zur Person: in Sicherung und
   * Teilnehmerdaten, nie in der Vorlage.
   */
  geschlecht?: Geschlecht
  /**
   * Zählt für die Pokalauswertung. Im Stand steht nur `false` – wer das Feld nicht hat, zählt.
   * Wirkt erst, wenn „nur ausgewählte Starter zählen“ eingeschaltet ist
   * (`AppState.pokal.nurAuswahl`); die Auswahl bleibt sonst stehen. Sie hängt am Starter und
   * reist deshalb mit Sicherung und Teilnehmerdaten, nicht mit der Vorlage.
   */
  pokal?: false
}

/**
 * Art der Startnummern. Eine Veranstaltung nutzt genau eine davon:
 * klassenbasiert (E01, 101, 312 …) oder klassisch fortlaufend (1, 2, 3 …).
 * Die Nummer steht in beiden Fällen in `Starter.startNr`; intern wird ein
 * Starter immer über seine `id` angesprochen, nie über die Startnummer.
 */
export type StartNrMode = 'klasse' | 'klassisch'
