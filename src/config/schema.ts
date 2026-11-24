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
  /**
   * Klassen, in denen der Code laut Regelwerk gilt (Nutzer 21.11.2026, W3-07, WKR_ANNAHMEN.codesNachKlasse): `abKlasse`
   * = diese und alle späteren Klassen in der Folge von `klassen` (DM: „erst ab Klasse 4“), `klassen` = genau diese.
   * Höchstens eine der beiden; fehlt beides, gilt er überall. Wirkung nur auf dem WKR-Gerät: ausgegraut, aber drückbar
   * (die Besprechung kann ihn für weitere Klassen freigeben) – Bogen, Legende und Eingabe bleiben unverändert.
   */
  abKlasse?: string | number
  klassen?: (string | number)[]
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

/**
 * Was bei gleichem Ergebnis entscheidet (lib/ergebnis.ts, dort auch die genaue Bedeutung):
 *   schnellsterLauf   die kürzeste gefahrene Zeit unter den gewerteten Läufen
 *   besterLauf        das beste Ergebnis (Zeit und Strafpunkte) unter den gewerteten Läufen
 *   summeAllerLaeufe  die Summe aller Läufe mit Strafpunkten, auch der gestrichenen; wer
 *                     nicht in jedem ein gültiges Ergebnis hat, steht dahinter
 */
export const STICH_KRITERIEN = ['schnellsterLauf', 'besterLauf', 'summeAllerLaeufe'] as const
export type StichKriterium = (typeof STICH_KRITERIEN)[number]

/**
 * Varianten der Pokalauswertung je Herkunft (lib/pokal.ts):
 *   plaetze3  die ersten drei Plätze je Klasse bekommen Punkte (Vorgabe 10, 7, 5)
 *   plaetze6  die ersten sechs Plätze je Klasse (Vorgabe 6, 5, 4, 3, 2, 1)
 *   uim       UIM-Punkte für die Plätze 1 bis 20; je Herkunft zählen die Besten (Vorgabe 5)
 */
export const POKAL_VARIANTEN = ['plaetze3', 'plaetze6', 'uim'] as const
export type PokalVariante = (typeof POKAL_VARIANTEN)[number]
/** Die Varianten mit Punkten je Platz, die sich in den Einstellungen ändern lassen. */
export const POKAL_PLATZ_VARIANTEN = ['plaetze3', 'plaetze6'] as const
export type PokalPlatzVariante = (typeof POKAL_PLATZ_VARIANTEN)[number]

/**
 * Grenzen eines Startabstands in ganzen Sekunden – für die Vorgaben im YAML (validate.ts) und die
 * eigenen Werte der Veranstaltung (state/reducer/betrieb.ts normalisiereAnzeige), an EINER Stelle.
 * Unter 30 s ist kein Lauf samt Bootswechsel denkbar; über 10 min wäre es keine Vorgabe mehr, sondern
 * eine Pause (die Messung verwirft schon über 5 min, BETRIEB_ANNAHMEN.prognoseMessung).
 */
export const STARTABSTAND_MIN = 30
export const STARTABSTAND_MAX = 600

