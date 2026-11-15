import type {
  AppState,
  Streichlaeufe,
  BoatConfig,
  ClassId,
  EventKind,
  OriginMode,
  Parcours,
  StartNrMode,
  RunningNumberConfig,
  Starter,
  TrackItem,
  WechselFaktor,
  ErgebnisFassung,
  ErgebnisHerkunft,
  ErgebnisListenOptionen,
  ErgebnisNamen,
  Sprache,
  LaufzettelLayout,
  ParallelRunde,
  WertungsDisziplin,
} from '../types'
import type { RawAufbau } from '../config/schema'
import { SCHEMA_VERSION } from '../types'
import { CLASS_IDS } from '../domain/classes'
import {
  moveInOrder,
  orderBySize,
  redistributeNumbers,
  renumberSequential,
  sortedByStartNr,
} from '../domain/startnumbers'
import { mergeStarters } from '../import/starterMerge'
import { haengeUm, ohneParcours, setzeName } from '../lib/einteilung'
import { setzeBesetzung } from '../lib/besetzung'
import { gueltigeZellen, laufSchluessel, nurStarter, OHNE_LAUF, setzeWerte, starterfeldFest, type EingabeZelle } from '../lib/eingaben'
import { attemptSchluessel } from '../lib/parallelSchluessel'
import { abmeldeZellen, ergaenzeAbmeldungen, mitAbmeldung, mitAbmeldungenInRunden, mitAbmeldungInRunden } from '../lib/abmeldung'
import { normalisiereZusatzListen, vorgabeListenVon } from '../lib/listen'
import { beispielEingaben, beispielRunde, zufallAus, type Zeitnahme } from '../lib/beispielwerte'
import { configFor, type Konfig } from '../config/konfig'
import { geaenderteListen, listenStandNach } from '../lib/listenStand'
import { streichlaeufeVon } from '../lib/ergebnis'
import { mitTor5Umzug } from './tor5'
import { istKennung } from '../lib/qr'
import { isSprache } from '../config/sprache'
import { canonicalRunningNumbers } from '../planung/running'
import { mitVorlaufPlan, VORLAUF, vorlaufGebunden } from '../planung/parallelRunden'
import { loeseRunde, schreibeRundeFest } from '../lib/parallelStage'
import { setzeNichtWerten, WERTUNGS_DISZIPLINEN } from '../lib/disziplinen'
import { POKAL_LEER, POKAL_PLATZ_VARIANTEN, istPokalVariante, pokalVorgabe, pokalZahl, punkteListe, type PokalPlatzVariante, type PokalVariante } from '../config/pokal'
import { aufbauOf, beschriftungOf, DEFAULT_AUFBAU, DEFAULT_BESCHRIFTUNG, DEFAULT_REGELWERK, hasParallel, regelwerkOf, startNrPraefixe } from '../config/catalog'
import { istGeschlecht } from '../domain/geschlecht'

/**
 * Alle Änderungen am Zustand laufen als Action durch diesen Reducer.
 *
 * Der Reducer ist **rein und deterministisch**: Er würfelt nicht und fragt keine
 * Uhr. IDs und Zufallsdaten bringt die Action mit. Nur so lässt sich dieselbe
 * Action später auf mehreren Geräten anwenden (Mehr-Browser-Betrieb über ntfy)
 * und kommt überall zum selben Ergebnis.
 */
export type Action = Aenderung & {
  /**
   * Zeitpunkt, zu dem die Action entstand (Millisekunden seit 1970); der Store setzt ihn.
   * Er wird zum Stand der Wertungslisten, die sich durch die Action ändern
   * (lib/listenStand.ts). Fehlt er, bleibt deren Zeitpunkt unbekannt.
   */
  zeit?: number
}

