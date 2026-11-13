import type { RawAufbau } from './config/schema'

export type ClassId = 'E' | '1' | '2' | '3' | '4' | '5' | '6' | '7'

/** Welche Herkunft gezeigt wird. `none` blendet sie aus (Clubmeisterschaft). */
export type OriginMode = 'verein' | 'bundesland' | 'none'

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

export interface Starter {
  id: string
  startNr: string
  vorname: string
  nachname: string
  /** Vereinsname (immer gesetzt, kann als Herkunft angezeigt werden) */
  verein: string
  /** Bundesland des Vereins */
  bundesland: string
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
   * Parallel-Slalom im internationalen Modus: nur bis Klasse 5 (6/7 ignoriert),
   * Klasse E heißt „Dolphin". Standard: true.
   */
  parallelInternational: boolean
  /**
   * Parallel-Slalom: Reihenfolge innerhalb der Bootstyp-Pools nach Startnummer
   * (statt nach Klasse). Sinnvoll bei genutzten klassischen Startnummern.
   */
  parallelOrderByStartNr: boolean
  /** Klassische fortlaufende Startnummern (nach Verzahnung vergeben). */
  runningNumbers: RunningNumberConfig
}

/**
 * Art der Startnummern. Eine Veranstaltung nutzt genau eine davon:
 * klassenbasiert (E01, 101, 312 …) oder klassisch fortlaufend (1, 2, 3 …).
 * Die Nummer steht in beiden Fällen in `Starter.startNr`; intern wird ein
 * Starter immer über seine `id` angesprochen, nie über die Startnummer.
 */
export type StartNrMode = 'klasse' | 'klassisch'

/** Schreibweise der Herkunft auf Listen. */
export type OriginStyle = 'lang' | 'kurz'

/** Art der Veranstaltung – steuert Vorgaben für Listen und Wertung. */
export type EventKind = 'meisterschaft' | 'club'

/**
 * WKR-Einteilung: Name des Wettkampfrichters je Parcours (Kennung aus der Verzahnung) und
 * Liste (`SheetTypeId`), siehe lib/einteilung.ts. Personennamen – nicht für die Vorlage.
 */
export type Einteilung = Record<string, Record<string, string>>

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

/** Aktuelle Fassung des gespeicherten Zustands, siehe state/migrate.ts. */
export const SCHEMA_VERSION = 1

/**
 * Gesamter Zustand einer Veranstaltung. Liegt ausschließlich lokal im Browser
 * (localStorage) und lässt sich als Datei sichern. Die Planungsfelder sind
 * bewusst flach gehalten ({@link PlanState}), damit die Fachlogik aus dem
 * Verzahnungs-Prototyp unverändert darauf rechnet.
 */
export interface AppState extends PlanState {
  schemaVersion: typeof SCHEMA_VERSION
  eventKind: EventKind
  startNrMode: StartNrMode
  /** Regelwerk der Ausschreibung, Kennung aus `config/regelwerke.yaml` (z. B. `dm-2026`). */
  regelwerk: string
  /**
   * Aufbau des Manövrier-Parcours: Kennung eines mitgelieferten Aufbaus aus
   * `config/aufbauten/*.yaml` (z. B. `alcatraz`) oder eines eigenen aus `eigeneAufbauten`.
   */
  aufbau: string
  /**
   * Eigene Aufbauten des Veranstalters (Assistent oder YAML-Datei), in der Form der
   * mitgelieferten Dateien. Sie liegen im Stand und nicht – wie im Prototyp – unter einem
   * eigenen Schlüssel, damit sie in Sicherung und Vorlage mitreisen.
   */
  eigeneAufbauten: RawAufbau[]
  /**
   * Eigene Standardgewichte je Klasse in kg. Die Vorgabe steht im Regelwerk (DM
   * und UIM unterscheiden sich); hier steht nur, was die Veranstaltung davon
   * abweichend festlegt.
   */
  sollgewicht: Partial<Record<ClassId, number>>
  /**
   * Die Verzahnung ist festgeschrieben. Sie bestimmt Startnummern und damit alle
   * Listen; solange das gesetzt ist, lassen sich Parcours, Spuren und Boote
   * nicht ändern.
   */
  verzahnungLocked: boolean
  /** Geburtsdatum auf den gedruckten Listen zeigen. */
  showBirthdate: boolean
  /** Herkunft auf den Startlisten: ausgeschriebener Name oder Kürzel. */
  listOrigin: OriginStyle
  /**
   * Eigene Kürzel des Veranstalters: Name (Verein, Bundesland, Land, Gruppe) →
   * Kürzel. Für Bundesländer und Länder gibt es ISO-Vorgaben (domain/kuerzel),
   * die hier nur stehen, wenn sie überschrieben wurden.
   */
  originShort: Record<string, string>
  /** Anzahl der Läufe je Starter (Deutsche Meisterschaft: 3). */
  laufCount: number
  /**
   * Wer an welcher Liste sitzt, je Parcours der Verzahnung. Gehört zur Veranstaltung wie die
   * Starter: in der Sicherung enthalten, in der Vorlage nicht (Personennamen).
   */
  einteilung: Einteilung
  /**
   * Leerzeilen am Ende jeder Klasse auf den Wettkampfrichter-Listen: Wer nach dem Druck
   * nachgemeldet wird, bekommt dort von Hand seine Zeile (Vorgabe 3 wie im Prototyp).
   */
  wkrLeerzeilen: number
  /** Abweichende Zahl der Leerzeilen für einzelne Klassen; fehlt = `wkrLeerzeilen`. */
  wkrLeerzeilenKlasse: Partial<Record<ClassId, number>>
  /**
   * Beschreibung (Fehlerpunkte, Disqualifikationen, Parcoursbild) auf die Rückseite drucken:
   * Vorn bleibt mehr Platz für Starter, gedruckt wird dann doppelseitig.
   */
  wkrRueckseite: boolean
  /** Erfasste Zeiten, Fehler und Disqualifikationen; hängen an der Starter-ID. */
  eingaben: Eingaben
  /** Streichläufe der Gesamtwertung; die Zahl der Läufe steht in `laufCount`. */
  streichlaeufe: Streichlaeufe
  /**
   * Clubmeisterschaft, Papier sparen: Alle Klassen einer Liste stehen auf einem Bogen, auch
   * wenn ihre Spalten oder Zeichnungen verschieden sind. Dafür entfällt das Parcoursbild, und
   * Spalten, die eine Klasse nicht hat, sind in deren Zeilen schraffiert. Aus = Listen mit
   * Bild bleiben je Klasse (jede sieht ihre eigene Zeichnung).
   */
  wkrClubGemeinsam: boolean
}

