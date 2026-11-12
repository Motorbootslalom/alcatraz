// Roh-Struktur der YAML-Konfiguration. Sie ist auf mehrere Dateien verteilt:
//   • regelwerke.yaml        - Liste der verfügbaren Regelwerke (Menü-Reihenfolge)
//   • regelwerke/<id>.yaml   - je Regelwerk und Version: Disqualifikationen +
//     Fehler-Kataloge (aus der Ausschreibung), z. B. dm-2026, uim-2026
//   • einstellungen.yaml, i18n/*.yaml, aufbauten/*.yaml - Hinweise + Positionen
//     (orts-/personenabhängig), die Kataloge und Hinweise per Verweis (ID) einbinden.
//     konfig.ts führt sie beim Modulstart zusammen (merge-positionen.ts).
// Aus dem gewählten Regelwerk und den Positionen erzeugt build.ts die interne
// Darstellung.

export interface RawDisq {
  code: string
  text: string
  /** Englischer Text (Pflicht, wenn das Regelwerk `sprachen: [de, en]` nennt). */
  en?: string
  /**
   * Auf welchen Listen der Buchstabe steht (Position → `disq: <Bereich>`), z. B.
   * [steg] oder [parcours, mueb]. Fehlt die Angabe, gilt er überall.
   */
  bereiche?: string[]
}

export interface RawFehler {
  code: string | number
  text: string
  en?: string
  punkte: number
}

/** Benannter Fehler-Katalog (z. B. "mueb", "steg", "tor5"). */
export interface RawKatalog {
  titel?: string
  titelEn?: string
  fehler: RawFehler[]
}

/** Fehler ohne Code: Punkte werden direkt eingetragen (Bojen, Knoten). */
export interface RawDirektpunkt {
  titel: string
  titelEn?: string
  text: string
  en?: string
  punkte: number
}

/** Hinweis auf der A4-Legende: nur deutsch oder mit englischem Text. */
export type RawLegendeHinweis = string | { text: string; en?: string }

/** regelwerke/<id>.yaml: ein Regelwerk in einer Version. */
export interface RawRegelwerk {
  /** Eindeutig, entspricht dem Dateinamen (z. B. "dm-2026"). */
  id?: string
  /** Anzeigename ohne Version (z. B. "DM"). */
  name?: string
  version?: string | number
  /** Angebotene Sprachen der Listen: [de] (Standard) oder [de, en]. */
  sprachen?: string[]
  /** Dokument, aus dem die Werte stammen. */
  quelle?: string
  quelleEn?: string
  /** Einheit der Strafen auf der A4-Legende: Punkte | Sekunden. */
  einheit?: string
  einheitEn?: string
  /** Klassen dieses Regelwerks (fehlt = alle). */
  klassen?: Array<string | number>
  /** Abweichende Klassennamen auf den Listen, z. B. { E: Dolphin }. */
  klassenNamen?: Record<string, string>
  /** Steht auf jeder Liste mit Fehlercodes und auf der A4-Legende. */
  fehlerHinweis?: string
  fehlerHinweisEn?: string
  /** Zusätzliche Hinweise nur auf der A4-Legende. */
  legendeHinweise?: RawLegendeHinweis[]
  /** Spalten, die es in diesem Regelwerk nicht gibt: Position → Spalten-Keys. */
  ohneSpalten?: Record<string, string[]>
  disqualifikationen?: RawDisq[]
  kataloge?: Record<string, RawKatalog>
  direktpunkte?: RawDirektpunkt[]
}

/** regelwerke.yaml */
export interface RawRegelwerkListe {
  /** Regelwerk-IDs in Menü-Reihenfolge; der erste ist der Standard. */
  regelwerke?: string[]
}

import type { Geraet, TrennerDesign } from '../types'

// 'trenner' ist keine echte Datenspalte, sondern ein Platzhalter-Eintrag, der
// zwischen zwei Spalten eine Trennlinie erzeugt (linke Kante der Folgespalte).
export type RawSpaltenTyp = 'boje' | 'code' | 'punkte' | 'zeit' | 'disq' | 'text' | 'summe' | 'trenner'