type Aenderung =
  | { type: 'SET_EVENT'; patch: Partial<Pick<AppState, 'eventName' | 'eventJahr' | 'laufCount'>> }
  | { type: 'SET_EVENT_KIND'; eventKind: EventKind }
  | { type: 'SET_REGELWERK'; regelwerk: string }
  | { type: 'SET_AUFBAU'; aufbau: string }
  /**
   * Die eigenen Aufbauten als Ganzes ersetzen (anlegen, ändern, löschen, einspielen). Die
   * Action bringt die fertige, geprüfte Liste mit; mit `aufbau` wird zugleich dorthin
   * gewechselt. Gibt es den gewählten Aufbau danach nicht mehr, gilt wieder die Vorgabe.
   */
  | { type: 'SET_EIGENE_AUFBAUTEN'; aufbauten: RawAufbau[]; aufbau?: string }
  /** Gewicht aus der Verwiegung; `null` heißt „noch nicht gewogen“. */
  | { type: 'SET_WEIGHT'; id: string; gewicht: number | null }
  /** Eigenes Durchschnittsgewicht setzen; `null` oder der Wert des Regelwerks entfernt den Eintrag. */
  | { type: 'SET_SOLLGEWICHT'; klasse: ClassId; kg: number | null }
  | { type: 'RESET_SOLLGEWICHT' }
  /**
   * Verzahnung festschreiben oder freigeben. Beim Festschreiben bringt die
   * Action die gerade gezeigten Spuren mit; sie werden als feste Anordnung
   * übernommen, damit ein später nachgemeldeter Starter die Verteilung der
   * Klassen nicht mehr verschiebt.
   */
  | { type: 'SET_VERZAHNUNG_LOCK'; locked: boolean; tracks?: Record<string, TrackItem[][]> }
  | { type: 'SET_LIST_OPTIONS'; patch: Partial<Pick<AppState, 'showBirthdate' | 'listOrigin'>> }
  /** Eigenes Kürzel zu einem Namen setzen; ein leeres Kürzel entfernt den Eintrag (dann gilt wieder die Vorgabe). */
  | { type: 'SET_ORIGIN_SHORT'; name: string; short: string }
  | { type: 'SET_ORIGIN_MODE'; originMode: OriginMode }
  | { type: 'SET_BOATS'; boats: BoatConfig }
  | { type: 'SET_CLASS4_SMALL'; class4Small: boolean }
  | { type: 'SET_PARALLEL_ORDER_BY_STARTNR'; value: boolean }
  /** Parallelslalom: strenge Klassentrennung (Regel 960, Pkt. 4.4) an oder aus. */
  | { type: 'SET_PARALLEL_STRENG'; value: boolean }
  /**
   * Parallelslalom: die nächste Runde einer Klasse (Halbfinale, Finals, Wiederholung)
   * festschreiben bzw. die letzte wieder lösen (lib/parallelStage.ts). Wer fährt, rechnet der
   * Reducer aus dem Stand – die Action nennt nur Klasse und Runde und wirkt nicht, wenn diese
   * Runde für die Klasse gerade nicht ansteht. Beim Lösen gehen die Werte der Klasse in der Runde.
   */
  | { type: 'PARALLEL_RUNDE_FESTSCHREIBEN'; klasse: ClassId; runde: ParallelRunde }
  | { type: 'PARALLEL_RUNDE_LOESEN'; klasse: ClassId; runde: ParallelRunde }
  | { type: 'SET_RUNNING_NUMBERS'; patch: Partial<RunningNumberConfig> }
  /**
   * `replace`: Die Liste gilt danach als Ganzes; wiedererkannte Starter behalten
   * ihre ID (Startlisten und Ergebnisse verweisen darauf). `merge`: Nur neue
   * Starter kommen hinzu, Dubletten (Klasse + Name) werden übergangen.
   */
  /**
   * `auswahlAusDatei`: Die Quelle kennt die Auswahl für die Pokalauswertung (Teilnehmerdaten-
   * Datei) – sie gilt dann wie geladen. Ohne (Excel) bleibt eine bestehende Abwahl stehen.
   */
  | { type: 'IMPORT_STARTERS'; starters: Starter[]; mode: 'replace' | 'merge'; auswahlAusDatei?: true }
  /** `beispiel`: erfundene Starter aus den Beispieldaten – das Feld gilt danach als Beispiel-Starterfeld. */
  | { type: 'ADD_STARTERS'; starters: Starter[]; beispiel?: boolean }
  | { type: 'UPDATE_STARTER'; id: string; patch: Partial<Omit<Starter, 'id'>> }
  | { type: 'MOVE_STARTER'; id: string; target: 'first' | 'last' | 'up' | 'down' }
  | { type: 'ORDER_CLASS_BY_SIZE'; klasse: ClassId }
  | { type: 'SET_START_NR_MODE'; mode: StartNrMode }
  /** Vergibt alle Startnummern neu – nach der gewählten Art, siehe {@link assignStartNumbers}. */
  | { type: 'ASSIGN_START_NUMBERS' }
  | { type: 'REMOVE_STARTER'; id: string }
  /**
   * Nach Beginn des Wettkampfs statt Entfernen: als „nicht gestartet“ eintragen (X in jedem Lauf
   * ohne erfasste Werte) bzw. diese Abmeldung als Ganzes zurücknehmen – lib/abmeldung.ts.
   */
  | { type: 'ABMELDEN_STARTER'; id: string }
  | { type: 'ANMELDEN_STARTER'; id: string }
  | { type: 'CLEAR_CLASS'; klasse: ClassId }
  | { type: 'CLEAR_ALL_STARTERS' }
  | { type: 'ADD_PARCOURS'; id: string }
  | { type: 'SET_PARCOURS_PRESET'; parcours: { id: string; classIds: ClassId[] }[]; wechselFaktor?: WechselFaktor }
  | { type: 'REMOVE_PARCOURS'; id: string }
  | { type: 'RENAME_PARCOURS'; id: string; name: string }
  | { type: 'SET_PARCOURS_CLASSES'; id: string; classIds: ClassId[] }
  | { type: 'SET_PARCOURS_FACTOR'; id: string; wechselFaktor: WechselFaktor }
  | { type: 'SET_PARCOURS_TRACKS'; id: string; tracks: TrackItem[][] }
  | { type: 'RESET_TRACKS'; id: string }
  /**
   * Name des Wettkampfrichters an einer Liste auf einem Parcours; ein leerer Name entfernt
   * den Eintrag. Je Feld eine Action (nicht die ganze Einteilung), damit zwei Geräte, die
   * verschiedene Felder ausfüllen, einander nichts überschreiben.
   */
  | { type: 'SET_WKR_NAME'; parcoursId: string; typeId: string; name: string }
  /** Boot bzw. Co-Pilot einer Klasse (Block „Besetzung“); ein leerer Text entfernt die Angabe. */
  | { type: 'SET_BOOT'; klasse: ClassId; text: string }
  | { type: 'SET_CO_PILOT'; klasse: ClassId; text: string }
  /**
   * Leerzeilen der Wettkampfrichter-Listen: allgemein (`klasse` fehlt) oder für eine Klasse;
   * `null` = wieder die allgemeine Zahl bzw. die Vorgabe. `alleKlassen` verwirft dabei die
   * abweichenden Zahlen einzelner Klassen.
   */
  | { type: 'SET_WKR_LEERZEILEN'; klasse?: ClassId; anzahl: number | null; alleKlassen?: boolean }
  | { type: 'SET_WKR_RUECKSEITE'; rueckseite: boolean }
  | { type: 'SET_WKR_CLUB_GEMEINSAM'; gemeinsam: boolean }
  /**
   * Seitenaufteilung der Wettkampfrichter-Listen: Starter je Seite (0 oder unbrauchbar =
   * automatisch) und „Teilen ab“ (0 = immer). Nur was im Patch steht, ändert sich.
   */
  | { type: 'SET_WKR_SEITEN'; patch: { zeilenJeSeite?: number | null; teilenAb?: number | null } }
  /** Bezeichnung der Bojen-Seiten auf den Listen; eine unbekannte Kennung gilt als Vorgabe. */
  | { type: 'SET_BESCHRIFTUNG'; beschriftung: string }
  /**
   * Sprache der Wettkampfrichter-Bögen für die genannten Listen (eine Zeile der Einteilung
   * oder „alle auf …“); `null` = wieder die Sprache des Regelwerks.
   */
  | { type: 'SET_WKR_SPRACHE'; typeIds: readonly string[]; sprache: Sprache | null }
  /** Leerzeilen je Seite auf gemeinsamen Bögen (Clubmeisterschaft, Papier sparen); `null` = Vorgabe. */
  | { type: 'SET_WKR_LEERZEILEN_SEITE'; anzahl: number | null }
  /**
   * „Tor 5 übernimmt die Parcoursüberwachung“. Was zur Liste Tor 5 gehört (Disq., Bemerkung,
   * Haken „erfasst“, Name des Wettkampfrichters), zieht dabei auf die zusammengelegte Liste
   * um und beim Abschalten zurück.
   */
  | { type: 'SET_TOR5_MIT_PARCOURS'; on: boolean }
  /** „Versuche direkt nacheinander“ – nur unter einem Regelwerk, das den Schalter kennt. */
  | { type: 'SET_VERSUCHE_NACHEINANDER'; on: boolean }
  /** Eine zusätzliche Liste außerhalb des Aufbaus an- oder abwählen (lib/listen.ts). */
  | { type: 'SET_ZUSATZ_LISTE'; liste: string; an: boolean }
  | { type: 'SET_LAUFZETTEL_LAYOUT'; layout: LaufzettelLayout }
  | { type: 'SET_ERGEBNIS_LISTEN'; fassung: ErgebnisFassung; patch: { namen?: ErgebnisNamen; herkunft?: ErgebnisHerkunft } }
  /**
   * Erfasste Werte setzen, Zelle für Zelle (Lauf-Schlüssel, Starter-ID, Feld-Kennung); ein
   * leerer Wert löscht die Zelle. Eine Action je Eingabe – oder ein Bündel, etwa wenn später
   * ein Wettkampfrichter seine Liste vom eigenen Gerät abliefert: Verschiedene Geräte
   * schreiben verschiedene Zellen und überschreiben einander nichts.
   */
  | { type: 'SET_EINGABEN'; zellen: EingabeZelle[] }
  /** Alle erfassten Werte verwerfen. Einzelne Zellen löscht `SET_EINGABEN` mit leerem Wert. */
  | { type: 'CLEAR_EINGABEN' }
  /** Streichläufe der Gesamtwertung: `auto` (Regel) oder eine feste Zahl. */
  | { type: 'SET_STREICHLAEUFE'; streichlaeufe: Streichlaeufe }
  /**
   * Beispielwerte für alle Listen des Aufbaus. Der Zufall steckt in der `saat`: Dieselbe
   * Action ergibt überall dieselben Werte.
   */
  /**
   * Gefüllt wird nur das Gewählte (Entscheidung des Nutzers vom 15.11.2026): das Manövrieren
   * (`laeufe`, fehlt = alle Läufe) oder einzelne Runden des Parallelslaloms.
   * `runden`: diese Runden des Parallelslaloms füllen – nur festgeschriebene.
   * `nurRunden`: das Manövrieren bleibt, wie es ist.
   * `nurLeere`: In den Runden werden nur Attempts ohne Werte gefüllt – sonst stünden nach dem
   * Füllen eines Halbfinales andere Werte in den Klassen, deren Finals schon auf ihrem
   * Halbfinale stehen.
   */
  | { type: 'FILL_BEISPIELWERTE'; zeitnahme: Zeitnahme; saat: number; laeufe?: number[]; runden?: ParallelRunde[]; nurRunden?: boolean; nurLeere?: boolean }
  /**
   * Die erfassten Werte des Gewählten verwerfen: Läufe des Manövrierens (mit dem 1. Lauf auch die
   * Listen ohne Lauf, die Knoten – so, wie die Beispielwerte sie füllen) und/oder Runden des
   * Parallelslaloms (beide Attempts). Festgeschriebene Pläne bleiben. Bleibt danach kein Wert
   * übrig, gilt es wie `CLEAR_EINGABEN`.
   */
  | { type: 'CLEAR_EINGABEN_TEIL'; laeufe?: number[]; runden?: ParallelRunde[] }
  | { type: 'LOAD_STATE'; state: AppState }
  /** `kennung`: die Kennung der neuen Veranstaltung (lib/qr.ts) – eine andere als bisher. */
  | { type: 'RESET_ALL'; kennung?: string }
  /**
   * Der Veranstaltung ihre Kennung für die QR-Codes geben. Wirkt nur, solange sie keine hat:
   * Gedruckte Bögen tragen die Kennung, sie darf sich danach nicht mehr ändern.
   */
  | { type: 'SET_KENNUNG'; kennung: string }
  /** Eine Variante der Pokalauswertung ein- oder ausschalten; im Stand bleibt nur die Abweichung vom Regelwerk. */
  | { type: 'SET_POKAL_VARIANTE'; variante: PokalVariante; an: boolean }
  /** Punkte je Platz einer Variante (Platz 1, 2, 3 …); `null` oder die Vorgabe selbst = wieder die Vorgabe. */
  | { type: 'SET_POKAL_PUNKTE'; variante: PokalPlatzVariante; punkte: number[] | null }
  /** UIM-Variante: Zahl der Besten und Mindestzahl der Starter je Herkunft; `null` = wieder die des Regelwerks. */
  | { type: 'SET_POKAL_UIM'; patch: { beste?: number | null; mindestens?: number | null } }
  /** „Nur ausgewählte Starter zählen“. Die Auswahl selbst bleibt beim Ausschalten stehen. */
  | { type: 'SET_POKAL_NUR_AUSWAHL'; an: boolean }
  /**
   * Auswahl für die Pokalauswertung: die genannten Starter zählen (oder nicht) bzw. ihre
   * Markierung wird umgekehrt. Ändert das Starterfeld nicht und geht deshalb auch, wenn schon
   * Ergebnisse erfasst sind.
   */
  | { type: 'SET_POKAL_ZAEHLT'; ids: readonly string[]; zaehlt: boolean }
  | { type: 'INVERT_POKAL_ZAEHLT'; ids: readonly string[] }
  /**
   * „Disziplin nicht werten“ für die genannten Klassen setzen oder lösen (lib/disziplinen.ts) –
   * die Entscheidung des O.O.D., eine (etwa in einer Klasse abgebrochene) Disziplin nicht in
   * Einzel- und Mannschaftswertung zu zählen. Für „alle Klassen“ nennt die Action alle.
   */
  | { type: 'SET_NICHT_WERTEN'; disziplin: WertungsDisziplin; klassen: readonly ClassId[]; an: boolean }
  /** Der Buchstabe vor den Startnummern der Klasse Dolphin (E oder D); gilt für neu vergebene Nummern. */
  | { type: 'SET_DOLPHIN_PRAEFIX'; praefix: 'E' | 'D' }
  | { type: 'SET_PARALLEL_ZEBRA'; zebra: boolean }