// ---------------------------------------------------------------------------
// Wettkampfrichter-Listen: aufgelöste Konfiguration (config/build.ts).
// Unverändert aus dem Fehlerpunkte-Prototyp übernommen, damit dessen
// Konfigurationsschicht ohne Umbau darauf baut.
// ---------------------------------------------------------------------------

/** Design einer Spalten-Trennlinie. */
export type TrennerDesign = 'fett' | 'doppelt' | 'gepunktet' | 'gestrichelt'

/** Gerät einer Zeitspalte: elektronische Zeiterfassung (Lichtschranke) oder Stoppuhr. */
export type Geraet = 'elektronisch' | 'stoppuhr'

/** Sprache der Listen und Fehlertexte: deutsch, englisch oder beides. */
export type Sprache = 'de' | 'en' | 'de+en'

/**
 * Kennung einer Position/Liste. Frei konfigurierbar (siehe config/aufbauten.yaml),
 * daher ein String und keine feste Aufzählung.
 */
export type SheetTypeId = string

/** Verhalten einer Eingabezelle. */
export type CellKind =
  | 'buoy' // Anzahl Bojenberührungen → Punkte = Anzahl × weight; Buchstabe A-X = Disq an dieser Stelle
  | 'code' // Fehlercode(s) aus der Legende, kommagetrennt → Punkte laut errorTable
  | 'points' // direkte Punkteingabe → fließt in Σ
  | 'time' // Zeiteingabe (Sonderformatierung, siehe lib/time)
  | 'disq' // Disqualifikations-Buchstabe A-X
  | 'text' // Freitext (Bemerkung)
  | 'sum' // berechnete Σ-Zelle (nur Anzeige)

export interface Column {
  key: string
  label: string
  kind: CellKind
  /**
   * Was die Zellen dieser Spalte erfassen (eine Kennung je Unter-Spalte, siehe
   * config/feld.ts). Fehlt = der `key`.
   */
  felder?: string[]
  /**
   * Unter-Spalten (z. B. Blickrichtungen "H K" / "H H" an einem Tor). Jede
   * erzeugt eine eigene Zelle; der Kopf wird dann zweizeilig dargestellt.
   */
  sub?: string[]
  /**
   * Nur für 'code'-Zellen: Schlüssel der 'sum'-Spalte, in der die aus den
   * Codes berechneten Punkte (read-only) angezeigt werden.
   */
  pointsCol?: string
  /**
   * Nur für 'sum'-Spalten: zeigt die Punkte einzeln in der Reihenfolge der Codes
   * („5 + 5“) statt ihrer Summe. Die Summe steht dann in der Σ-Spalte.
   */
  einzeln?: boolean
  /**
   * Nur für 'code'-Zellen: eigener Fehler-Katalog dieser Spalte. Ist er gesetzt,
   * gelten für Bewertung und Eingabe nur diese Codes (statt des positionsweiten
   * SheetDef.errorTable). Beispiel: Steg "Fehler AB" vs. "Fehler AN".
   */
  errorTable?: ErrorDef[]
  /** Relative Spaltenbreite (CSS-Flexbasis-artig, nur grobe Steuerung). */
  grow?: number
  /**
   * Optische Trennlinie am linken Rand dieser Spalte, z. B. zur Trennung von
   * Hin- und Rückfahrt-Spalten. Wird entweder direkt an der Spalte gesetzt oder
   * über einen eigenen `{ typ: trenner, design }`-Eintrag davor (siehe schema).
   */
  trenner?: TrennerDesign
  /**
   * Design der Trennlinien ZWISCHEN den Unter-Spalten (`sub`) dieser Spalte,
   * z. B. gepunktet zwischen den beiden Bojen eines Tores. Fehlt = normale
   * dünne Linie.
   */
  subTrenner?: TrennerDesign
  /**
   * Klassen, für die diese Spalte erscheint (z. B. Speed/MüB). Leer/undefiniert
   * = alle Klassen. Ein Blatt gilt genau einer Klasse, daher entfällt die
   * Spalte klassenabhängig.
   */
  klassen?: string[]
  /** Nur 'time': das Gerät. Fehlt = Stoppuhr. */
  geraet?: Geraet
}

