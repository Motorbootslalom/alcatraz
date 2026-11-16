import type { RawAufbau } from '../config/schema'
import type { SCHEMA_VERSION } from '../types'
import type { ClassId, StartNrMode } from './starter'
import type { ParallelPlaene, PlanState } from './planung'
import type { AnzeigeEinstellungen, Betrieb } from './betrieb'
import type {
  Besetzung,
  Einteilung,
  EventKind,
  LaufzettelLayout,
  Logos,
  OriginStyle,
  WkrSprachen,
} from './einstellungen'
import type {
  Eingaben,
  ErgebnisListenOptionen,
  ListenStand,
  NichtWerten,
  PokalEinstellungen,
  Streichlaeufe,
} from './wertung'

// Der gesamte gespeicherte Zustand einer Veranstaltung (AppState); SCHEMA_VERSION steht in ../types.ts.

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
   * Eigene Durchschnittsgewichte je Klasse in kg. Die Vorgabe steht im Regelwerk (DM
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
  /** Im Stand immer gesetzt (Vorgabe true), siehe {@link PlanState.parallelStreng}. Einstellung: in Sicherung und Vorlage. */
  parallelStreng: boolean
  /**
   * Im Stand immer gesetzt. Der Plan des Vorlaufs (`pre`) entsteht mit „Verzahnung
   * festschreiben“ und entfällt beim Lösen. Er hängt an den Startern dieser Veranstaltung
   * (ihren IDs): in der Sicherung, nicht in der Vorlage.
   */
  parallelPlaene: ParallelPlaene
  /** Geburtsdatum auf den gedruckten Listen zeigen. */
  showBirthdate: boolean
  /** Herkunft auf den Startlisten: ausgeschriebener Name oder Kürzel, auf Wunsch mit Flagge. */
  listOrigin: OriginStyle
  /**
   * Eigene Kürzel des Veranstalters: Name (Verein, Bundesland, Land, Gruppe) →
   * Kürzel. Für Bundesländer (ISO 3166-2) und Länder (IOC, Regelwerk `laenderKuerzel`) gibt
   * es Vorgaben (domain/kuerzel), die hier nur stehen, wenn sie überschrieben wurden.
   */
  originShort: Record<string, string>
  /** Anzahl der Läufe je Starter (Deutsche Meisterschaft: 3). */
  laufCount: number
  /**
   * Die Läufe (Versuche) eines Starters werden direkt nacheinander gefahren – zwischen ihnen
   * wird nichts ausgehängt (UIM 960, Pkt. 4.3.2: „2 attempts, run consecutively“). Eine Option
   * (Entscheidung des Nutzers vom 15.11.2026: nicht vorgewählt – manche Länder legen am Steg nur
   * an, steigen nicht aus und fahren gleich noch einmal; andere fahren die Versuche wie Läufe).
   * Ist sie an, steht jeder Starter auf den Listen der race officials des Manövrierens zweimal
   * direkt nacheinander: 1. und 2. Versuch auf einem Klassenzettel (lib/bogen.ts). Wirkt und ist
   * sichtbar nur unter einem Regelwerk, das den Schalter kennt (config/catalog.ts
   * `versucheNacheinander`); sonst bleibt die Angabe gespeichert. Eine Einstellung ohne
   * Personenbezug: in Sicherung und Vorlage.
   */
  versucheNacheinander: boolean
  /**
   * Wer an welcher Liste sitzt, je Parcours der Verzahnung. Gehört zur Veranstaltung wie die
   * Starter: in der Sicherung enthalten, in der Vorlage nicht (Personennamen).
   */
  einteilung: Einteilung
  /**
   * Boot je Klasse (freier Text, z. B. Nummer, Typ oder Motor): Die Regattaleitung legt fest,
   * welches Boot eine Klasse fährt (DM-Reglement A2). Keine Personenangabe – in Sicherung und
   * Vorlage. Steht im Kopf der Ausgleichsgewichte (lib/besetzung.ts).
   */
  boote: Besetzung
  /**
   * Co-Pilot je Klasse (DM-Reglement C3; UIM 960 Pkt. 2 „co-driver“). Ein Personenname wie
   * die der Wettkampfrichter: in der Sicherung, nie in der Vorlage.
   */
  coPiloten: Besetzung
  /**
   * Leerzeilen am Ende jeder Klasse auf den Wettkampfrichter-Listen: Wer nach dem Druck
   * nachgemeldet wird, bekommt dort von Hand seine Zeile (Vorgabe 3 wie im Prototyp).
   */
  wkrLeerzeilen: number
  /** Abweichende Zahl der Leerzeilen für einzelne Klassen; fehlt = `wkrLeerzeilen`. */
  wkrLeerzeilenKlasse: Partial<Record<ClassId, number>>
  /**
   * Leerzeilen je Seite auf den gemeinsamen Bögen der Clubmeisterschaft („Papier sparen“,
   * `wkrClubGemeinsam`): Dort teilen sich alle Klassen einer Seite die Zeilen für
   * Nachmeldungen – sie stehen einmal am Ende der Seite statt nach jeder Klasse. Eine eigene
   * Zahl neben `wkrLeerzeilen`, weil sie etwas anderes zählt: Wer „Papier sparen“ ab- und
   * wieder anschaltet, findet beide Angaben wieder vor.
   */
  wkrLeerzeilenSeite: number
  /**
   * Beschreibung (Fehlerpunkte, Disqualifikationen, Parcoursbild) auf die Rückseite drucken:
   * Vorn bleibt mehr Platz für Starter, gedruckt wird dann doppelseitig.
   */
  wkrRueckseite: boolean
  /** Erfasste Zeiten, Fehler und Disqualifikationen; hängen an der Starter-ID. */
  eingaben: Eingaben
  /**
   * Starter (IDs), die nach Beginn des Wettkampfs als „nicht gestartet“ eingetragen wurden
   * (lib/abmeldung.ts): Das X steht als gewöhnlicher Wert in `eingaben`; diese Liste sorgt dafür,
   * dass auch ein später hinzukommender Lauf es bekommt, und macht die Abmeldung als Ganzes
   * rücknehmbar. Gehört zu den erfassten Werten – in der Sicherung, nie in Vorlage oder
   * Teilnehmerdaten.
   */
  abgemeldet: string[]
  /**
   * Je abgemeldetem Starter der höchste Lauf, für den das X schon einmal eingetragen wurde.
   * Ohne das käme ein von Hand entferntes X zurück, wenn die Zahl der Läufe gesenkt und wieder
   * erhöht wird (Abbruch wegen Unwetter, dann doch weiter): Als „neu“ gilt ein Lauf nur einmal.
   */
  abgemeldetBis: Record<string, number>
  /** Streichläufe der Gesamtwertung; die Zahl der Läufe steht in `laufCount`. */
  streichlaeufe: Streichlaeufe
  /**
   * Clubmeisterschaft, Papier sparen: Alle Klassen einer Liste stehen auf einem Bogen, auch
   * wenn ihre Spalten oder Zeichnungen verschieden sind. Dafür entfällt das Parcoursbild, und
   * Spalten, die eine Klasse nicht hat, sind in deren Zeilen schraffiert. Aus = Listen mit
   * Bild bleiben je Klasse (jede sieht ihre eigene Zeichnung). Vorgabe an; wirkt nur bei der
   * Clubmeisterschaft.
   */
  wkrClubGemeinsam: boolean
  /**
   * Was auf den Wertungslisten steht, je Fassung: „Aushang“ (öffentlich – Namen wahlweise
   * gekürzt oder gar nicht) und „Intern“ (immer mit vollem Namen). Die Herkunft je Fassung
   * nicht, als Kürzel oder ausgeschrieben.
   */
  ergebnisListen: ErgebnisListenOptionen
  /**
   * Kennung der Veranstaltung in den QR-Codes der Bögen und Laufzettel (lib/qr.ts): Daran
   * erkennt die Erfassung ein Blatt einer anderen Veranstaltung. Zufällig, vom Store vergeben
   * (der Reducer würfelt nicht); leer, bis das geschehen ist. Sie steht in der Sicherung –
   * deren Bögen bleiben lesbar –, aber nicht in der Vorlage: Die nächste Veranstaltung ist
   * eine andere.
   */
  kennung: string
  /**
   * Stand je Wertungsliste unter ihrem Schlüssel (lib/listenStand.ts): wann sie sich zuletzt
   * geändert hat. Gehört zu den Ergebnissen: in der Sicherung, nicht in der Vorlage.
   */
  listenStand: Record<string, ListenStand>
  /**
   * Das Starterfeld stammt aus den Beispieldaten (Ansicht „Veranstaltung“). Dann bleibt der
   * Block dort aufgeklappt – wer ausprobiert, will gleich Beispielwerte ergänzen. Gilt, bis
   * die Starter ersetzt oder gelöscht werden; von Hand ergänzte Starter ändern daran nichts.
   * Gehört zu den Startern: in der Sicherung, nicht in der Vorlage.
   */
  beispielStarter: boolean
  /**
   * Starter je Seite auf den Wettkampfrichter-Listen: 0 = automatisch (gemessen, was auf ein
   * Blatt passt), sonst fest so viele (mindestens 5). Gilt für Bögen einer Klasse; gemeinsame
   * Bögen mehrerer Klassen (Clubmeisterschaft) teilen sich immer automatisch, weil dort keine
   * Klasse unnötig getrennt werden soll (lib/paging.ts `blockSeiten`).
   */
  wkrZeilenJeSeite: number
  /**
   * Nur mit festem `wkrZeilenJeSeite`: Erst Klassen mit mindestens so vielen Startern werden
   * geteilt (z. B. 15 / 25: ab 25 Startern je 15, kleinere bleiben auf einem Blatt). 0 = immer.
   */
  wkrTeilenAb: number
  /**
   * Wie die beiden Bojen eines Tores auf den Wettkampfrichter-Listen heißen: Kennung eines
   * Schemas aus `config/einstellungen.yaml` (`rl` Rechts/Links, `ls` Land/See …). Die
   * Wertungslisten bleiben bei R und L.
   */
  beschriftung: string
  /**
   * Sprache der Wettkampfrichter-Bögen je Parcours und Liste – gebaut wie die Einteilung
   * ({@link WkrSprachen}): Wer an welcher Position sitzt, entscheidet, ob der Bogen deutsch,
   * englisch oder zweisprachig sein soll, und auf jedem Parcours sitzt eine eigene Gruppe
   * (Entscheidung des Nutzers vom 15.11.2026). Fehlt ein Eintrag, gilt die Sprache des
   * Regelwerks (`listenSprache` im YAML). Wirkt nur, wo das Regelwerk Englisch anbietet; die
   * Wahl bleibt sonst stehen. Alle übrigen Listen stehen immer in der Sprache des Regelwerks
   * (lib/listensprache.ts). Eine Einstellung: Sie reist auch in der Vorlage mit – dort mit den
   * Parcours der Vorlage, an deren Kennungen sie hängt.
   */
  wkrSprachen: WkrSprachen
  /**
   * „Tor 5 übernimmt die Parcoursüberwachung“: Eine Person beobachtet die Einfahrt in Tor 5
   * und den Fahrweg auf einer Liste, die eigene Parcoursliste entfällt (config/kombi.ts).
   * Wirkt nur in Aufbauten, die beide Listen haben; sonst bleibt die Wahl gespeichert.
   */
  tor5MitParcours: boolean
  /**
   * Zusätzliche Listen außerhalb des Aufbaus (Knoten, Vorsteg …): Kennung → an/aus, und nur
   * was von der Vorgabe des Regelwerks abweicht (lib/listen.ts). Leer = die Vorgabe.
   */
  zusatzListen: Record<string, boolean>
  /**
   * Form der Laufzettel: `seite` = eine Zeile je gedruckter Seite, das Kästchen vorn (wie im
   * Fehlerpunkte-Prototyp); `liste` = eine Zeile je Liste, die Kästchen ihrer Seiten nebeneinander.
   */
  laufzettelLayout: LaufzettelLayout
  /** Pokalauswertung je Herkunft: eingeschaltete Varianten, Punkte, Auswahl der Starter. */
  pokal: PokalEinstellungen
  /**
   * „Disziplin nicht werten“ ({@link NichtWerten}). Gehört zu den Ergebnissen dieser
   * Veranstaltung: in der Sicherung, nicht in Vorlage oder Teilnehmerdaten; „Werte löschen“ setzt
   * es zurück. Wirkt nur unter einem Regelwerk mit Parallelslalom (Regel 960).
   */
  nichtWerten: NichtWerten
  /**
   * Der Buchstabe vor den Startnummern der Klasse Dolphin: „E“ (E01, wie national) oder „D“
   * (D01). Wirkt nur unter einem Regelwerk, in dem die Klasse E „Dolphin“ heißt (Regel 960), und
   * nur für Nummern, die neu vergeben werden – vorhandene bleiben, bis „Startnummern neu
   * vergeben“ sie ersetzt (config/catalog.ts `startNrPraefixe`). Eine Einstellung: in Sicherung
   * und Vorlage.
   */
  dolphinPraefix: 'E' | 'D'
  /**
   * Listen der race officials im Parallelslalom: jede zweite Zeile grau (Listen-Option, Vorgabe
   * an – Entscheidung des Nutzers vom 15.11.2026). Die Zeile ohne Eingabe (Dummy, entfallener
   * Start) bleibt schraffiert. Eine Einstellung ohne Personenbezug: in Sicherung und Vorlage.
   */
  parallelZebra: boolean
  /**
   * Zwei frei belegbare Logos im Kopf jeder gedruckten Liste – auch auf den WKR-Bögen und
   * Laufzetteln (components/KopfLogos.vue). Unter jedem Regelwerk gleich, anfangs keine; ohne Logo
   * sieht jede Liste aus wie vorher (Entscheidung des Nutzers vom 16.11.2026). Eine Einstellung
   * des Ausrichters ohne Personenbezug: in Sicherung und Vorlage. Prüfung: lib/logo.ts `logoWert`.
   */
  logos: Logos
  /**
   * Höhe der Logos auf allen Listen in mm: 8 bis 30, Vorgabe 15 (lib/logo.ts); auf den WKR-Bögen höchstens
   * 12 mm (LOGO_HOEHE_BOGEN_MAX_MM). Beides vom Nutzer nach Beispielen bestätigt (16.11.2026).
   */
  logoHoeheMm: number
  /**
   * Betrieb am Wettkampftag je Bereich (Parcours, ab E4 Parallelslalom): begonnene Läufe, was auf
   * der Anzeigetafel stand, Meldungen (types/betrieb.ts; Actions in state/reducer/betrieb.ts). Die
   * Folge der Starts steht hier nicht – sie wird aus der Verzahnung abgeleitet (betrieb/folge.ts).
   * Gehört zur Veranstaltung: in der Sicherung, nicht in der Vorlage (eine Vorlage hängt den
   * hiesigen auf ihre Parcours um). „Werte löschen“ lässt ihn stehen, „Verlauf wiederherstellen“
   * behält den jetzigen (components/VerlaufPanel.vue). Plan vom 16.11.2026.
   */
  betrieb: Betrieb
  /**
   * Einstellungen der Anzeigetafel (und der Startfolge im Betrieb). Eine Einstellung ohne
   * Personenbezug: in Sicherung und Vorlage – außer der Kopfzeile, die zur Veranstaltung gehört.
   */
  anzeige: AnzeigeEinstellungen
}