/** Leerzeilen je Klasse auf den Wettkampfrichter-Listen: Vorgabe wie im Prototyp (`emptyRows: 3`). */
/** Wertungslisten: Vorgabe wie bisher – volle Namen, Herkunft als Kürzel. */
export const ERGEBNIS_LISTEN_VORGABE: ErgebnisListenOptionen = { aushang: { namen: 'voll', herkunft: 'kurz' }, intern: { herkunft: 'kurz' } }

export const WKR_LEERZEILEN_VORGABE = 3
/** Bei der Clubmeisterschaft eine: Dort stehen viele Klassen auf einem Blatt. */
export const WKR_LEERZEILEN_CLUB = 1
/**
 * Gemeinsame Bögen (Clubmeisterschaft, Papier sparen): drei je Seite. Die Zeilen teilen sich
 * alle Klassen der Seite – drei reichen für die Nachmeldungen eines Blatts mit rund 20 Zeilen
 * und kosten weniger als bisher eine je Klasse, sobald mehr als drei Klassen darauf stehen.
 */
export const WKR_LEERZEILEN_SEITE_VORGABE = 3
export const WKR_LEERZEILEN_MAX = 30

/** Eine brauchbare Zahl von Leerzeilen (0 bis 30, ganz); sonst `undefined`. */
export function leerzeilenZahl(n: unknown): number | undefined {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(WKR_LEERZEILEN_MAX, Math.round(n))) : undefined
}

/** Fest eingestellt stehen mindestens so viele Starter auf einer Seite (wie im Prototyp). */
export const WKR_ZEILEN_JE_SEITE_MIN = 5
export const WKR_ZEILEN_JE_SEITE_MAX = 100
export const WKR_TEILEN_AB_MAX = 200

/** Starter je Seite: 0 = automatisch, sonst 5 bis 100; Unbrauchbares ist automatisch. */
export function zeilenJeSeiteZahl(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n) || Math.round(n) <= 0) return 0
  return Math.max(WKR_ZEILEN_JE_SEITE_MIN, Math.min(WKR_ZEILEN_JE_SEITE_MAX, Math.round(n)))
}

/** „Teilen ab“: 0 = immer, sonst bis 200; Unbrauchbares ist 0. */
export function teilenAbZahl(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(WKR_TEILEN_AB_MAX, Math.round(n))) : 0
}

/** Die Sprachen der Bögen je Liste: nur Einträge mit einer gültigen Sprache. */
export function wkrSprachenWert(x: unknown): AppState['wkrSprachen'] {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return {}
  return Object.fromEntries(Object.entries(x as Record<string, unknown>).filter((e): e is [string, Sprache] => isSprache(e[1])))
}

/** Eine gültige Form der Laufzettel; sonst die Vorgabe „eine Zeile je Seite“. */
export function laufzettelLayoutWert(x: unknown): LaufzettelLayout {
  return x === 'liste' ? 'liste' : 'seite'
}

/** Die Konfiguration zum Stand – eine reine Funktion, der Reducer bleibt deterministisch. */
const konfigVon = (state: Pick<AppState, 'regelwerk' | 'eigeneAufbauten'>): Konfig => configFor({ regelwerk: state.regelwerk, eigeneAufbauten: state.eigeneAufbauten })

/** Zustand einer frisch angelegten Veranstaltung. */
export function emptyState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    eventName: '',
    eventJahr: 2026,
    eventKind: 'meisterschaft',
    startNrMode: 'klasse',
    regelwerk: DEFAULT_REGELWERK,
    aufbau: DEFAULT_AUFBAU,
    eigeneAufbauten: [],
    laufCount: 3,
    versucheNacheinander: regelwerkOf(DEFAULT_REGELWERK).versucheNacheinander === true,
    einteilung: {},
    boote: {},
    coPiloten: {},
    wkrLeerzeilen: WKR_LEERZEILEN_VORGABE,
    wkrLeerzeilenKlasse: {},
    wkrLeerzeilenSeite: WKR_LEERZEILEN_SEITE_VORGABE,
    wkrRueckseite: false,
    eingaben: {},
    abgemeldet: [],
    abgemeldetBis: {},
    streichlaeufe: 'auto',
    wkrClubGemeinsam: true,
    ergebnisListen: ERGEBNIS_LISTEN_VORGABE,
    kennung: '',
    listenStand: {},
    beispielStarter: false,
    wkrZeilenJeSeite: 0,
    wkrTeilenAb: 0,
    beschriftung: DEFAULT_BESCHRIFTUNG,
    wkrSprachen: {},
    tor5MitParcours: false,
    zusatzListen: {},
    laufzettelLayout: 'seite',
    pokal: POKAL_LEER,
    nichtWerten: {},
    dolphinPraefix: 'E',
    parallelZebra: true,
    sollgewicht: {},
    verzahnungLocked: false,
    showBirthdate: true,
    listOrigin: 'lang',
    originShort: {},
    originMode: 'verein',
    starters: [],
    parcoursList: [
      { id: 'par_1', name: 'Parcours 1', classIds: ['E', '1', '2', '3'], wechselFaktor: 2 },
      { id: 'par_2', name: 'Parcours 2', classIds: ['4', '5', '6', '7'], wechselFaktor: 2 },
    ],
    boats: { klein: 2, gross: 2 },
    class4Small: false,
    parallelOrderByStartNr: false,
    parallelStreng: true,
    parallelPlaene: {},
    runningNumbers: { enabled: false, source: 'manoever', start: 1, skipText: '' },
  }
}

