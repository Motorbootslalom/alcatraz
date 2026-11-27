import type { RawAufbau } from '../config/schema'
import type { StartNrBereiche } from '../domain/startnrBereiche'
import type { SCHEMA_VERSION } from '../types'
import type { ClassId, StartNrMode } from './starter'
import type { ParallelPlaene, ParallelRunde, PlanState } from './planung'
import type { AnzeigeEinstellungen, Betrieb } from './betrieb'
import type { WkrStand } from './wkr'
import type {
  Besetzung,
  CoPilotAusgleich,
  CoPiloten,
  Einteilung,
  EventKind,
  LaufzettelLayout,
  Logos,
  OriginStyle,
  WkrGemeinsamFolge,
  WkrMeisterschaftGemeinsam,
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
  /**
   * Datum der Veranstaltung (erster Wettkampftag) als JJJJ-MM-TT, '' = nicht angegeben (24.11.2026).
   * Freiwillig: Bisher kennt die App nur das Jahr (`eventJahr`, maßgeblich für die Jahrgänge). Das
   * Datum braucht die Warnung zur Starterlaubnis nach Geburtstag (DM-Reglement C8, import/
   * klassenPruefung.ts geburtstagsHinweise). Gehört zur Veranstaltung: in der Sicherung, nicht in
   * der Vorlage (wie Name und Jahr).
   */
  eventDatum: string
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
   * Abstufung des Ausgleichsgewichts in kg (Nutzer 24.11.2026: „kleinstes Zusatzgewicht“, das kleinste
   * Gewichtsstück am Steg): Das Ausgleichsgewicht wird auf ein Vielfaches davon
   * gerundet, ab der Hälfte aufwärts (domain/gewicht.ts rundeAufStufe). Im Stand immer gesetzt, Vorgabe 1 kg
   * (AUSGLEICH_STUFE_VORGABE = ganze kg wie vorher), 0,1–10 kg auf 10 g. Einstellung der Veranstaltung: in Sicherung
   * und Vorlage.
   */
  ausgleichStufe: number
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
  /**
   * Im Stand immer gesetzt. Runden nach dem Vorlauf, deren Listen (WKR-Bögen, Laufzettel,
   * Startlisten) unter „Listen“ gedruckt wurden: Runde → Zeitpunkt des ersten Drucks (ms). Eine
   * gedruckte Runde ordnet eine später festgeschriebene Klasse nicht mehr neu (Antwort des Nutzers
   * vom 20.11.2026); „Druck lösen“ nimmt den Eintrag weg. Gilt nur, solange es den Plan der Runde
   * gibt. Hängt an den Plänen: in der Sicherung, nicht in der Vorlage (wie `parallelPlaene`).
   */
  parallelGedruckt: Partial<Record<ParallelRunde, number>>
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
   * Co-Pilot je Klasse (DM-Reglement C3; UIM 960 Pkt. 2 „co-driver“), seit 26.11.2026 (R11-07) mit Ersatz-Co-Pilot und
   * je Person optional dem Gewicht (lib/besetzung.ts). Personennamen und Körpergewichte wie die der Wettkampfrichter
   * bzw. Starter: in der Sicherung, nie in der Vorlage; nie auf Anzeigetafel, Zuschauerliste, Start-Freigabe oder in
   * einer Geräte-Sicht – auf Papier nur das Ausgleichsgewicht in Klammern hinter dem Namen.
   */
  coPiloten: CoPiloten
  /**
   * Wogegen das Ausgleichsgewicht der Co-Piloten rechnet (R11-07, 26.11.2026): je Klasse (Vorgabe, DM C3) oder über
   * alle Co-Piloten der Klassen mit Startern (lib/ausgleich.ts coPilotAusgleichVon, 27.11.2026). Eine Einstellung ohne Personenbezug: in
   * Sicherung und Vorlage.
   */
  coPilotAusgleich: CoPilotAusgleich
  /**
   * Leerzeilen am Ende jeder Klasse auf den Wettkampfrichter-Listen: Wer nach dem Druck
   * nachgemeldet wird, bekommt dort von Hand seine Zeile (Vorgabe 3 wie im Prototyp).
   */
  wkrLeerzeilen: number
  /** Abweichende Zahl der Leerzeilen für einzelne Klassen; fehlt = `wkrLeerzeilen`. */
  wkrLeerzeilenKlasse: Partial<Record<ClassId, number>>
  /**
   * Leerzeilen je Seite auf den gemeinsamen Bögen der Clubmeisterschaft („Papier sparen“,
   * `wkrClubGemeinsam`; seit 26.11.2026 ebenso einer Meisterschaft, `wkrMeisterschaftGemeinsam` `alle`): Dort teilen sich alle Klassen einer Seite die Zeilen für
   * Nachmeldungen – sie stehen einmal am Ende der Seite statt nach jeder Klasse. Eine eigene
   * Zahl neben `wkrLeerzeilen`, weil sie etwas anderes zählt: Wer „Papier sparen“ ab- und
   * wieder anschaltet, findet beide Angaben wieder vor. Seit 24.11.2026 auch auf jedem gemeinsamen Bogen mit Klassen
   * in der Startfolge (`wkrGemeinsamFolge` `verzahnung`): Dort gibt es keine Klasse, an deren Ende sie stünden.
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
   * Folge der Zeilen auf einem gemeinsamen Bogen mehrerer Klassen (Clubmeisterschaft, mit und ohne „Papier sparen“;
   * seit 26.11.2026 auch Meisterschaften mit `wkrMeisterschaftGemeinsam`; Wunsch des Nutzers vom 24.11.2026): `getrennt` (Vorgabe, wie bisher) = je Klasse ein Block, die Klasse als
   * Zwischenüberschrift darüber; `verzahnung` = alle Starter gemischt in der Startfolge der Verzahnung, ohne Blöcke,
   * mit einer Spalte „Klasse“ hinter der Startnummer – der Wettkampfrichter liest den Bogen von oben nach unten in
   * der Folge, in der die Boote kommen. Die Leerzeilen stehen dann am Ende jeder Seite (`wkrLeerzeilenSeite`).
   */
  wkrGemeinsamFolge: WkrGemeinsamFolge
  /**
   * Gemeinsame WKR-Bögen mehrerer Klassen bei einer Meisterschaft (DM, UIM; R11-03, 26.11.2026): `aus` (Vorgabe, je
   * Klasse ein Bogen), `gleich` (gleich aufgebaute Bögen zusammen, wie bei der Clubmeisterschaft) oder `alle` (Papier
   * sparen, ohne Parcoursbild). Wirkt nur, wenn `eventKind` keine Clubmeisterschaft ist – die hat `wkrClubGemeinsam`.
   * Eine eigene Angabe statt `wkrClubGemeinsam` mitzunutzen, weil die Vorgaben verschieden sind: Bei der
   * Clubmeisterschaft ist Papier sparen das Übliche, bei einer Meisterschaft der eigene Bogen je Klasse mit seiner
   * Zeichnung. Wer die Art der Veranstaltung wechselt, findet beide Angaben wieder vor. `wkrGemeinsamFolge` und
   * `wkrLeerzeilenSeite` gelten für beide.
   */
  wkrMeisterschaftGemeinsam: WkrMeisterschaftGemeinsam
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
   * Der Buchstabe vor den Startnummern der Klasse E (unter UIM „Dolphin“): „E“ (E01, Vorgabe) oder
   * „D“ (D01). Seit 24.11.2026 unter jedem Regelwerk, auch DM (vorher nur unter UIM). Nur für Nummern,
   * die neu vergeben werden – vorhandene bleiben, bis „Startnummern neu vergeben“ sie ersetzt
   * (config/catalog.ts `startNrPraefixe`); die Startnummern-Bereiche (E01–E30) folgen dem Buchstaben.
   * Eine Einstellung: in Sicherung und Vorlage.
   */
  dolphinPraefix: 'E' | 'D'
  /**
   * Eigene Nummernbereiche der klassenbasierten Startnummern je Klasse nach Größengruppe der Westen
   * (Wunsch des Nutzers vom 19.11.2026). Nur Abweichungen: Fehlt eine Klasse, gilt die Vorgabe des
   * Regelwerks (config/catalog.ts `startNrBereicheOf`, DM: DMYV-Liste); eine leere Liste heißt
   * „bewusst ohne Bereiche“. Eine Einstellung: in Sicherung und Vorlage.
   */
  startNrBereiche: StartNrBereiche
  /**
   * Startnummern, deren Weste fehlt (verloren, kaputt), wie auf der Weste geschrieben („512“,
   * „E105“): Die Vergabe überspringt sie (domain/startnrBereiche.ts). Über alle Klassen, eine
   * Einstellung des Ausrichters: in Sicherung und Vorlage.
   */
  fehlendeStartNr: string[]
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
  /**
   * ntfy-Server für den Gerätebetrieb (Anzeigetafel und Zuschauer über Lese-Links, ab E6): '' = die Vorgabe des
   * Programms (geraete/themen.ts NTFY_VORGABE, Entscheidung des Nutzers vom 16.11.2026: ntfy.adminforge.de,
   * änderbar), sonst eine geprüfte Adresse (lib/serverAdresse.ts). Eine Einstellung: reist mit Sicherung und
   * Vorlage. Raum und Schlüssel dagegen liegen nur in diesem Browser (geraete/ablage.ts), nie im Stand. Ohne
   * bewusst geöffneten Raum verbindet sich die Anwendung mit keinem Server.
   */
  geraeteServer: string
  /**
   * Digitale Erfassung durch die Wettkampfrichter (W1, Plan docs/plan-wkr-w1.md vom 21.11.2026): Modus und Status je
   * Liste, offene Rückfragen und Vorschläge, Abschlüsse (types/wkr.ts; Actions state/reducer/wkr.ts, Logik src/wkr/).
   * Die Werte selbst stehen in `eingaben`. Gehört zur Veranstaltung: in der Sicherung, nicht in der Vorlage. Nie ein
   * Gerätename (F10) – die Herkunft liegt gerätelokal am Bedienrechner, der Name im Verlauf.
   */
  wkr: WkrStand
}