export interface RawSpalte {
  /** Bei `typ: trenner` entfällt der key (reiner Trennlinien-Eintrag). */
  key?: string
  label?: string
  typ: RawSpaltenTyp
  /** Nur bei `typ: trenner`: Linien-Design (Standard: fett). */
  design?: TrennerDesign
  /** Unter-Spalten (z. B. Bojen-Bezeichnungen [H K, H H]) - nur bei 'boje'. */
  sub?: string[]
  /**
   * Welche physische Seite (seiteA/seiteB) an diesem Tor die INNERE Boje ist.
   * Nur an den Toren 1-4 gesetzt. Wird das Schema "Innen/Außen" gewählt, werden
   * die Bojen-Seiten dieser Spalte relativ (Innen/Außen) statt physisch (R/L)
   * beschriftet. Tor 5/Start/Ziel bleiben ohne Angabe bei R/L.
   */
  innen?: 'seiteA' | 'seiteB'
  /** Nur 'code': Schlüssel der 'summe'-Spalte, in der die Punkte erscheinen. */
  punkteSpalte?: string
  /** Nur 'summe': Punkte einzeln in der Reihenfolge der Codes („5 + 5“) statt ihrer Summe. */
  einzeln?: boolean
  /**
   * Element-ID im Parcoursbild (z. B. "Tor1"), die diese Spalte im Bild
   * HERVORHEBT. Genutzt vom Bildgenerator (scripts/generate-parcours.ts): Tore
   * mit `hebt` bleiben voll sichtbar, die übrigen aus DIM_UNIVERSE werden
   * abgeblendet. Der Vorteil: kopiert man eine Spaltenzeile, wandert die
   * Hervorhebung mit. Ohne `hebt` greift die Positions-Liste `abblenden`.
   */
  hebt?: string
  /**
   * Nur 'code': eigener Fehler-Katalog dieser Spalte (Verweis auf
   * kataloge.<id> im Regelwerk). Ohne Angabe gilt der positionsweite `katalog`.
   * Damit lassen die Spalten Steg AB/AN je nur ihre eigenen Codes zu.
   */
  katalog?: string
  /** Relative Breite (Flex-Anteil). */
  breite?: number
  /**
   * Kurzform: optische Trennlinie am LINKEN Rand dieser Spalte (trennt sie von
   * der vorherigen). Alternativ - und meist lesbarer - ein eigener Eintrag
   * `{ typ: trenner, design: fett|doppelt|gepunktet|gestrichelt }` DAVOR.
   */
  trenner?: TrennerDesign
  /** Design der Trennlinien zwischen den `sub`-Unter-Spalten dieser Spalte. */
  subTrenner?: TrennerDesign
  /**
   * Nur für diese Klassen anzeigen (z. B. [5, 6, 7] für Speed 1, [7] für
   * Speed 2, [4, 5, 6, 7] für Mann-über-Bord). Fehlt die Angabe → alle Klassen.
   * Ein Bogen gilt genau einer Klasse, daher kann die Spalte je Blatt entfallen.
   */
  klassen?: Array<string | number>
  /** Nur 'zeit': elektronisch oder stoppuhr (Standard). Die elektronische Zeit geht in der Wertung vor. */
  geraet?: Geraet
}

