import type { Flagge } from '../domain/flaggen'
import type { Locale } from '../i18n'
import type { ClassId } from './starter'
import type { ParallelRunde } from './planung'
import type { LogoBild } from './einstellungen'
import type { ErgebnisHerkunft } from './wertung'

// Betrieb am Wettkampftag: Anzeigetafel und Start-Freigabe (Plan vom 16.11.2026, §3). Die Folge der
// Starts wird nie gespeichert, sondern aus Verzahnung und Läufen abgeleitet (betrieb/folge.ts);
// im Stand stehen nur, was gezeigt wurde, und die Abweichungen. Die Typen sind vollständig, auch
// für spätere Etappen – deren Felder bleiben bis dahin auf ihren Vorgaben (leer, aus).

/**
 * Ein Bereich des Betriebs: die Kennung eines Parcours (`parcoursList[].id`) oder `parallel` für
 * den Parallelslalom (ab E4, nur unter UIM). Gilt NUR für den Betrieb; Rechte der Geräte nutzen die
 * Kennungen der WKR-Einteilung (Racecourse A/B).
 */
export type BereichId = string

/**
 * Ein Punkt des Programms eines Bereichs: ein Lauf des Manövrierens oder eine Runde des
 * Parallelslaloms. Mit „Versuche direkt nacheinander“ gibt es nur `lauf:1`; seine Starts tragen je
 * Versuch Lauf 1 … n. So bleiben die Kennungen stabil, wenn der Schalter oder die Zahl der Läufe
 * sich ändert.
 */
export type PunktId = `lauf:${number}` | `runde:${ParallelRunde}`

/**
 * Ein Start, benannt durch das, was ihn ausmacht – nie durch seine Stelle in der Folge.
 * - `m`: Manövrieren, `starter` = Starter-ID, `lauf` = Lauf bzw. Versuch (Schlüssel der Eingaben:
 *   `eingaben[laufSchluessel(disziplin, lauf)][starter]`).
 * - `p`: Parallelslalom (ab E4), ein Start einer festgeschriebenen Runde; `a`/`b` aus
 *   `fest.starts[i].a/b`, nie aus den aufgelösten Heats (ein gelöschter Starter würde dort zum Dummy).
 * Als Text (Kennung in `gezeigt` usw.) über `refKey` in betrieb/folge.ts.
 */
export type StartRef =
  | { art: 'm'; starter: string; lauf: number }
  | { art: 'p'; runde: ParallelRunde; attempt: 1 | 2; a: string | null; b: string | null }

/**
 * Wohin ein Start verschoben wird (E2, S-4/S-6): vor oder hinter einen anderen Start (Kennung) oder an eine
 * Punktgrenze – „vor Lauf 3“ (vor dessen ersten Start), „nach Lauf 2“ (hinter dessen letzten).
 */
export type VerschiebeZiel = { vor: string } | { nach: string } | { vorPunkt: PunktId } | { nachPunkt: PunktId }

/** Art einer Meldung auf der Anzeigetafel: Hinweis, Störung oder Pause. */
export type MeldungArt = 'info' | 'stoerung' | 'pause'

/** Eine freie Meldung eines Bereichs (Störung, Wartezeit, Begrüßung …). */
export interface Meldung {
  text: string
  art: MeldungArt
}

/** Ein Start, der auf der Anzeigetafel stand: Kennung (`refKey`) und Zeitpunkt (`action.zeit`). */
export interface GezeigterStart {
  ref: string
  zeit: number
}

/** Was im Betrieb eines Bereichs geschehen ist und wovon abgewichen wird. */
export interface BereichBetrieb {
  /** Ausdrücklich begonnene Punkte („Lauf 2 beginnen“), als Menge; freigegeben wird nach Punkt. */
  begonnen: PunktId[]
  /** Verlauf der Anzeige; der letzte Eintrag steht „im Boot“. */
  gezeigt: GezeigterStart[]
  /** E2, „ab hier einsteigen“: erledigt, aber nie gezeigt (keine Messung). Kennungen (`refKey`). */
  ohneAnzeige: string[]
  /** E2: zurückgestellte Starts (bleiben sichtbar). Kennungen. */
  zurueckgestellt: string[]
  /**
   * E2: Schnappschuss der umgestellten Punkte (Kennungen), nur wenn von der abgeleiteten Folge abgewichen wird;
   * Punkte, die wie abgeleitet stehen, fehlen darin und folgen der Verzahnung (betrieb/schritte.ts `schnappschuss`).
   */
  reihenfolge: string[] | null
  /** E2: Klassen, deren Boot fehlt („Boot fehlt“). */
  ausgesetzt: ClassId[]
  /** E2: „Andere Klassen vorziehen“, solange eine Klasse aussetzt. */
  vorziehen: boolean
  meldung: Meldung | null
}

/** Der Betrieb aller Bereiche. Ein Bereich ohne Eintrag hat noch nicht begonnen. */
export interface Betrieb {
  bereiche: Record<BereichId, BereichBetrieb>
}

