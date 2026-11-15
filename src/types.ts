import type { PokalPlatzVariante, PokalVariante, RawAufbau } from './config/schema'

export type ClassId = 'E' | '1' | '2' | '3' | '4' | '5' | '6' | '7'

/** Welche Herkunft gezeigt wird. `none` blendet sie aus (Clubmeisterschaft). */
export type OriginMode = 'verein' | 'bundesland' | 'land' | 'none'

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
 */
export type ParallelRunde = 'pre' | 'semi' | 'final' | `rerun-${string}`

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
   * (Halbfinale, Finals, Wiederholung): Sie werden je Klasse festgeschrieben und gelöst, und der
   * Plan einer Runde sammelt die Starts aller Klassen. Im Vorlauf fehlt die Angabe.
   */
  klasse?: ClassId
  /**
   * Nur in den Finals: um welche Plätze dieser Start geht – 1 = „compete for the 1st and 2nd
   * place“, 3 = „compete for the 3rd and 4th place“ (Regel 960, Pkt. 4.4).
   */
  finale?: 1 | 3
}

/** Der festgeschriebene Startplan einer Runde: Er wird nicht neu gerechnet. */
export interface ParallelPlanFest {
  runde: ParallelRunde
  starts: ParallelStartFest[]
}

export type ParallelPlaene = Partial<Record<ParallelRunde, ParallelPlanFest>>

/**
 * Art der Startnummern. Eine Veranstaltung nutzt genau eine davon:
 * klassenbasiert (E01, 101, 312 …) oder klassisch fortlaufend (1, 2, 3 …).
 * Die Nummer steht in beiden Fällen in `Starter.startNr`; intern wird ein
 * Starter immer über seine `id` angesprochen, nie über die Startnummer.
 */
export type StartNrMode = 'klasse' | 'klassisch'

/**
 * Darstellung der Herkunft auf Listen: ausgeschrieben, als Kürzel – oder mit Flagge (Flagge +
 * Kürzel, Flagge + ausgeschrieben, nur Flagge). Flaggen gibt es für die Herkunft „Bundesland“
 * und „Land“; für Vereine gilt eine Flaggen-Darstellung wie die ohne (lib/origin.ts).
 */
export type OriginStyle = 'lang' | 'kurz' | 'flagge-kurz' | 'flagge-lang' | 'flagge'

/** Art der Veranstaltung – steuert Vorgaben für Listen und Wertung. */
export type EventKind = 'meisterschaft' | 'club'

/**
 * WKR-Einteilung: Name des Wettkampfrichters je Parcours (Kennung aus der Verzahnung) und
 * Liste (`SheetTypeId`), siehe lib/einteilung.ts. Personennamen – nicht für die Vorlage.
 */
export type Einteilung = Record<string, Record<string, string>>

/**
 * Sprache der Wettkampfrichter-Bögen je Parcours (Kennung aus der Verzahnung, im
 * Parallelslalom die des Racecourse) und Liste (`SheetTypeId`) – gebaut wie die
 * {@link Einteilung}, siehe lib/einteilung.ts. Keine Personendaten: eine Einstellung.
 */
export type WkrSprachen = Record<string, Record<string, Sprache>>

/** Eine Angabe je Klasse als freier Text (Boot, Co-Pilot); eine Klasse ohne Angabe fehlt. */
export type Besetzung = Partial<Record<ClassId, string>>

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
}

export type LaufzettelLayout = 'seite' | 'liste'

export type ErgebnisNamen = 'voll' | 'kurz' | 'ohne'
/** Herkunft auf den Wertungslisten: gar nicht oder in einer der Darstellungen der Listen. */
export type ErgebnisHerkunft = 'aus' | OriginStyle
export type ErgebnisFassung = 'aushang' | 'intern'
export interface ErgebnisListenOptionen {
  aushang: { namen: ErgebnisNamen; herkunft: ErgebnisHerkunft }
  intern: { herkunft: ErgebnisHerkunft }
}

// ---------------------------------------------------------------------------
// Wettkampfrichter-Listen: aufgelöste Konfiguration (config/build.ts).
// Unverändert aus dem Fehlerpunkte-Prototyp übernommen, damit dessen
// Konfigurationsschicht ohne Umbau darauf baut.
// ---------------------------------------------------------------------------

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