export interface RawPosition {
  id: string
  titel: string
  menue?: string
  ausrichtung?: 'hoch' | 'quer'
  /** Lauf im Kopf zeigen? false z. B. bei Knoten (nur einmal abgenommen). */
  lauf?: boolean
  /**
   * true = zusätzlich in JEDEM Aufbau wählbar (Schnellauswahl „Eine Position ·
   * alle Klassen“ und Bogen-Menüs), z. B. Varianten wie „ohne Start/Ziel“, die
   * in keinem Aufbau stehen. Fehlt/false → nur in den Aufbauten, die sie nennen.
   */
  schnellauswahl?: boolean
  /** Bild-Ordner unter public/parcours (z. B. alcatraz_Parcours). */
  bild?: string
  /**
   * Wird `bild` beim Build automatisch aus `bildQuelle` erzeugt? Dann leitet
   * scripts/generate-parcours.ts die Abblendung aus den Spalten (`hebt`) bzw.
   * `abblenden` ab und schreibt gedimmte SVG+PNG nach parcours/<bild>. Fehlt
   * der Schalter, verweist `bild` wie bisher auf ein festes fertiges Bild.
   */
  bildGenerator?: boolean
  /** Quell-Bildordner für den Generator (Default: alcatraz_Parcours). */
  bildQuelle?: string
  /**
   * Kein vorgebautes Bild: Der Browser erzeugt es beim Anzeigen aus `bildQuelle`, mit
   * derselben Abblendung wie der Generator. Für Positionen, die nicht im Repo stehen,
   * z. B. eigene Aufbauten. `bild` ist dann nicht nötig.
   */
  bildImBrowser?: boolean
  /**
   * Element-IDs im Parcoursbild, die abgeblendet (opacity reduziert) werden.
   * Fallback/Ergänzung zur spaltenbasierten `hebt`-Hervorhebung: Ohne `hebt` in
   * den Spalten steuert allein diese Liste, was gedimmt wird; mit `hebt` kann
   * sie zusätzliche Elemente (z. B. Speedboje_unten) abblenden.
   */
  abblenden?: string[]
  /** Bild-Drehung in Grad: 0 | 90 | -90 | 180. */
  bildDrehung?: number
  /** Nur bei ±90° gedrehtem Bild: Breite des Bildes neben der Legende in mm (Standard 40). */
  bildBreite?: number
  /** Bild rechts neben Fehlerpunkten und Beschreibung, darunter die Disqualifikationen. */
  bildNeben?: boolean
  /**
   * Diese Position wird von der Gegenseite betrachtet (z. B. Alcatraz von
   * hinten). Bei räumlichen Schemata (Pfeile) werden die Bojen-Seiten dann
   * gespiegelt, damit die Pfeile in dieselbe Bildrichtung zeigen wie im
   * Frontal-Aufbau - auch wenn sie eine andere Boje meinen.
   */
  pfeileSpiegeln?: boolean
  /**
   * Diese Liste legt die genannten Positionen zusammen, z. B. [tor5, parcours]: Option
   * in jedem Aufbau, der alle genannten enthält.
   */
  ersetzt?: string[]
  /** Verweis auf hinweise.<id> (oder direkter Text, falls kein Treffer). */
  hinweis?: string
  /** Verweis auf kataloge.<id> im Regelwerk (Fehlercodes → Punkte). */
  katalog?: string
  /**
   * Welche Disqualifikationen des Regelwerks gelten: 'alle', 'keine' oder ein
   * Bereich (z. B. 'steg', 'mueb'). Die Buchstaben selbst stehen nur im
   * Regelwerk, weil sie sich je Regelwerk unterscheiden.
   */
  disq?: string
  /**
   * Für welche Klassen diese Position (das ganze Blatt) genutzt wird, z. B.
   * Mann-über-Bord [4, 5, 6, 7]. Fehlt die Angabe → alle Klassen. Beim Erzeugen
   * der Bögen (Schnellauswahl) werden nicht passende Klassen übersprungen.
   */
  klassen?: Array<string | number>
  /** Schlüssel der Spalte, die die Zeilensumme (Σ) berechnet zeigt. */
  summeSpalte?: string
  /**
   * Standard-Design der Trennlinien zwischen Unter-Spalten (`sub`) ALLER Spalten
   * dieser Position, z. B. gepunktet zwischen den beiden Bojen jedes Tores. Pro
   * Spalte via `subTrenner` überschreibbar.
   */
  subTrenner?: TrennerDesign
  /**
   * Geräte der Zeitnahme auf dieser Liste, je Gerät eine Zeitspalte. Ersetzt die
   * Spalten mit `typ: zeit` (siehe zeitnahme.ts).
   */
  zeiten?: Geraet[]
  spalten: RawSpalte[]
}

/** Von wo eine Person überwiegend auf den Kurs schaut (KONZEPT-POSITIONEN.md §4.2). */
export type Blick = 'hinten' | 'vorne' | 'rechts' | 'links'

/** Was eine Position außer Bojen beobachtet: Zeit, Fehler an Tor 5, Mann-über-Bord, Fahrweg. */
export type Aufgabe = 'zeit' | 'tor5' | 'mueb' | 'parcours'

/**
 * Eine Position in Kurzform: ohne `spalten`, beschrieben durch ihre Bojen, Aufgaben und
 * ihren Blick. kurzform.ts leitet daraus die ausführliche Form ab; jedes Feld der
 * ausführlichen Form darf zusätzlich stehen und gewinnt dann gegen die Regel.
 */