/** Namen auf der Anzeigetafel: wie der Aushang der Wertungslisten, voll, Nachname gekürzt oder keine. */
export type AnzeigeNamen = 'aushang' | 'voll' | 'kurz' | 'ohne'

/** Sprache der Anzeigetafel: die der Listen (Regelwerk) oder fest. */
export type AnzeigeSprache = 'regelwerk' | 'de' | 'en'

/** Einstellungen der Anzeigetafel (und ab E2/E3 der Startfolge im Betrieb). */
export interface AnzeigeEinstellungen {
  /** Kopfzeile über allen Bereichen; `null` = Name und Jahr der Veranstaltung, '' = keine. */
  kopfzeile: string | null
  /** Welche Bereiche die gemeinsame Anzeigetafel zeigt, in dieser Reihenfolge; [] = alle in der Folge der Verzahnung. */
  bereiche: BereichId[]
  /** Den vorigen Start mit anzeigen. */
  davor: boolean
  /** Den Namen des Parcours anzeigen. */
  parcoursName: boolean
  /** Herkunft wie auf den Wertungslisten: eine Darstellung oder `aus`; bei `originMode` 'none' ohnehin keine. */
  herkunft: ErgebnisHerkunft
  namen: AnzeigeNamen
  /** Feinjustage der Schriftgröße, 0,7 bis 1,3. */
  skala: number
  sprache: AnzeigeSprache
  /** Die Logos der Listen auf der Anzeigetafel zeigen – nur auf der Tafel am Bedienrechner. */
  logos: boolean
  /** E3: so viele Starts „am Steg“ bzw. „vor Steg“ (Zuschauerliste, Prognose). */
  amSteg: number
  vorSteg: number
  /** E2: Beim Verschieben die Verzahnung halten (die Spur rutscht mit). */
  verzahnungHalten: boolean
  /** E3: eigene Startabstände je Klasse in Sekunden; nur Abweichungen, die Vorgabe wird beim Lesen aufgelöst. */
  abstaende: Partial<Record<ClassId, number>>
}

// --- Sicht ---------------------------------------------------------------------------------------

/** Die Herkunft eines Starters, wie sie die Anzeigetafel zeigt (Teil von lib/origin.ts `HerkunftAnzeige`). */
export interface SichtHerkunft {
  text: string
  klartext: string
  /** Nur bei „nur Flagge“: das Kürzel daneben. */
  druck: string
  /** Textalternative der Flagge; leer, wenn der Name daneben steht. */
  alt: string
  flagge?: Flagge
}

/** Ein Starter in der öffentlichen Sicht: nie Geburtsdatum, Gewicht, Geschlecht. */
export interface SichtStarter {
  startNr: string
  /** Vorname und Nachname nach der Einstellung `namen`; '' bei „ohne“. */
  name: string
  klasse: ClassId
  /** `null`: keine Herkunft (aus, Clubmeisterschaft, leer). */
  herkunft: SichtHerkunft | null
}

/** Eine Klasse, wie die Anzeigetafel sie nennt – in deren Sprache (unter UIM heißt E „Dolphin“). */
export interface SichtKlasse {
  /** Nur der Name: „1“, „Dolphin“. */
  name: string
  /** Mit Wort: „Klasse 1“, „Class Dolphin“. */
  titel: string
  farbe: string
}

/** Ein Punkt in der Sicht: Kennung, Überschrift in der Sprache der Tafel, die Läufe darin. */
export interface SichtPunkt {
  id: PunktId
  titel: string
  /** Die Läufe des Punkts: [n], mit „Versuche nacheinander“ [1 … n]. */
  laeufe: number[]
}

/** Ein Start in der Sicht (Manövrieren). Der Parallelslalom kommt mit E4 (`sv` steigt). */
export interface SichtStart {
  /** Kennung des Starts (`refKey`) – für ZEIGEN, ZURUECK. */
  key: string
  starter: string
  lauf: number
  punkt: PunktId
  /** Der Lauf in der Sprache der Tafel: „2. Lauf“, „Attempt 2“. */
  titel: string
}