/** Schlüssel zur Dubletten-Erkennung beim Ergänzen (Klasse + Name). */
function dupKey(p: Starter): string {
  return `${p.klasse}|${p.nachname.trim().toLowerCase()}|${p.vorname.trim().toLowerCase()}`
}

/** Übernimmt die geänderten Starter aus `updated` (per ID); die Reihenfolge bleibt. */
function replaceById(starters: Starter[], updated: Starter[]): Starter[] {
  const byId = new Map(updated.map((p) => [p.id, p]))
  return starters.map((p) => byId.get(p.id) ?? p)
}

/** Mit den Startern gehen ihre Eingaben: Ohne Starter gäbe es keinen Weg mehr, sie zu sehen oder zu löschen. */
function mitStartern(state: AppState, starters: Starter[]): AppState {
  const ids = new Set(starters.map((p) => p.id))
  const abgemeldet = state.abgemeldet.some((id) => !ids.has(id)) ? state.abgemeldet.filter((id) => ids.has(id)) : state.abgemeldet
  const abgemeldetBis = abgemeldet === state.abgemeldet ? state.abgemeldetBis : Object.fromEntries(Object.entries(state.abgemeldetBis).filter(([id]) => ids.has(id)))
  return { ...state, starters, eingaben: nurStarter(state.eingaben, ids), abgemeldet, abgemeldetBis }
}

/** Eine brauchbare Angabe der Streichläufe: `auto` oder eine ganze Zahl von 0 bis 8. */
export function streichlaeufeWert(wert: unknown): Streichlaeufe {
  return typeof wert === 'number' && Number.isFinite(wert) ? Math.max(0, Math.min(8, Math.round(wert))) : 'auto'
}

function mapParcours(state: AppState, id: string, fn: (p: Parcours) => Parcours): AppState {
  return { ...state, parcoursList: state.parcoursList.map((p) => (p.id === id ? fn(p) : p)) }
}

/**
 * Alle Startnummern frisch vergeben – die einzige Stelle, die das tut; Lücken
 * und importierte Nummern gehen dabei verloren.
 *
 * - klassenbasiert: je Klasse fortlaufend (E01, E02 …, 101, 102 …) in der
 *   aktuellen Reihenfolge.
 * - klassisch: fortlaufend in der Reihenfolge der Verzahnung (Manövrieren oder
 *   Parallel-Slalom), ab dem Startwert und ohne die zu überspringenden Nummern.
 *   Wer in dieser Reihenfolge nicht vorkommt (Klasse auf keinem Parcours),
 *   bleibt ohne Nummer.
 */
export function assignStartNumbers(state: AppState): Starter[] {
  if (state.startNrMode === 'klasse') {
    const renumbered = CLASS_IDS.flatMap((k) =>
      renumberSequential(sortedByStartNr(state.starters.filter((p) => p.klasse === k)), startNrPraefixe(state)),
    )
    return replaceById(state.starters, renumbered)
  }
  const numbers = canonicalRunningNumbers({ ...state, runningNumbers: { ...state.runningNumbers, enabled: true } })
  return state.starters.map((p) => ({ ...p, startNr: String(numbers?.get(p.id) ?? '') }))
}

/** Was die Verzahnung verändert – gesperrt, solange sie festgeschrieben ist. */
const VERZAHNUNG_ACTIONS: ReadonlySet<Action['type']> = new Set([
  'SET_BOATS',
  'SET_CLASS4_SMALL',
  'SET_PARALLEL_ORDER_BY_STARTNR',
  'SET_PARALLEL_STRENG',
  'ADD_PARCOURS',
  'SET_PARCOURS_PRESET',
  'REMOVE_PARCOURS',
  'SET_PARCOURS_CLASSES',
  'SET_PARCOURS_FACTOR',
  'SET_PARCOURS_TRACKS',
  'RESET_TRACKS',
])

/**
 * Was Starter hinzufügt oder entfernt. Sobald Ergebnisse erfasst sind, ändern diese Actions
 * den Stand nicht mehr (lib/eingaben.ts `starterfeldFest`) – die Sperre hängt so nicht nur an
 * den Knöpfen. Angaben ändern (UPDATE_STARTER), eine Sicherung laden und Zurücksetzen gehen weiter.
 */
/** Die Schalter, nach denen der Startplan des Parallelslaloms gerechnet wird. */
const PLAN_ACTIONS: ReadonlySet<Action['type']> = new Set(['SET_CLASS4_SMALL', 'SET_PARALLEL_ORDER_BY_STARTNR', 'SET_PARALLEL_STRENG'])

export const STARTERFELD_ACTIONS: ReadonlySet<Action['type']> = new Set(['IMPORT_STARTERS', 'ADD_STARTERS', 'REMOVE_STARTER', 'CLEAR_CLASS', 'CLEAR_ALL_STARTERS'])

/**
 * Steht die Klasse der Starter fest? Sobald die Verzahnung oder der Startplan des Vorlaufs
 * festgeschrieben ist. Dieselbe Frage stellen Oberfläche und Reducer.
 */
export function klasseFest(state: Pick<AppState, 'verzahnungLocked' | 'parallelPlaene'>): boolean {
  return state.verzahnungLocked || state.parallelPlaene[VORLAUF] !== undefined
}

