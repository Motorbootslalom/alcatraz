// Wettkampfrichter-Listen: aufgelöste Konfiguration (config/build.ts) – SheetDef, Spalten, Fehler- und
// Disqualifikationskataloge, Sprache.
// Unverändert aus dem Fehlerpunkte-Prototyp übernommen, damit dessen
// Konfigurationsschicht ohne Umbau darauf baut.

/**
 * Design einer Spalten-Trennlinie. `linie` ist die gewöhnliche dünne Linie zwischen zwei Zellen –
 * als `subTrenner` einer Spalte hebt sie den gepunkteten Standard der Position auf (Start und Ziel:
 * linke und rechte Boje in getrennten Zellen, Entscheidung des Nutzers vom 15.11.2026).
 */
export type TrennerDesign = 'fett' | 'doppelt' | 'gepunktet' | 'gestrichelt' | 'linie'

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
   * z. B. gepunktet zwischen den beiden Bojen eines Tores. Fehlt = der Standard
   * der Position (`subTrenner` dort), sonst die normale dünne Linie.
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
  /** Höchstens so oft je Lauf (YAML `max`, Nutzer 24.11.2026); fehlt = allgemeine Grenze (lib/codes.ts codeHoechstens). */
  max?: number
  /** Disq.-Buchstabe für den Tipp nach `max` (YAML `danach`, „2. und 3. Versuch“ → D, Nutzer 24.11.2026). */
  danach?: string
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
   * Der Starter kommt an dieser Position nur einmal vorbei, auch wenn er seine Versuche direkt
   * nacheinander fährt (Vorsteg; „Versuche direkt nacheinander“, config/catalog.ts
   * `versucheNacheinander`): Dann hat der Bogen EINE Zeile je Starter – wie die Knoten-Liste –,
   * und was in ihr steht, gilt für jeden Versuch (lib/bogen.ts `BogenAuftrag.einmal`).
   */
  einmalJeStarter?: boolean
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