/** Ein Bereich in der Sicht. */
export interface SichtBereich {
  id: BereichId
  /** Name in der Sprache der Tafel („Parcours 1“ → „Course 1“). */
  name: string
  art: 'manoevrieren' | 'parallel'
  /** Betrieb möglich: Verzahnung (bzw. Runde) festgeschrieben. */
  fest: boolean
  /** Der laufende Punkt: der letzte begonnene im Programm; `null`, solange keiner begonnen ist. */
  punkt: SichtPunkt | null
  /** Der erste Punkt des Programms, der nicht begonnen ist. */
  naechsterPunkt: SichtPunkt | null
  /** „Im Boot“: der zuletzt gezeigte Start. */
  aktuell: SichtStart | null
  vorig: SichtStart | null
  /** Seit wann `aktuell` steht (Zeit des Hosts, ms); die Dauer rechnet das Gerät. */
  seit: number | null
  /** Die nächsten offenen Starts begonnener Punkte (höchstens amSteg + vorSteg + 1); der erste ist der nächste. */
  offen: SichtStart[]
  /** Zahl aller offenen Starts begonnener Punkte. */
  offenZahl: number
  /** Nicht erledigte Starts vor dem Zeiger (Nachmeldung, entferntes X, verpasster Lauf). */
  nachzuholen: SichtStart[]
  meldung: Meldung | null
  // --- ab sv 2 (E2: Steuerung an der Start-Freigabe) ---
  /** Die begonnenen Punkte; Starts anderer Punkte warten (die Start-Freigabe kennzeichnet sie). */
  begonnen: PunktId[]
  /**
   * Alle offenen Starts ALLER Punkte in ihrer Folge, auch nicht begonnener (ohne zurückgestellte, ohne
   * „Boot fehlt“): „Anderen Starter wählen“ – die nächsten und die Suche nach Startnummer (B-5, S-4).
   */
  waehlbar: SichtStart[]
  /** Zurückgestellte Starts (B-3), in der Folge. */
  zurueckgestellt: SichtStart[]
  /** Starts ausgesetzter Klassen („Boot fehlt“, V-5/L-7), in der Folge. */
  bootFehlt: SichtStart[]
  /** Der Punkt, auf den sich Aussetzen und Vorziehen der Klassen beziehen (betrieb/folge.ts `arbeitsPunkt`). */
  arbeitsPunkt: SichtPunkt | null
  /** Alle Punkte des Programms in ihrer Folge – für „vor/nach Lauf n“ (S-6) und „Einsteigen ab …“. */
  programm: SichtPunkt[]
  /** Die Klassen des Arbeitspunkts in der Folge ihres nächsten Starts, ausgesetzte dahinter (B-9, B-10). */
  klassenFolge: SichtKlassenStand[]
  /** „Andere Klassen vorziehen“, solange eine Klasse aussetzt (V-5). */
  vorziehen: boolean
  /** Die Folge weicht von der Verzahnung ab (verschoben, vorgezogen, Klasse ausgesetzt …). */
  abweichend: boolean
  /** „Einsteigen ab …“: je Punkt (und je Klasse darin) der erste noch nicht gezeigte Start – Kennung für BETRIEB_AB. */
  einstieg: SichtEinstieg[]
}

/** Eine Klasse an der Start-Freigabe (B-9, B-10). */
export interface SichtKlassenStand {
  klasse: ClassId
  /** So viele Starts der Klasse stehen im Arbeitspunkt noch aus (offen oder „Boot fehlt“). */
  offen: number
  /** Das Boot fehlt: Die Klasse setzt aus. */
  ausgesetzt: boolean
  /** Lässt sich vorziehen: Sie teilt ihre Spur mit einer anderen fahrenden Klasse und setzt nicht aus. */
  verschiebbar: boolean
}

/**
 * Ein Einstieg für „Einsteigen ab …“: der erste noch nicht gezeigte (und nicht entfallene) Start eines Punkts
 * bzw. einer Klasse darin – als Start, damit die Start-Freigabe ihn nennen kann, auch wenn er schon „ohne
 * Anzeige“ erledigt ist (sein Starter steht dafür in `starter`).
 */
export interface SichtEinstieg extends SichtStart {
  /** `null`: der erste Start des Punkts überhaupt. */
  klasse: ClassId | null
}

/**
 * Die öffentliche Sicht (betrieb/sicht.ts `sichtOeffentlich`): alles, was Anzeigetafel,
 * Zuschauer und Start-Freigabe sehen. Zeitunabhängig – „seit m:ss“ rechnet der Bildschirm.
 */
export interface OeffentlicheSicht {
  /** Fassung der Sicht; steigt, wenn sich ihre Form ändert (2: Steuerung der Etappe E2). */
  sv: 2
  /** Kopfzeile; '' = keine. */
  kopf: string
  /** Name der Veranstaltung (ab sv 2) – für `{veranstaltung}` in den Meldungsvorlagen (betrieb/meldungen.ts). */
  veranstaltung: string
  sprache: Locale
  skala: number
  /** Nur auf der Tafel am Bedienrechner und nur mit mindestens einem Logo. */
  logos?: { links: LogoBild | null; rechts: LogoBild | null }
  einst: { davor: boolean; parcoursName: boolean }
  /** Die Bereiche der gemeinsamen Anzeigetafel (`#/anzeige`), in ihrer Reihenfolge. */
  auswahl: BereichId[]
  /** Die Klassen, die in der Sicht vorkommen. */
  klassen: Partial<Record<ClassId, SichtKlasse>>
  /** Nur die Starter, die in der Sicht vorkommen. */
  starter: Record<string, SichtStarter>
  /** Alle Bereiche in der Folge der Verzahnung. */
  bereiche: SichtBereich[]
}