export function reducer(state: AppState, action: Action): AppState {
  // Ein geladener oder neuer Stand bringt seine Zeitpunkte mit; verglichen wird er mit sich selbst.
  const frisch = action.type === 'LOAD_STATE' || action.type === 'RESET_ALL'
  const angewendet = wendeAn(state, action)
  if (angewendet === state) return state
  // Der Plan des Vorlaufs, der bei freigegebener Verzahnung an erfassten Werten hängt, entfällt
  // nur über „Werte löschen“ (Entscheidung des Nutzers vom 15.11.2026) – nicht schon, wenn das
  // letzte einzelne Feld geleert wird: Wer einen Tippfehler berichtigt, verlöre sonst den Plan,
  // nach dem gedruckt ist. Bei gesetzter Sperre ändert sich hier nichts
  // (planung/parallelRunden.ts `mitVorlaufPlan`).
  // „Werte des Gewählten löschen“, das alles leert, ist dasselbe wie „Werte löschen“.
  const allesGeloescht = action.type === 'CLEAR_EINGABEN' || (action.type === 'CLEAR_EINGABEN_TEIL' && Object.keys(angewendet.eingaben).length === 0)
  const roh = allesGeloescht && !angewendet.verzahnungLocked ? mitVorlaufPlan(angewendet, hasParallel(angewendet.regelwerk)) : angewendet
  // Wird der Plan des Vorlaufs festgeschrieben, bekommen schon Abgemeldete dort ihr X.
  const mitX = !frisch && roh.abgemeldet.length > 0 && roh.parallelPlaene[VORLAUF] !== undefined && state.parallelPlaene[VORLAUF] === undefined ? mitAbmeldungenInRunden(roh, konfigVon(roh), [VORLAUF]) : roh
  // Wechselt die Liste für Tor 5 (Option, Aufbau, geänderter eigener Aufbau), zieht mit, was an
  // ihr hing. Ein geladener Stand ist in sich stimmig und bleibt, wie er ist; eine Vorlage
  // zieht beim Anwenden selbst um (persistenz/backup.ts).
  const umgezogen = frisch ? mitX : mitTor5Umzug(state, mitX)
  // Kommt ein Lauf dazu (Zahl der Läufe, andere Disziplin), bekommen Abgemeldete das X auch dort.
  const angewandt =
    frisch || umgezogen.abgemeldet.length === 0 || (umgezogen.laufCount === state.laufCount && umgezogen.aufbau === state.aufbau && umgezogen.eigeneAufbauten === state.eigeneAufbauten && umgezogen.regelwerk === state.regelwerk)
      ? umgezogen
      : ergaenzeAbmeldungen(state, umgezogen, konfigVon(state), konfigVon(umgezogen))
  // Ohne Starter gibt es kein Beispiel-Starterfeld mehr – gleich, wie die Starter gingen.
  const next = angewandt.beispielStarter && angewandt.starters.length === 0 ? { ...angewandt, beispielStarter: false } : angewandt
  // Eine Eingabe betrifft nur die Klassen ihrer Starter – bei jedem Tastendruck alle Klassen neu zu werten wäre unnötig.
  const klassen =
    action.type === 'SET_EINGABEN'
      ? [...new Set(action.zellen.flatMap((z) => next.starters.find((p) => p.id === z.starter)?.klasse ?? []))]
      : undefined
  // Jede Eingabe (getippt, gescannt, gelöscht, Beispielwerte) setzt den Zeitpunkt der Liste
  // ihrer Klasse und ihres Laufs – auch wenn die Liste danach gleich aussieht (Vorgabe des
  // Nutzers; lib/listenStand.ts). Nur für die Wege der Eingabe: Ein Umzug von Werten beim
  // Wechsel des Aufbaus ist keine.
  const eingegeben =
    action.type === 'SET_EINGABEN' || action.type === 'FILL_BEISPIELWERTE' || action.type === 'CLEAR_EINGABEN_TEIL' || action.type === 'ABMELDEN_STARTER' || action.type === 'ANMELDEN_STARTER' || action.type === 'PARALLEL_RUNDE_LOESEN'
      ? geaenderteListen(state, next)
      : undefined
  // Die Mannschaftswertung führt keinen eigenen Stand: Ihr Zeitpunkt ist der jüngste der
  // Gesamtlisten (lib/listenStand.ts `wertungZeit`).
  const listenStand = listenStandNach(frisch ? next : state, next, action.zeit, klassen, eingegeben)
  return listenStand === next.listenStand ? next : { ...next, listenStand }
}

/** Die Markierung „zählt für die Pokalauswertung“ setzen: Im Stand steht nur `false`. */
function mitPokalZaehlt(p: Starter, zaehlt: boolean): Starter {
  if ((p.pokal !== false) === zaehlt) return p
  const { pokal: _alt, ...rest } = p
  return zaehlt ? rest : { ...rest, pokal: false }
}