export interface RawKurzform extends Omit<RawPosition, 'spalten'> {
  spalten?: undefined
  blick?: Blick
  /** IDs aus dem Parcoursbild: ganzes Tor (Tor1) oder Einzelboje (Tor1_innen, Tor5_oben). */
  bojen?: string[]
  aufgaben?: Aufgabe[]
}

/**
 * Ein auf der Seite umschaltbares Bezeichnungs-Schema (z. B. Rechts/Links,
 * Land/See, Hafen/Kai). `tokens` überschreibt die globalen `bezeichnungen`
 * (typischerweise seiteA/seiteB) - so lässt sich die Bojen-Beschriftung ohne
 * YAML-Änderung live umstellen.
 */
export interface RawBeschriftung {
  id: string
  name: string
  tokens: Record<string, string>
  /**
   * Räumliches Schema (z. B. Pfeile →/←): die Kürzel zeigen eine Blickrichtung
   * und müssen daher an "von hinten" betrachteten Positionen gespiegelt werden
   * (siehe RawPosition.pfeileSpiegeln). Bei Buchstaben-Schemata (R/L, L/S …)
   * sind die Kürzel Namen und werden nicht gespiegelt.
   */
  raeumlich?: boolean
}

/**
 * Eine Position im Aufbau, abgewandelt nur hier, z. B. eine Zeitliste mit nur der
 * elektronischen Zeiterfassung: `{ id: zeit, zeiten: [elektronisch] }`. Abwandlungen
 * sind immer nummeriert (zeit-1 …), damit sie die Position selbst nicht verdecken.
 */
export interface RawAufbauEintrag {
  id: string
  /** Fehlt bei einer reinen Zeitliste: aus dem Gerät, z. B. „Elektronische Zeiterfassung“. */
  titel?: string
  zeiten?: Geraet[]
}

/** Ein Aufbau (Setup) bündelt die bei einem Wettkampf genutzten Positionen. */
export interface RawAufbau {
  id: string
  name: string
  /**
   * Positionen in Reihenfolge (auch gemeinsame wie zeit, knoten …): als ID, abgewandelt oder
   * direkt in Kurzform (mit `bojen` oder `aufgaben`, siehe kurzform.ts `hochziehen`).
   */
  positionen: Array<string | RawAufbauEintrag | RawKurzform>
  /** Eigene Bojen (z. B. Parallelslalom): Der Überwachungs-Check gilt hier nicht. */
  eigeneStrecke?: boolean
  /** Disziplin mit eigenen Eingaben und Ergebnislisten. Fehlt: die erste aus `disziplinen`. */
  disziplin?: string
  /** Kursvariante des Austragungsorts (`kurse.<id>`), z. B. eigene Parcoursbilder. */
  kurs?: string
  /** Intern: ein eigener Aufbau aus dem Browser, nicht aus dem Repo (siehe eigene.ts). */
  eigen?: boolean
}

/**
 * Was ein Austragungsort am Kurs anders macht, ohne dass sich der Fahrweg ändert
 * (KONZEPT-POSITIONEN.md §4.4). Fehlt vor Ort eine Boje, bleiben ihre Felder trotzdem.
 */
export interface RawKurs {
  id: string
  name: string
  /**
   * Eigene Parcoursbilder je Klasse: Dateiname ohne Endung in jedem Bildordner, z. B.
   * { 5: Klasse5_Moewe }. Die übrigen Klassen nutzen Klasse<k>. Der Generator legt alle
   * Quellbilder in jeden erzeugten Ordner, die Variante wählt nur die Datei.
   */
  bilder?: Record<string, string>
}

/** Eine Spalte der Ergebnisliste; Felder ohne Liste im Aufbau oder in der Klasse entfallen. */
export interface RawErgebnisSpalte {
  label: string
  /** Felder, deren Punkte zusammen in einer Zelle stehen, z. B. beide Start-Bojen. */
  felder?: string[]
  /** Felder mit je einer Unter-Spalte. Kürzel: das der Boje, sonst `label`. */
  unter?: Array<string | { label: string; feld: string }>
}