/** regelwerke/<id>.yaml: ein Regelwerk in einer Version. */
export interface RawRegelwerk {
  /** Eindeutig, entspricht dem Dateinamen (z. B. "dm-2026"). */
  id?: string
  /** Anzeigename ohne Version (z. B. "DM"). */
  name?: string
  version?: string | number
  /** Angebotene Sprachen der Listen: [de] (Standard) oder [de, en]. */
  sprachen?: string[]
  /**
   * In dieser Sprache stehen alle Listen außer den Wettkampfrichter-Bögen (Starter-, Gewichts-,
   * Vorsteg- und Wertungslisten, Laufzettel, Aushang der Codes) – unabhängig von der Sprache
   * der Oberfläche: Der Aushang gehört zum Regelwerk. Eine der `sprachen`; fehlt = die erste.
   * Für die Bögen ist es die Vorgabe; dort lässt sich je Liste wählen (lib/listensprache.ts).
   */
  listenSprache?: string
  /**
   * Welche dreistelligen Kürzel Länder auf den Listen bekommen: `iso` (ISO 3166-1 alpha-3, DEU)
   * oder `ioc` (Kürzel des IOC, GER). Fehlt = `iso` (domain/kuerzel.ts `KuerzelNorm`).
   */
  laenderKuerzel?: string
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
  /**
   * Abweichende Kurzzeichen der Klassen für die runden Marken der Oberfläche (Verzahnung,
   * Verwiegung, Besetzung), z. B. { E: D } – dort ist für den ganzen Namen kein Platz. Fehlt
   * die Angabe für eine Klasse, steht ihre Kennung.
   */
  klassenKurz?: Record<string, string>
  /**
   * Was vor der laufenden Nummer einer klassenbezogenen Startnummer steht, je Klasse, z. B.
   * { E: E } → E01. Fehlt die Angabe für eine Klasse, steht ihre Kennung davor. Der Name der
   * Klasse (`klassenNamen`) ändert die Startnummern nicht.
   */
  startNrPraefix?: Record<string, string | number>
  /**
   * Nummernbereiche der Startnummern je Klasse nach Größengruppe der Westen (S-M, L-XL, XXL), so
   * geschrieben wie auf den Westen: { 5: [{ von: 501, bis: 510, gruppe: S-M }, …] }. Vorgabe für die
   * klassenbasierte Vergabe (domain/startnrBereiche.ts); die Veranstaltung kann je Klasse eigene setzen
   * (AppState.startNrBereiche, config/catalog.ts startNrBereicheOf). Nur für den Zustand – baue() nimmt
   * es heraus. Eingeführt am 19.11.2026 (DMYV-Startnummernliste).
   */
  startNrBereiche?: Record<string, Array<{ von?: string | number; bis?: string | number; gruppe?: string }>>
  /**
   * Starterlaubnis nach Geburtstag je Klasse (DM-Reglement C8: ME ab dem 6., M7 bis zum 27.
   * Geburtstag): { E: { ab: 6 }, 7: { bis: 27 } }. Nur eine Warnung im Reiter „Starter“
   * (import/klassenPruefung.ts geburtstagsHinweise, Entscheidung des Nutzers vom 24.11.2026). Nur
   * für den Zustand – baue() nimmt es heraus.
   */
  geburtstagsGrenzen?: Record<string, { ab?: number; bis?: number }>
  /** Steht auf jeder Liste mit Fehlercodes und auf der A4-Legende. */
  fehlerHinweis?: string
  fehlerHinweisEn?: string
  /** Zusätzliche Hinweise nur auf der A4-Legende. */
  legendeHinweise?: RawLegendeHinweis[]
  /** Spalten, die es in diesem Regelwerk nicht gibt: Position → Spalten-Keys. */
  ohneSpalten?: Record<string, string[]>
  /**
   * Stichentscheid bei gleichem Ergebnis, der Reihe nach angewandt – in der Liste eines Laufs
   * wie in der Gesamtliste. Fehlt die Angabe oder trennt keines, teilen sich die Starter den Platz.
   */
  stichentscheid?: string[]
  /**
   * Listen, die das Regelwerk in jedem Aufbau einer Disziplin vorsieht (z. B. die Knoten im
   * Manövrieren): Disziplin → Positionen mit `schnellauswahl: true`. Nennt der Aufbau sie nicht
   * selbst, kommen sie als zusätzliche Liste dazu – als Vorgabe, die Veranstaltung kann sie
   * abwählen (lib/listen.ts). Aufbauten anderer Disziplinen bekommen sie nicht.
   */
  vorgabeListen?: Record<string, string[]>
  /**
   * So viele Läufe sieht das Regelwerk vor und so viele davon werden gestrichen. Die Wahl des
   * Regelwerks stellt die Veranstaltung so ein (state/reducer/regelwerk.ts SET_REGELWERK); wer danach von
   * Hand abweicht, bekommt einen Hinweis – außer bei `nurVorgabe: true`: Dann ist die Angabe
   * nur die Voreinstellung und keine Aussage des Regelwerks, an der die Oberfläche misst.
   * `nachRegel`: Zahl der Läufe → Streichläufe, die die Einstellung „Streichläufe nach Regel“
   * bei dieser Zahl von Läufen streicht (DM C6: zwei Läufe, einer gewertet → { 2: 1 }). Für
   * jede Zahl, die hier fehlt, gilt die allgemeine Regel der Auswertung (ab drei Läufen einer).
   */
  wertungslaeufe?: { laeufe?: number; streichlaeufe?: number; nurVorgabe?: boolean; nachRegel?: Record<string, number> }
  /**
   * Wertung je Disziplin: Disziplin → eigener `stichentscheid` und eigene `wertungslaeufe`.
   * Was hier für eine Disziplin steht, gilt für sie STATT der gleichnamigen Angabe oben; eine
   * Disziplin ohne Eintrag (und jede Angabe, die ihr Eintrag nicht macht) folgt der Angabe oben.
   * So regelt UIM 960 Manövrieren (besserer Versuch, Pkt. 4.3.2) und Parallelslalom (Summe
   * beider Versuche, Pkt. 4.4) verschieden. Die `wertungslaeufe` einer Disziplin, deren Läufe
   * die Veranstaltung nicht einstellt (Parallelslalom: der Plan gibt die Versuche vor), gelten
   * unmittelbar; `nurVorgabe` und `nachRegel` gibt es hier deshalb nicht.
   */
  wertungJeDisziplin?: Record<string, { stichentscheid?: string[]; wertungslaeufe?: { laeufe?: number; streichlaeufe?: number } }>
  /**
   * Was das Regelwerk für den Aushang der Wertungslisten verlangt (UIM 960, Pkt. 5.2). Fehlt
   * die Angabe, bleiben die Listen, wie sie sind.
   *   • `unterschrift`: Unter jeder Wertungsliste (je Lauf, Gesamtliste, Mannschaftswertung)
   *     stehen eine Unterschriftszeile für den O.O.D. und ein leeres Feld für die Uhrzeit des
   *     Aushangs, beides zum Eintragen von Hand.
   *   • `punkte`: Die Gesamtliste hat eine Spalte mit den Punkten des Platzes (Tabelle
   *     `pokal.uim.punkte`) und die Spalten nach UIM 960, Pkt. 5.2.1 – ohne „Result“ (bester
   *     Versuch ohne Knoten).
   */
  aushang?: { unterschrift?: boolean; punkte?: boolean }
  /**
   * Die Läufe eines Starters werden direkt nacheinander gefahren (UIM 960, Pkt. 4.3.2): Die
   * Vorgabe für den Schalter der Veranstaltung (`AppState.versucheNacheinander`). Nur ein
   * Regelwerk, das die Angabe macht (true oder false), kennt den Schalter; ohne sie gibt es
   * ihn nicht, und zwischen den Läufen wird ausgehängt wie bisher.
   */
  versucheNacheinander?: boolean
  /**
   * Pokalauswertung je Herkunft (config/pokal.ts, lib/pokal.ts): `vorgabe` = die Varianten,
   * die eine Veranstaltung nach diesem Regelwerk eingeschaltet hat; `uim` = die Punktetabelle
   * der UIM-Variante mit der Zahl der Besten und der Mindestzahl der Starter je Herkunft;
   * `stichentscheid` = was punktgleiche Mannschaften trennt: mehr 1. Plätze, dann mehr 2. … bis
   * Platz `plaetze` (fehlt = jeder Platz der Punktetabelle); `zaehlt: anzahl` vergleicht die Zahl
   * der Plätze, `punkte` die Summe ihrer Punkte. Fehlt die Angabe, teilen Punktgleiche den Platz.
   */
  /**
   * Abweichungen vom Laufzettel der Vorgabe (einstellungen.yaml `laufzettel`): Was hier steht,
   * ersetzt die gleichnamige Angabe dort – z. B. eigene Schritte für den Zettel des letzten Laufs.
   */
  laufzettel?: RawLaufzettel
  /**
   * Startabstände je Klasse in Sekunden (Betrieb am Wettkampftag, Prognose der Wartezeit): Was hier steht,
   * ersetzt je Klasse die allgemeine Vorgabe aus einstellungen.yaml `startabstaende`. Nur für den Zustand
   * gelesen (config/catalog.ts `startabstandOf`), nicht für die Listen – baue() nimmt es heraus.
   */
  startabstaende?: Record<string, number>
  pokal?: { vorgabe?: string[]; uim?: { punkte?: number[]; beste?: number; mindestens?: number }; stichentscheid?: { zaehlt?: string; plaetze?: number } }
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
   * Kopf der Unter-Spalten, wenn er von `sub` abweicht – gleich viele Einträge, Tokens wie dort.
   * `sub` bleibt die Kennung des Feldes (config/feld.ts), hier steht nur, was auf dem Bogen
   * steht: Start und Ziel nur mit der Seite („L“, „R“), die Richtung ist dort immer dieselbe.
   */
  subKopf?: string[]
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
  /**
   * Design der Trennlinien zwischen den `sub`-Unter-Spalten dieser Spalte; `linie` = die
   * gewöhnliche dünne Linie, auch wenn die Position `gepunktet` vorgibt (Start und Ziel).
   */
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
  /**
   * Englischer Titel, wo er nicht in i18n/en.yaml steht: für frei benannte Positionen eigener
   * Aufbauten (der Assistent fragt ihn ab, wenn das Regelwerk Englisch anbietet). Geht vor.
   * Fehlt beides, steht auch auf englischen Listen der deutsche Titel.
   */
  titelEn?: string
  menue?: string
  ausrichtung?: 'hoch' | 'quer'
  /** Lauf im Kopf zeigen? false z. B. bei Knoten (nur einmal abgenommen). */
  lauf?: boolean
  /**
   * true = Der Starter kommt hier nur einmal vorbei, auch wenn er seine Versuche direkt
   * nacheinander fährt (Vorsteg): Mit „Versuche direkt nacheinander“ hat der Bogen dann eine
   * Zeile je Starter statt einer je Versuch; ihr Inhalt gilt für jeden Versuch. Ohne die Option
   * ohne Wirkung.
   */
  einmalJeStarter?: boolean
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
  /** Disziplin mit eigenen Eingaben und Wertungslisten. Fehlt: die erste aus `disziplinen`. */
  disziplin?: string
  /** Kursvariante des Austragungsorts (`kurse.<id>`), z. B. eigene Parcoursbilder. */
  kurs?: string
  /** Intern: ein eigener Aufbau aus dem Browser, nicht aus dem Repo (siehe eigene.ts). */
  eigen?: boolean
  /**
   * { <Position>: [<Spalten-Key>, …] }: Spalten, die die Listen DIESES Aufbaus nicht haben –
   * etwa „Bemerkung“ auf der Steg-Liste des Parallelslaloms. Anders als `ohneSpalten` des
   * Regelwerks gilt es nur für die Bögen dieses Aufbaus (lib/parallelBogen.ts).
   */
  ohneSpalten?: Record<string, string[]>
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

/** Eine Spalte der Wertungsliste; Felder ohne Liste im Aufbau oder in der Klasse entfallen. */
export interface RawErgebnisSpalte {
  label: string
  /** Felder, deren Punkte zusammen in einer Zelle stehen, z. B. beide Start-Bojen. */
  felder?: string[]
  /** Felder mit je einer Unter-Spalte. Kürzel: das der Boje, sonst `label`. */
  unter?: Array<string | { label: string; feld: string }>
}

/** Disziplin: Ihre Aufbauten teilen sich die Eingaben und die Wertungslisten. */
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

/**
 * Ein Arbeitsschritt des Laufzettels: der deutsche Text – oder, wo ein Regelwerk den Wortlaut
 * in seiner Sprache vorgibt, `{ text, en }` (wie die Fehlertexte der Regelwerke).
 * `zwischenaushang: true` kennzeichnet einen Schritt, der zum Aushang zwischen den Läufen
 * gehört (aushängen, verschicken): Werden die Läufe direkt nacheinander gefahren
 * (`versucheNacheinander`), entfällt er auf den Zetteln vor dem letzten Lauf.
 */
export type RawSchritt = string | { text?: string; en?: string; zwischenaushang?: boolean }

/**
 * Laufzettel (je Klasse/Lauf): Arbeitsschritte unter den Seiten-Checkboxen. Die Vorgabe steht
 * in einstellungen.yaml; ein Regelwerk darf mit einem eigenen Abschnitt `laufzettel` davon
 * abweichen – jede Angabe, die es macht, ersetzt die der Vorgabe (config/konfig.ts `baue`).
 */
export interface RawLaufzettel {
  /** Überschrift des Schritte-Blocks (fehlt = keine). */
  titel?: string
  /** Arbeitsschritte der Auswertung, je mit Checkbox (in dieser Reihenfolge). */
  schritte?: RawSchritt[]
  /** Arbeitsschritte auf dem Zettel des letzten Laufs (fehlt = wie `schritte`). */
  schritteLetzterLauf?: RawSchritt[]
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
  /**
   * Pokalauswertung: Punkte je Platz der Varianten, die es in jedem Regelwerk gibt
   * (einstellungen.yaml) – Variante → Punkte für Platz 1, 2, 3 … Die Vorgabe der Varianten
   * und die UIM-Tabelle stehen im Regelwerk (`pokal`), gelesen wird beides in config/pokal.ts.
   */
  pokalPunkte?: Record<string, number[]>
  /**
   * Allgemeine Startabstände je Klasse in Sekunden (einstellungen.yaml): Vorgabe der Prognose im Betrieb,
   * bis gemessen ist. Ein Regelwerk ersetzt sie je Klasse (`RawRegelwerk.startabstaende`), die
   * Veranstaltung mit eigenen Werten (`AppState.anzeige.abstaende`) – config/catalog.ts `startabstandOf`.
   */
  startabstaende?: Record<string, number>
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