/** Ein benannter Fehlerblock in der Legende (z. B. Ablegen / Anlegen). */
export interface ErrorGroup {
  title?: string
  rows: ErrorDef[]
}

export interface ErrorDef {
  code: string
  text: string
  punkte: number
}

export interface DisqDef {
  code: string
  text: string
}

export interface SheetDef {
  typeId: SheetTypeId
  /** Kurzname (erscheint links im Kopf), z. B. "Mann-über-Bord". */
  title: string
  /** Kurzname auf Deutsch: für Bedienleiste, Laufzettel und Dateinamen. */
  titelDe: string
  /** Ausführlicher Name für Auswahl-Menüs. */
  menuLabel: string
  orientation: 'portrait' | 'landscape'
  /** Lauf im Kopf anzeigen (Default true; false z. B. bei Knoten). */
  showLauf?: boolean
  /**
   * Klassen, für die dieses Blatt genutzt wird (z. B. MüB [4,5,6,7]). Leer =
   * alle. Steuert die Bogen-Erzeugung (nicht passende Klassen werden ausgelassen).
   */
  klassen?: string[]
  columns: Column[]
  /** Schlüssel der Spalte, die die berechnete Σ zeigt (falls vorhanden). */
  sumColumnKey?: string
  /** Fehlercodes → Punkte (für Legende und Auto-Summe der 'code'-Zellen). */
  errorTable?: ErrorDef[]
  /** Überschrift über der errorTable-Legende. */
  errorTableTitle?: string
  /**
   * Getrennte Fehlerblöcke (je Spalte ein eigener Katalog), z. B. Steg
   * Ablegen/Anlegen. Ist dies gesetzt, zeigt die Legende die Blöcke
   * nebeneinander (statt der einzelnen errorTable).
   */
  errorGroups?: ErrorGroup[]
  /** Für diese Position gültige Disqualifikationen (bereits gefiltert). */
  disqTable?: DisqDef[]
  /** Überschrift über der disqTable-Legende, mit Regelwerk und Version. */
  disqTableTitle?: string
  /** Disq-Legende zweispaltig: bei querliegendem Bild, das darunter Höhe braucht. */
  disqZweispaltig?: boolean
  /** Zeigt die Disqualifikations-Tabelle in der Legende (= disqTable vorhanden). */
  showDisqTable?: boolean
  /** Zusätzliche Hinweiszeile in der Legende. */
  legendNote?: string
  /**
   * Zweisprachig: derselbe Hinweis getrennt nach [deutsch, englisch], damit die
   * Legende beide nebeneinander zeigt. Die Vektor-PDF-Wege nutzen `legendNote`.
   */
  legendNoteSpalten?: [string, string]
  /**
   * Name des Bildes der Position, wie im Fehlerpunkte-Prototyp der Bildordner (z. B.
   * alcatraz_I). Mit `bildErzeugen` ist es die Quelle (alcatraz_Parcours).
   */
  courseImageDir?: string
  /**
   * Woraus der Browser das Bild erzeugt: Er blendet die Zeichnung der Klasse selbst ab
   * (lib/parcoursbild.ts, lib/parcoursQuelle.ts). Gesetzt für jede Position mit erzeugtem
   * Bild, mitgelieferte wie eigene – vorgebaute Bildordner gibt es hier nicht.
   */
  bildErzeugen?: { dim: string[]; aus: string[] }
  /** Bild-Drehung in Grad: 0 | 90 | -90 | 180. */
  bildDrehung?: number
  /** Breite des gedrehten Bildes neben der Legende in mm (Standard siehe CSS). */
  bildBreite?: number
  /** Bild rechts neben Fehlerpunkten und Beschreibung, darunter die Disqualifikationen. */
  bildNeben?: boolean
  /**
   * Was die Legende zeigt, wenn eine Klasse keine Fehler-Spalte hat (z. B. Berlin
   * Rechts unter Klasse 4 ohne MüB). Siehe defFuerKlasse.
   */
  ohneCodes?: { legendNote?: string; legendNoteSpalten?: [string, string]; disqTable?: DisqDef[] }
}