/** Disziplin: Ihre Aufbauten teilen sich die Eingaben und die Ergebnislisten. */
export interface RawDisziplin {
  id: string
  name: string
  ergebnisspalten?: RawErgebnisSpalte[]
}

/** Eine Boje oder Aufgabe, die jeder Aufbau auf einer Liste abdecken muss. */
export interface RawUeberwachung {
  name: string
  /** Bojen-Spalte, ggf. mit ihren Bojen (`sub`). */
  key?: string
  sub?: string[]
  /** Oder: eine Fehler-Spalte mit diesem Katalog. */
  katalog?: string
  /** Nur für diese Klassen (fehlt = alle). */
  klassen?: Array<string | number>
}

/** Laufzettel (je Klasse/Lauf): Arbeitsschritte unter den Seiten-Checkboxen. */
export interface RawLaufzettel {
  /** Überschrift des Schritte-Blocks (fehlt = keine). */
  titel?: string
  /** Arbeitsschritte der Auswertung, je mit Checkbox (in dieser Reihenfolge). */
  schritte?: string[]
}

/** Übersetzung der Positionen in eine Sprache (i18n/<sprache>.yaml). */
export interface RawUebersetzung {
  /** Deutscher Titel/Spaltenname → übersetzter Text. */
  texte?: Record<string, string>
  /** Hinweis-ID → übersetzter Hinweistext (mit denselben Tokens). */
  hinweise?: Record<string, string>
  /** Bezeichnungs-Schema → übersetzte Tokens (Langnamen der Bojen-Seiten). */
  bezeichnungen?: Record<string, Record<string, string>>
}

/** Die zusammengeführten Positions-Dateien (merge-positionen.ts). */
export interface RawPositionen {
  /** Disziplinen in Menü-Reihenfolge; die erste ist der Standard. */
  disziplinen?: RawDisziplin[]
  /** Übersetzungen je Sprache, z. B. { en: {...} }. */
  uebersetzungen?: Record<string, RawUebersetzung>
  /**
   * Globale Bojen-Kürzel als Token-Map, z. B. { hin: "H", rueck: "Z",
   * seiteA: "R", seiteB: "L" }. In Spalten-`sub` und Hinweisen werden diese
   * Tokens (als ganze Wörter) durch die Kürzel ersetzt - so lassen sich die
   * Bezeichnungen (R/L, L/S, H/K …) an einer Stelle umstellen.
   */
  bezeichnungen?: Record<string, string>
  /**
   * Auf der Seite umschaltbare Bezeichnungs-Schemata. Das erste ist der
   * Standard; wird eines gewählt, überschreiben seine `tokens` die
   * `bezeichnungen` und die Konfiguration wird neu gebaut.
   */
  beschriftungen?: RawBeschriftung[]
  /** Wiederverwendbare Hinweistexte (Bojen-Bezeichnungen). */
  hinweise?: Record<string, string>
  /** Laufzettel: Arbeitsschritte der Auswertung. */
  laufzettel?: RawLaufzettel
  /** Aufbauten (Setups); der erste ist der Standard. */
  aufbauten?: RawAufbau[]
  /** Kursvarianten der Austragungsorte. */
  kurse?: RawKurs[]
  /** Was jeder Aufbau auf einer Liste abdecken muss (geprüft von config:check). */
  ueberwachung?: RawUeberwachung[]
  /** Alle Positionen (werden von den Aufbauten per ID referenziert). */
  positionen: RawPosition[]
}

/**
 * Die Positions-Dateien, wie sie in src/config stehen: Positionen auch in Kurzform,
 * Ergebnisspalten und Überwachung auch als `fahrweg` (aus dem Fahrweg in kurzform.ts).
 */
export interface RawQuelle extends Omit<RawPositionen, 'positionen' | 'ueberwachung' | 'disziplinen'> {
  positionen: Array<RawPosition | RawKurzform>
  ueberwachung?: RawUeberwachung[] | 'fahrweg'
  disziplinen?: Array<Omit<RawDisziplin, 'ergebnisspalten'> & { ergebnisspalten?: RawErgebnisSpalte[] | 'fahrweg' }>
}

/** Zusammengeführte Roh-Konfiguration (ein Regelwerk + Positionen). */
export interface RawConfig extends RawRegelwerk, RawPositionen {}