function wendeAn(state: AppState, action: Action): AppState {
  if (state.verzahnungLocked && VERZAHNUNG_ACTIONS.has(action.type)) return state
  // Sind zum Vorlauf des Parallelslaloms Werte erfasst, bleibt sein Plan fest – und mit ihm die
  // Schalter, nach denen er gerechnet wurde (planung/parallelRunden.ts `vorlaufGebunden`).
  if (PLAN_ACTIONS.has(action.type) && vorlaufGebunden(state)) return state
  // Das Regelwerk bestimmt Listen, Felder und Wertung: Sobald Ergebnisse erfasst sind, lässt es
  // sich nicht mehr wechseln – bis alle Werte gelöscht sind (Entscheidung des Nutzers vom
  // 15.11.2026). Ein Klick auf das schon gewählte ändert ohnehin nichts.
  if (action.type === 'SET_REGELWERK' && starterfeldFest(state) && regelwerkOf(action.regelwerk).id !== state.regelwerk) return state
  if (STARTERFELD_ACTIONS.has(action.type) && starterfeldFest(state)) return state

  switch (action.type) {
    case 'SET_WEIGHT':
      return {
        ...state,
        starters: state.starters.map((p) => {
          if (p.id !== action.id) return p
          const { gewicht: _old, ...rest } = p
          return action.gewicht === null ? rest : { ...rest, gewicht: action.gewicht }
        }),
      }

    case 'SET_SOLLGEWICHT': {
      const { [action.klasse]: _old, ...rest } = state.sollgewicht
      const preset = regelwerkOf(state.regelwerk).gewichte[action.klasse]
      const own = action.kg !== null && action.kg > 0 && action.kg !== preset
      return { ...state, sollgewicht: own ? { ...rest, [action.klasse]: action.kg } : rest }
    }

    case 'RESET_SOLLGEWICHT':
      return { ...state, sollgewicht: {} }

    case 'SET_VERZAHNUNG_LOCK': {
      const tracks = action.locked ? action.tracks : undefined
      // Mit der Sperre friert auch der Startplan des Parallelslaloms ein (Vorlauf) und wird
      // danach nicht neu gerechnet; beim Lösen entfällt er (planung/parallelRunden.ts).
      return mitVorlaufPlan(
        {
          ...state,
          verzahnungLocked: action.locked,
          parcoursList: tracks
            ? state.parcoursList.map((p) => (tracks[p.id] ? { ...p, tracks: tracks[p.id] } : p))
            : state.parcoursList,
        },
        hasParallel(state.regelwerk),
      )
    }

    case 'SET_EVENT': {
      const next = { ...state, ...action.patch }
      next.laufCount = Math.max(1, Math.min(9, Math.round(next.laufCount) || 1))
      return next
    }

    case 'SET_EVENT_KIND': {
      if (action.eventKind === state.eventKind) return state
      // Eine Clubmeisterschaft zeigt keine Herkunft; beim Wechsel zurück gilt
      // wieder der Verein, bis etwas anderes gewählt wird.
      // Bei der Clubmeisterschaft zählt das Papier: gemeinsame Bögen (Vorgabe) und nur eine
      // Leerzeile je Klasse. Wer die Zahl schon selbst gewählt hat, behält sie.
      const club = action.eventKind === 'club'
      const [von, nach] = club ? [WKR_LEERZEILEN_VORGABE, WKR_LEERZEILEN_CLUB] : [WKR_LEERZEILEN_CLUB, WKR_LEERZEILEN_VORGABE]
      return {
        ...state,
        eventKind: action.eventKind,
        wkrLeerzeilen: state.wkrLeerzeilen === von ? nach : state.wkrLeerzeilen,
        originMode:
          action.eventKind === 'club' ? 'none' : state.originMode === 'none' ? 'verein' : state.originMode,
      }
    }

    case 'SET_REGELWERK': {
      const regelwerk = regelwerkOf(action.regelwerk).id
      // Ohne Parallelslalom kann er auch nicht die Reihenfolge der Nummern vorgeben.
      const source = hasParallel(regelwerk) ? state.runningNumbers.source : 'manoever'
      // „Versuche direkt nacheinander“ folgt beim Wechsel der Vorgabe des neuen Regelwerks
      // (UIM: an, Regel 960 Pkt. 4.3.2); kennt es den Schalter nicht, ist er aus. Ein Klick auf
      // das schon gewählte Regelwerk verstellt nichts.
      const versucheNacheinander = regelwerk === state.regelwerk ? state.versucheNacheinander : regelwerkOf(regelwerk).versucheNacheinander === true
      // Kommt der Parallelslalom bei festgeschriebener Verzahnung erst mit dem Regelwerk dazu,
      // wird sein Plan jetzt festgeschrieben; ein schon vorhandener bleibt.
      const next = mitVorlaufPlan({ ...state, regelwerk, versucheNacheinander, runningNumbers: { ...state.runningNumbers, source } }, hasParallel(regelwerk))
      // Die Wahl des Regelwerks stellt Läufe und Streichläufe so, wie es sie vorsieht (YAML
      // `wertungslaeufe`: DM 3 Läufe/1 gestrichen, UIM 2/1) – nur beim Wechsel, damit ein Klick
      // auf das schon gewählte Regelwerk nichts verstellt, was der Rennleiter von Hand gesetzt
      // hat. Schon erfasste Werte eines Laufs, den es danach nicht mehr gibt, bleiben wie beim
      // Ändern der Laufzahl im Stand; „Einstellungen → Wertung“ weist auf sie hin.
      const soll = regelwerkOf(regelwerk).wertungslaeufe
      if (!soll || regelwerk === state.regelwerk) return next
      // „Nach Regel“ bleibt stehen, wenn es dasselbe ergibt – sonst die Zahl.
      const auto = streichlaeufeVon(soll.laeufe, 'auto', soll.nachRegel) === soll.streichlaeufe
      return { ...next, laufCount: soll.laeufe, streichlaeufe: auto ? 'auto' : streichlaeufeWert(soll.streichlaeufe) }
    }

    // Was an der Liste für Tor 5 hängt, zieht in `reducer` mit (state/tor5.ts) – bei jedem
    // der drei Wege, auf denen sie wechselt.
    case 'SET_AUFBAU':
      return { ...state, aufbau: aufbauOf(action.aufbau, state.eigeneAufbauten).id }

    case 'SET_EIGENE_AUFBAUTEN':
      return {
        ...state,
        eigeneAufbauten: action.aufbauten,
        aufbau: aufbauOf(action.aufbau ?? state.aufbau, action.aufbauten).id,
      }

    case 'SET_TOR5_MIT_PARCOURS':
      return action.on === state.tor5MitParcours ? state : { ...state, tor5MitParcours: action.on }

    case 'SET_ZUSATZ_LISTE': {
      const { [action.liste]: _alt, ...rest } = normalisiereZusatzListen(state.zusatzListen)
      // Nur die Abweichung von der Vorgabe des Regelwerks steht im Stand.
      const vorgabe = vorgabeListenVon(regelwerkOf(state.regelwerk), aufbauOf(state.aufbau, state.eigeneAufbauten).disziplin).includes(action.liste)
      const zusatzListen = action.an === vorgabe ? rest : { ...rest, [action.liste]: action.an }
      return JSON.stringify(zusatzListen) === JSON.stringify(state.zusatzListen) ? state : { ...state, zusatzListen }
    }

    case 'SET_VERSUCHE_NACHEINANDER':
      // Ohne den Schalter im Regelwerk gibt es nichts zu stellen.
      return regelwerkOf(state.regelwerk).versucheNacheinander === undefined || action.on === state.versucheNacheinander ? state : { ...state, versucheNacheinander: action.on }

    case 'SET_LAUFZETTEL_LAYOUT':
      return { ...state, laufzettelLayout: laufzettelLayoutWert(action.layout) }

    case 'SET_LIST_OPTIONS':
      return { ...state, ...action.patch }

    case 'SET_WKR_LEERZEILEN': {
      if (action.klasse === undefined) {
        const anzahl = leerzeilenZahl(action.anzahl) ?? WKR_LEERZEILEN_VORGABE
        // Was danach nicht mehr abweicht, ist keine eigene Angabe mehr.
        const eigene = action.alleKlassen ? {} : Object.fromEntries(Object.entries(state.wkrLeerzeilenKlasse).filter(([, n]) => n !== anzahl))
        return { ...state, wkrLeerzeilen: anzahl, wkrLeerzeilenKlasse: eigene }
      }
      const { [action.klasse]: _alt, ...rest } = state.wkrLeerzeilenKlasse
      const anzahl = leerzeilenZahl(action.anzahl)
      return {
        ...state,
        wkrLeerzeilenKlasse: anzahl === undefined || anzahl === state.wkrLeerzeilen ? rest : { ...rest, [action.klasse]: anzahl },
      }
    }

    case 'SET_WKR_RUECKSEITE':
      return { ...state, wkrRueckseite: action.rueckseite }

    case 'SET_WKR_CLUB_GEMEINSAM':
      return { ...state, wkrClubGemeinsam: action.gemeinsam }

    case 'SET_WKR_SEITEN': {
      const { zeilenJeSeite, teilenAb } = action.patch
      const wkrZeilenJeSeite = zeilenJeSeite === undefined ? state.wkrZeilenJeSeite : zeilenJeSeiteZahl(zeilenJeSeite)
      const wkrTeilenAb = teilenAb === undefined ? state.wkrTeilenAb : teilenAbZahl(teilenAb)
      // „Teilen ab“ bleibt stehen, wenn auf automatisch gestellt wird: Es wirkt dann nicht und
      // gilt wieder, sobald eine feste Zahl gewählt ist.
      return wkrZeilenJeSeite === state.wkrZeilenJeSeite && wkrTeilenAb === state.wkrTeilenAb ? state : { ...state, wkrZeilenJeSeite, wkrTeilenAb }
    }

    case 'SET_BESCHRIFTUNG':
      return { ...state, beschriftung: beschriftungOf(action.beschriftung) }

    case 'SET_WKR_SPRACHE': {
      const sprache = action.sprache
      const wkrSprachen = { ...state.wkrSprachen }
      for (const id of action.typeIds) {
        if (sprache !== null && isSprache(sprache)) wkrSprachen[id] = sprache
        else delete wkrSprachen[id]
      }
      return { ...state, wkrSprachen }
    }

    case 'SET_WKR_LEERZEILEN_SEITE':
      return { ...state, wkrLeerzeilenSeite: leerzeilenZahl(action.anzahl) ?? WKR_LEERZEILEN_SEITE_VORGABE }

    case 'SET_ERGEBNIS_LISTEN': {
      const { aushang, intern } = state.ergebnisListen
      return {
        ...state,
        ergebnisListen:
          action.fassung === 'aushang'
            ? { intern, aushang: { ...aushang, ...action.patch } }
            : { aushang, intern: { herkunft: action.patch.herkunft ?? intern.herkunft } },
      }
    }

    case 'SET_ORIGIN_SHORT': {
      const { [action.name]: _old, ...rest } = state.originShort
      const short = action.short.trim()
      return { ...state, originShort: short ? { ...rest, [action.name]: short } : rest }
    }

    case 'SET_ORIGIN_MODE':
      return { ...state, originMode: action.originMode }

    case 'SET_BOATS':
      return { ...state, boats: action.boats }

    case 'SET_CLASS4_SMALL':
      return { ...state, class4Small: action.class4Small }

    case 'SET_PARALLEL_ORDER_BY_STARTNR':
      return { ...state, parallelOrderByStartNr: action.value }

    case 'SET_PARALLEL_STRENG':
      return action.value === state.parallelStreng ? state : { ...state, parallelStreng: action.value }

    case 'PARALLEL_RUNDE_FESTSCHREIBEN': {
      const konfig = konfigVon(state)
      const parallelPlaene = hasParallel(state.regelwerk) ? schreibeRundeFest(state, konfig, action.klasse, action.runde) : null
      if (!parallelPlaene) return state
      // Wer abgemeldet ist und trotzdem in der Runde steht, bekommt dort gleich sein X – nur in
      // der Klasse, die festgeschrieben wird: Ein X, das in einer anderen Klasse derselben Runde
      // von Hand entfernt wurde (er fährt doch), bleibt entfernt.
      return mitAbmeldungenInRunden({ ...state, parallelPlaene }, konfig, [action.runde], action.klasse)
    }

    case 'PARALLEL_RUNDE_LOESEN': {
      const geloest = loeseRunde(state, konfigVon(state), action.klasse, action.runde)
      return geloest ? { ...state, ...geloest } : state
    }

    case 'SET_RUNNING_NUMBERS':
      return { ...state, runningNumbers: { ...state.runningNumbers, ...action.patch } }

    case 'IMPORT_STARTERS': {
      if (action.mode === 'replace') {
        // Die Liste gilt als Ganzes: Es ist nicht mehr das Beispiel-Starterfeld.
        return { ...mitStartern(state, mergeStarters(state.starters, action.starters, action.auswahlAusDatei ? 'datei' : 'bisher').starters), beispielStarter: false }
      }
      const seen = new Set(state.starters.map(dupKey))
      return { ...state, starters: state.starters.concat(action.starters.filter((p) => !seen.has(dupKey(p)))) }
    }

    case 'ADD_STARTERS':
      return { ...state, starters: state.starters.concat(action.starters), beispielStarter: state.beispielStarter || (action.beispiel === true && action.starters.length > 0) }

    case 'UPDATE_STARTER': {
      // Die Klasse eines Starters lässt sich nicht mehr ändern, sobald die Verzahnung bzw. der
      // Startplan des Parallelslaloms festgeschrieben ist (Entscheidung des Nutzers vom
      // 15.11.2026): Er stünde sonst in Spur, Paar und Boot einer Klasse, zu der er nicht gehört.
      // Die übrigen Angaben des Patches gelten weiter.
      const { klasse, ...ohneKlasse } = action.patch
      const patch = klasse !== undefined && klasseFest(state) ? ohneKlasse : action.patch
      if (Object.keys(patch).length === 0) return state
      return {
        ...state,
        starters: state.starters.map((p) => {
          if (p.id !== action.id) return p
          const neu = { ...p, ...patch }
          // Freiwillige Angabe: „nicht erfasst“ steht nicht als leeres Feld im Stand.
          if (!istGeschlecht(neu.geschlecht)) delete neu.geschlecht
          return neu
        }),
      }
    }

    case 'MOVE_STARTER': {
      const target = state.starters.find((p) => p.id === action.id)
      if (!target) return state
      const inClass = sortedByStartNr(state.starters.filter((p) => p.klasse === target.klasse))
      const moved = moveInOrder(inClass, action.id, action.target)
      return { ...state, starters: replaceById(state.starters, redistributeNumbers(moved)) }
    }

    case 'ORDER_CLASS_BY_SIZE': {
      const inClass = state.starters.filter((p) => p.klasse === action.klasse)
      return { ...state, starters: replaceById(state.starters, redistributeNumbers(orderBySize(inClass))) }
    }

    case 'SET_START_NR_MODE':
      // Nur die Art wechselt; die Nummern bleiben, bis sie neu vergeben werden.
      return { ...state, startNrMode: action.mode }

    case 'ASSIGN_START_NUMBERS':
      return { ...state, starters: assignStartNumbers(state) }

    case 'ABMELDEN_STARTER': {
      // Vor dem ersten Ergebnis wird ein Starter einfach entfernt – abgemeldet wird erst danach.
      const starter = state.starters.find((p) => p.id === action.id)
      if (!starter || !starterfeldFest(state) || state.abgemeldet.includes(starter.id)) return state
      return {
        ...state,
        abgemeldet: [...state.abgemeldet, starter.id],
        abgemeldetBis: { ...state.abgemeldetBis, [starter.id]: Math.max(1, state.laufCount) },
        eingaben: mitAbmeldungInRunden({ ...state, eingaben: mitAbmeldung(state, konfigVon(state), starter) }, konfigVon(state), starter),
      }
    }

    case 'ANMELDEN_STARTER': {
      const starter = state.starters.find((p) => p.id === action.id)
      if (!starter || !state.abgemeldet.includes(starter.id)) return state
      return {
        ...state,
        abgemeldet: state.abgemeldet.filter((id) => id !== starter.id),
        abgemeldetBis: Object.fromEntries(Object.entries(state.abgemeldetBis).filter(([id]) => id !== starter.id)),
        eingaben: setzeWerte(state.eingaben, abmeldeZellen(state.eingaben, konfigVon(state), starter)),
      }
    }

    case 'REMOVE_STARTER':
      return mitStartern(state, state.starters.filter((p) => p.id !== action.id))

    case 'CLEAR_CLASS':
      return mitStartern(state, state.starters.filter((p) => p.klasse !== action.klasse))

    case 'CLEAR_ALL_STARTERS':
      return mitStartern(state, [])

    case 'ADD_PARCOURS':
      return {
        ...state,
        parcoursList: state.parcoursList.concat({
          id: action.id,
          name: `Parcours ${state.parcoursList.length + 1}`,
          classIds: [],
          wechselFaktor: 2,
        }),
      }

    case 'SET_PARCOURS_PRESET':
      return {
        ...state,
        parcoursList: action.parcours.map((p, i) => ({
          id: p.id,
          name: `Parcours ${i + 1}`,
          classIds: p.classIds,
          wechselFaktor: action.wechselFaktor ?? 2,
        })),
        // Die WKR-Namen hängen an der Kennung des Parcours: Sie ziehen mit, sonst wären sie
        // nach jeder Schnellauswahl unsichtbar, stünden aber weiter in jeder Sicherung.
        einteilung: haengeUm(
          state.einteilung,
          state.parcoursList.map((p) => p.id),
          action.parcours.map((p) => p.id),
        ),
      }

    case 'REMOVE_PARCOURS':
      // Mit dem Parcours gehen die Namen seiner Wettkampfrichter: Es bliebe sonst kein Weg, sie zu löschen.
      return {
        ...state,
        parcoursList: state.parcoursList.filter((p) => p.id !== action.id),
        einteilung: ohneParcours(state.einteilung, action.id),
      }

    case 'RENAME_PARCOURS':
      return mapParcours(state, action.id, (p) => ({ ...p, name: action.name }))

    case 'SET_PARCOURS_CLASSES':
      // Andere Klassen machen die manuelle Spur-Anordnung ungültig.
      return mapParcours(state, action.id, (p) => ({ ...p, classIds: action.classIds, tracks: undefined }))

    case 'SET_PARCOURS_FACTOR':
      // Ein anderer Faktor macht die manuelle Spur-Anordnung ungültig.
      return mapParcours(state, action.id, (p) => ({ ...p, wechselFaktor: action.wechselFaktor, tracks: undefined }))

    case 'SET_PARCOURS_TRACKS':
      return mapParcours(state, action.id, (p) => ({ ...p, tracks: action.tracks }))

    case 'RESET_TRACKS':
      return mapParcours(state, action.id, (p) => ({ ...p, tracks: undefined }))

    case 'SET_WKR_NAME':
      return { ...state, einteilung: setzeName(state.einteilung, action.parcoursId, action.typeId, action.name) }

    case 'SET_BOOT':
      return { ...state, boote: setzeBesetzung(state.boote, action.klasse, action.text) }

    case 'SET_CO_PILOT':
      return { ...state, coPiloten: setzeBesetzung(state.coPiloten, action.klasse, action.text) }

    case 'SET_EINGABEN': {
      // Zellen für unbekannte Starter oder kaputte Lauf-Schlüssel kommen gar nicht erst in den Stand.
      const zellen = gueltigeZellen(action.zellen, new Set(state.starters.map((p) => p.id)))
      const eingaben = setzeWerte(state.eingaben, zellen)
      return eingaben === state.eingaben ? state : { ...state, eingaben }
    }
    case 'CLEAR_EINGABEN':
      // Mit den Werten gehen die Abmeldungen: Das Starterfeld ist danach wieder frei.
      // Und die Runden nach dem Vorlauf: Sie stehen auf seinem Ergebnis, das es nicht mehr gibt.
      // Ebenso „Disziplin nicht werten“: Ohne Werte zählt ohnehin keine Disziplin.
      // Der Plan des Vorlaufs hängt an der Verzahnung und bleibt, solange sie festgeschrieben
      // ist; bei freigegebener Verzahnung entfällt er hier (in `reducer`, planung/parallelRunden.ts).
      return Object.keys(state.eingaben).length === 0 &&
        state.abgemeldet.length === 0 &&
        Object.keys(state.nichtWerten).length === 0 &&
        Object.keys(state.parallelPlaene).every((r) => r === VORLAUF) &&
        (state.verzahnungLocked || state.parallelPlaene[VORLAUF] === undefined)
        ? state
        : { ...state, eingaben: {}, abgemeldet: [], abgemeldetBis: {}, nichtWerten: {}, parallelPlaene: state.parallelPlaene[VORLAUF] ? { [VORLAUF]: state.parallelPlaene[VORLAUF] } : {} }
    case 'SET_STREICHLAEUFE':
      return { ...state, streichlaeufe: streichlaeufeWert(action.streichlaeufe) }
    case 'FILL_BEISPIELWERTE': {
      // Die Konfiguration ist eine reine Funktion des Stands – der Reducer bleibt deterministisch.
      const konfig = konfigVon(state)
      const zufall = zufallAus(action.saat)
      const eingaben = action.nurRunden ? state.eingaben : beispielEingaben(state, konfig, { zeitnahme: action.zeitnahme, laeufe: action.laeufe }, zufall)
      if (!hasParallel(state.regelwerk)) return { ...state, eingaben }
      const runden = action.runden ?? []
      return { ...state, eingaben: runden.reduce((e, runde) => beispielRunde({ ...state, eingaben: e }, konfig, runde, { zeitnahme: action.zeitnahme, nurLeere: action.nurLeere === true }, zufall), eingaben) }
    }
    case 'CLEAR_EINGABEN_TEIL': {
      const disziplin = konfigVon(state).getAufbau(state.aufbau).disziplin
      const weg = new Set<string>([
        ...(action.laeufe ?? []).flatMap((l) => [laufSchluessel(disziplin, l), ...(l === 1 ? [laufSchluessel(disziplin, OHNE_LAUF)] : [])]),
        ...(action.runden ?? []).flatMap((r) => [attemptSchluessel(r, 1), attemptSchluessel(r, 2)]),
      ])
      const bleibt = Object.entries(state.eingaben).filter(([schluessel]) => !weg.has(schluessel))
      if (bleibt.length === Object.keys(state.eingaben).length) return state
      // Bleibt nichts übrig, ist es dasselbe wie „Alle erfassten Werte löschen“ – mit Abmeldungen
      // und späteren Runden (den Plan des Vorlaufs nimmt `reducer` dann ebenso weg).
      if (bleibt.length === 0) return wendeAn(state, { type: 'CLEAR_EINGABEN' })
      // Wer abgemeldet ist, bleibt es: Sein X „nicht gestartet“ kommt in die gelöschten Läufe und
      // Runden zurück (lib/abmeldung.ts) – sonst stünde er dort als „noch offen“ da, obwohl er
      // als abgemeldet gilt, und Beispielwerte gäben ihm Zeiten.
      const konfig = konfigVon(state)
      let next: AppState = { ...state, eingaben: Object.fromEntries(bleibt) }
      const laeufe = (action.laeufe ?? []).filter((l) => l >= 1 && l <= Math.max(1, state.laufCount))
      for (const s of state.starters) if (laeufe.length > 0 && state.abgemeldet.includes(s.id)) next = { ...next, eingaben: mitAbmeldung(next, konfig, s, laeufe) }
      return action.runden && action.runden.length > 0 ? mitAbmeldungenInRunden(next, konfig, action.runden) : next
    }
    case 'LOAD_STATE':
      return action.state

    case 'RESET_ALL':
      return { ...emptyState(), kennung: istKennung(action.kennung) ? action.kennung : '' }

    case 'SET_KENNUNG':
      return state.kennung || !istKennung(action.kennung) ? state : { ...state, kennung: action.kennung }

    case 'SET_POKAL_VARIANTE': {
      if (!istPokalVariante(action.variante)) return state
      const { [action.variante]: _alt, ...rest } = state.pokal.varianten
      // Nur die Abweichung von der Vorgabe des Regelwerks steht im Stand (wie bei den zusätzlichen Listen).
      const vorgabe = pokalVorgabe(state.regelwerk).an.includes(action.variante)
      const varianten = action.an === vorgabe ? rest : { ...rest, [action.variante]: action.an }
      return JSON.stringify(varianten) === JSON.stringify(state.pokal.varianten) ? state : { ...state, pokal: { ...state.pokal, varianten } }
    }

    case 'SET_POKAL_PUNKTE': {
      if (!(POKAL_PLATZ_VARIANTEN as readonly string[]).includes(action.variante)) return state
      const vorgabe = pokalVorgabe(state.regelwerk).punkte[action.variante]
      const { [action.variante]: _alt, ...rest } = state.pokal.punkte
      // Die Zahl der Plätze steht mit der Variante fest: Fehlendes zählt 0, Überzähliges entfällt.
      const neu = action.punkte === null ? vorgabe : vorgabe.map((_, i) => punkteListe(action.punkte)[i] ?? 0)
      const punkte = neu.every((n, i) => n === vorgabe[i]) ? rest : { ...rest, [action.variante]: neu }
      return JSON.stringify(punkte) === JSON.stringify(state.pokal.punkte) ? state : { ...state, pokal: { ...state.pokal, punkte } }
    }

    case 'SET_POKAL_UIM': {
      const vorgabe = pokalVorgabe(state.regelwerk)
      const { beste: _b, mindestens: _m, ...rest } = state.pokal
      const wert = (feld: 'beste' | 'mindestens') => {
        const neu = action.patch[feld] === undefined ? state.pokal[feld] : (pokalZahl(action.patch[feld]) ?? undefined)
        return neu === undefined || neu === vorgabe[feld] ? {} : { [feld]: neu }
      }
      const pokal = { ...rest, ...wert('beste'), ...wert('mindestens') }
      return JSON.stringify(pokal) === JSON.stringify(state.pokal) ? state : { ...state, pokal }
    }

    case 'SET_POKAL_NUR_AUSWAHL':
      return action.an === state.pokal.nurAuswahl ? state : { ...state, pokal: { ...state.pokal, nurAuswahl: action.an } }

    case 'SET_NICHT_WERTEN': {
      // Den Schalter gibt es nur nach Regel 960 (Einzelwertung aus zwei Disziplinen).
      if (!hasParallel(state.regelwerk) || !(WERTUNGS_DISZIPLINEN as readonly string[]).includes(action.disziplin)) return state
      const nichtWerten = setzeNichtWerten(state.nichtWerten, action.disziplin, action.klassen, action.an)
      return nichtWerten === state.nichtWerten ? state : { ...state, nichtWerten }
    }

    case 'SET_PARALLEL_ZEBRA':
      return action.zebra === state.parallelZebra ? state : { ...state, parallelZebra: action.zebra === true }
    case 'SET_DOLPHIN_PRAEFIX': {
      const dolphinPraefix = action.praefix === 'D' ? 'D' : 'E'
      return dolphinPraefix === state.dolphinPraefix ? state : { ...state, dolphinPraefix }
    }

    case 'SET_POKAL_ZAEHLT':
    case 'INVERT_POKAL_ZAEHLT': {
      const ids = new Set(action.ids)
      const starters = state.starters.map((p) => (ids.has(p.id) ? mitPokalZaehlt(p, action.type === 'SET_POKAL_ZAEHLT' ? action.zaehlt : p.pokal === false) : p))
      return starters.every((p, i) => p === state.starters[i]) ? state : { ...state, starters }
    }

    default:
      return state
  }
}
