import type { AppState } from '../types'
import type { Action } from '../state/reducer'
import { OHNE_LAUF, zerlegeLauf } from './eingaben'
import { zerlegeAttempt } from './parallelSchluessel'

/**
 * Reine Logik des zweiten Speichers und des Verlaufs: welcher von zwei gespeicherten Ständen der
 * neuere ist, wie eine Änderung im Verlauf heißt, welche Änderungen zu einem Eintrag
 * zusammengehören und welche Einträge neueren weichen. Der Speicher selbst (IndexedDB) steht in
 * persistenz/zweitspeicher.ts, das Zusammenspiel mit dem Store in state/zweit.ts.
 */

/**
 * Wann ein Stand gespeichert wurde. Der Reducer kennt keine Uhr und zählt nichts – die Marke
 * setzt der Store beim Speichern. `folge` zählt jede Speicherung dieser Veranstaltung in diesem
 * Browser hoch (über alle Fenster: Jedes Fenster zählt von der höchsten, die es kennt); sie
 * entscheidet. `zeit` (Millisekunden seit 1970) ist für die Anzeige und entscheidet nur bei
 * gleicher Folge – eine verstellte Uhr kann so keinen alten Stand über einen neuen heben.
 */
export interface Speichermarke {
  folge: number
  zeit: number
}

/** > 0: `a` ist neuer als `b`; < 0: älter; 0: derselbe Stand. Eine fehlende Marke ist älter als jede. */
export function vergleiche(a: Speichermarke | null, b: Speichermarke | null): number {
  if (!a || !b) return a ? 1 : b ? -1 : 0
  return a.folge - b.folge || a.zeit - b.zeit
}

/**
 * Welcher Speicher beim Start gilt.
 *
 * - `zweit`: Der zweite Speicher ist neuer – dem localStorage fehlt etwas (harter Abbruch, bevor
 *   der Browser ihn auf die Platte geschrieben hat). Auch wenn der localStorage leer ist.
 * - `erster`: Der localStorage ist neuer oder der zweite Speicher leer; er wird nachgezogen.
 * - `ohneMarke`: Im localStorage liegt ein Stand ohne Marke – aus der Zeit vor dem zweiten
 *   Speicher oder von einem Fenster, das noch mit einer älteren Fassung läuft. Wer ihn schrieb
 *   und wann, ist unbekannt; er gilt (er ist das, was der Nutzer zuletzt gesehen hat) und bekommt
 *   eine Marke. Was im zweiten Speicher lag, steht ohnehin im Verlauf.
 * - `gleich`: beide gleich, nichts zu tun.
 */
export type StartEntscheidung = 'zweit' | 'erster' | 'ohneMarke' | 'gleich'

export function entscheideStart(erster: { vorhanden: boolean; marke: Speichermarke | null }, zweit: Speichermarke | null): StartEntscheidung {
  if (!erster.vorhanden) return zweit ? 'zweit' : 'gleich'
  if (!erster.marke) return 'ohneMarke'
  const v = vergleiche(erster.marke, zweit)
  return v > 0 ? 'erster' : v < 0 ? 'zweit' : 'gleich'
}

// --- Was sich geändert hat ---------------------------------------------------

/**
 * Art einer Änderung im Verlauf. Die Texte dazu stehen in i18n (`history.what.*`); gespeichert
 * wird nur die Art mit ihren Angaben, damit der Verlauf der Sprache der Oberfläche folgt.
 */
export type VerlaufArt =
  | 'eingabe'
  | 'eingabenGeloescht'
  | 'eingabenTeilGeloescht'
  | 'beispielwerte'
  /** Beispieldaten: erfundene WKR-Einteilung bzw. erfundene Gewichte (lib/beispieldaten.ts). */
  | 'beispielBesetzung'
  | 'beispielGewichte'
  | 'import'
  | 'starterNeu'
  | 'beispielStarter'
  | 'starter'
  | 'starterGeloescht'
  /** Nach Beginn des Wettkampfs als „nicht gestartet“ eingetragen bzw. diese Abmeldung zurückgenommen. */
  | 'starterAbgemeldet'
  | 'starterAngemeldet'
  | 'gewicht'
  | 'aufbau'
  | 'regelwerk'
  | 'veranstaltung'
  | 'parcours'
  | 'besetzung'
  | 'mannschaft'
  | 'einstellung'
  /** Ein ganzer Stand kam von außen: Sicherung, Vorlage, Verzahnungs-Prototyp, oder ohne nähere Angabe. */
  | 'sicherung'
  | 'vorlage'
  | 'prototyp'
  | 'geladen'
  /** Ein Stand aus dem Verlauf wurde wiederhergestellt (`zeit`/`name` nennen ihn). */
  | 'verlauf'
  | 'zurueckgesetzt'
  /** Stand beim Öffnen, der im zweiten Speicher noch fehlte. */
  | 'start'
  /** Nach einem Abbruch aus dem zweiten Speicher wiederhergestellt. */
  | 'abbruch'
  /** Was beim Wiederherstellen nach einem Abbruch im localStorage lag (der ältere Stand). */
  | 'verdraengt'
  /** „Stand merken“. */
  | 'gemerkt'
  /** Parallelslalom: eine Runde für eine Klasse festgeschrieben bzw. gelöst (`klasse`, `runde`). */
  | 'rundeFest'
  | 'rundeGeloest'
  /** „Disziplin nicht werten“ gesetzt oder gelöst (Entscheidung des O.O.D., lib/disziplinen.ts). */
  | 'nichtWerten'

export interface Beschreibung {
  art: VerlaufArt
  /** Klasse und Lauf einer Eingabe – nur, wenn sie genau eine Klasse bzw. einen Lauf betrifft. */
  klasse?: string
  lauf?: number
  /** Eingabe im Parallelslalom: die Runde (`pre` …); `lauf` ist dann der Attempt. Auch die festgeschriebene oder gelöste Runde. */
  runde?: string
  /** Zahl der Starter (Import, Hinzufügen). */
  n?: number
  /** Wiederhergestellter Stand: sein Zeitpunkt und, wenn er einen hatte, sein Name. */
  zeit?: number
  name?: string
}

/** Diese Arten stehen immer für sich: Zwei Importe hintereinander sind zwei Einträge. */
const EINZELN: ReadonlySet<VerlaufArt> = new Set<VerlaufArt>([
  'eingabenGeloescht',
  'eingabenTeilGeloescht',
  'beispielwerte',
  'beispielBesetzung',
  'beispielGewichte',
  'import',
  'starterNeu',
  'beispielStarter',
  'aufbau',
  'regelwerk',
  'sicherung',
  'vorlage',
  'prototyp',
  'geladen',
  'verlauf',
  'zurueckgesetzt',
  'start',
  'abbruch',
  'verdraengt',
  'gemerkt',
  'rundeFest',
  'rundeGeloest',
])

const ARTEN: Partial<Record<Action['type'], VerlaufArt>> = {
  CLEAR_EINGABEN: 'eingabenGeloescht',
  CLEAR_EINGABEN_TEIL: 'eingabenTeilGeloescht',
  FILL_BEISPIELWERTE: 'beispielwerte',
  FILL_BEISPIEL_BESETZUNG: 'beispielBesetzung',
  FILL_BEISPIELGEWICHTE: 'beispielGewichte',
  UPDATE_STARTER: 'starter',
  MOVE_STARTER: 'starter',
  ORDER_CLASS_BY_SIZE: 'starter',
  SET_START_NR_MODE: 'starter',
  ASSIGN_START_NUMBERS: 'starter',
  REMOVE_STARTER: 'starterGeloescht',
  ABMELDEN_STARTER: 'starterAbgemeldet',
  ANMELDEN_STARTER: 'starterAngemeldet',
  CLEAR_CLASS: 'starterGeloescht',
  CLEAR_ALL_STARTERS: 'starterGeloescht',
  SET_WEIGHT: 'gewicht',
  SET_AUFBAU: 'aufbau',
  SET_REGELWERK: 'regelwerk',
  SET_EVENT: 'veranstaltung',
  SET_EVENT_KIND: 'veranstaltung',
  ADD_PARCOURS: 'parcours',
  SET_PARCOURS_PRESET: 'parcours',
  REMOVE_PARCOURS: 'parcours',
  RENAME_PARCOURS: 'parcours',
  SET_PARCOURS_CLASSES: 'parcours',
  SET_PARCOURS_FACTOR: 'parcours',
  SET_PARCOURS_TRACKS: 'parcours',
  RESET_TRACKS: 'parcours',
  SET_VERZAHNUNG_LOCK: 'parcours',
  SET_WKR_NAME: 'besetzung',
  SET_BOOT: 'besetzung',
  SET_CO_PILOT: 'besetzung',
  SET_POKAL_VARIANTE: 'mannschaft',
  SET_POKAL_PUNKTE: 'mannschaft',
  SET_POKAL_UIM: 'mannschaft',
  SET_POKAL_NUR_AUSWAHL: 'mannschaft',
  SET_POKAL_ZAEHLT: 'mannschaft',
  INVERT_POKAL_ZAEHLT: 'mannschaft',
  SET_NICHT_WERTEN: 'nichtWerten',
  LOAD_STATE: 'geladen',
  RESET_ALL: 'zurueckgesetzt',
}

/**
 * Wie eine Action im Verlauf heißt – aus ihrer Art abgeleitet. `null`: Sie bekommt keinen eigenen
 * Eintrag (die Kennung der Veranstaltung entsteht von selbst), der Stand wird trotzdem gespeichert.
 * `nachher` ist der Stand nach der Action: Die Klasse einer Eingabe folgt aus ihren Startern.
 */
export function beschreibe(action: Action, nachher: Pick<AppState, 'starters'>): Beschreibung | null {
  switch (action.type) {
    case 'SET_KENNUNG':
      return null
    case 'SET_EINGABEN': {
      const ids = new Set(action.zellen.map((z) => z.starter))
      const klassen = new Set(nachher.starters.filter((p) => ids.has(p.id)).map((p) => p.klasse))
      // Ein Attempt des Parallelslaloms ist kein Lauf des Manövrierens: Die Runde steht dabei,
      // sonst hieße „Vorlauf, 2. Attempt“ im Verlauf „Lauf 2“ (lib/parallelSchluessel.ts).
      const runden = new Set(action.zellen.map((z) => zerlegeAttempt(z.lauf)?.runde ?? ''))
      const runde = runden.size === 1 ? [...runden][0] : undefined
      const laeufe = new Set(action.zellen.map((z) => zerlegeLauf(z.lauf).lauf))
      // Gemischt (Manövrieren und Parallelslalom, zwei Runden) gibt es keinen Lauf zu nennen.
      const lauf = laeufe.size === 1 && runde !== undefined ? [...laeufe][0] : undefined
      return {
        art: 'eingabe',
        ...(klassen.size === 1 ? { klasse: String([...klassen][0]) } : {}),
        ...(runde ? { runde } : {}),
        // Listen ohne Lauf (Knoten) stehen unter Lauf 0 – dort gibt es keinen zu nennen.
        ...(lauf !== undefined && lauf !== OHNE_LAUF && Number.isFinite(lauf) ? { lauf } : {}),
      }
    }
    case 'PARALLEL_RUNDE_FESTSCHREIBEN':
    case 'PARALLEL_RUNDE_LOESEN':
      return { art: action.type === 'PARALLEL_RUNDE_LOESEN' ? 'rundeGeloest' : 'rundeFest', klasse: action.klasse, runde: action.runde }
    case 'IMPORT_STARTERS':
      return { art: 'import', n: action.starters.length }
    case 'ADD_STARTERS':
      return { art: action.beispiel ? 'beispielStarter' : 'starterNeu', n: action.starters.length }
    default:
      // Alles Übrige sind Einstellungen (Listen, Kürzel, Boote, Gewichte je Klasse …).
      return { art: ARTEN[action.type] ?? 'einstellung' }
  }
}

/** Zwei Änderungen mit derselben Gruppe sind gleichartig. */
export function gruppe(was: Beschreibung): string {
  return `${was.art}|${was.klasse ?? ''}|${was.lauf ?? ''}${was.runde ? `|${was.runde}` : ''}`
}

/** Ein Eintrag des Verlaufs ohne den Stand selbst (der liegt getrennt, damit die Liste klein bleibt). */
export interface VerlaufEintrag {
  id: string
  /** Erste und letzte Änderung, die in diesem Eintrag steckt. Der Stand ist der nach der letzten. */
  von: number
  zeit: number
  was: Beschreibung
  /** Zahl der zusammengefassten Änderungen. */
  anzahl: number
  /** Nur bei „Stand merken“: Benannte Stände bleiben liegen. */
  name?: string
  /** Länge des gespeicherten Texts in Zeichen (≈ Bytes; mit Zeichen außerhalb von Latin-1 das Doppelte). */
  groesse: number
  /** Folge-Nummer des Stands – der Eintrag mit der jetzigen ist der jetzige Stand. */
  folge: number
}

/**
 * Wie lange gleichartige Änderungen ein Eintrag bleiben. Ohne Zusammenfassen wäre jeder
 * Tastendruck ein Eintrag; fasste man unbegrenzt zusammen, wäre eine Stunde Erfassung in einer
 * Klasse ein einziger Stand, und „zurück“ hieße: eine Stunde zurück. Deshalb endet ein Eintrag
 * nach einer Pause von zwei Minuten (dann war ein Starter oder ein Arbeitsschritt fertig) und
 * spätestens nach zehn Minuten.
 */
export const VERLAUF_PAUSE = 2 * 60_000
export const VERLAUF_DAUER = 10 * 60_000

/** Gehört die Änderung `was` (zum Zeitpunkt `jetzt`) noch in den letzten Eintrag? */
export function setztFort(letzter: VerlaufEintrag | null, was: Beschreibung, jetzt: number): boolean {
  if (!letzter || letzter.name !== undefined || EINZELN.has(was.art)) return false
  return gruppe(letzter.was) === gruppe(was) && jetzt - letzter.zeit < VERLAUF_PAUSE && jetzt - letzter.von < VERLAUF_DAUER
}

/**
 * Der Eintrag für ein Bündel von Änderungen, die zusammen gespeichert werden (in der Regel eine;
 * mehrere, wenn sie schneller kamen, als der Speicher schreibt). Der Stand ist der nach der
 * letzten – also trägt der Eintrag deren Namen. Ohne Beschreibung (`null`: Kennung, verworfene
 * Zeichen eines Scans) bleibt der letzte Eintrag, wie er heißt, und bekommt nur den neuen Stand.
 */
export function eintragFuer(
  letzter: VerlaufEintrag | null,
  aenderungen: readonly (Beschreibung | null)[],
  stand: { groesse: number; folge: number },
  jetzt: number,
  neueId: () => string,
): VerlaufEintrag | null {
  const benannt = aenderungen.filter((a): a is Beschreibung => a !== null)
  const was = benannt.at(-1)
  if (!was) return letzter && letzter.name === undefined ? { ...letzter, ...stand } : null
  // Wie viele am Ende gleichartig sind: Nur sie zählen zu diesem Eintrag.
  let n = 0
  for (let i = benannt.length - 1; i >= 0 && gruppe(benannt[i]) === gruppe(was); i--) n++
  if (n === benannt.length && setztFort(letzter, was, jetzt)) return { ...letzter!, ...stand, zeit: jetzt, was, anzahl: letzter!.anzahl + n }
  return { id: neueId(), von: jetzt, zeit: jetzt, was, anzahl: EINZELN.has(was.art) ? 1 : n, ...stand }
}

// --- Grenzen -----------------------------------------------------------------

/**
 * Grenzen für die von selbst angelegten Stände; benannte bleiben, bis man sie löscht.
 *
 * Gemessen (Chromium, 336 Starter, alle Läufe vollständig erfasst): Ein Stand hat rund 360 000
 * Zeichen; auf der Platte belegt er, weil Chromium die Datenbank verdichtet, rund 50 bis 100 kB
 * (ein einzelner gemerkter Stand: 45 kB; 100 Stände im vollen Verlauf: 9,8 MB – wie weit
 * Chromium gerade verdichtet hat, schwankt). 100 Stände sind bei Einträgen von höchstens zehn
 * Minuten gut zwei volle Wettkampftage Erfassung und belegen dann rund 5 bis 10 MB
 * (unverdichtet wären es höchstens 72 MB) – weit unter dem, was
 * Browser einer Seite zugestehen (hunderte MB bis GB). `groesse` (in Zeichen) deckelt das für
 * ungewöhnlich große Veranstaltungen. Nach 30 Tagen ist die Veranstaltung vorbei; so lange
 * liegen die Namen nicht ungefragt im Browser. Die jüngsten `mindestens` bleiben immer – auch
 * wer nach Monaten wieder öffnet, kommt einen Schritt zurück.
 */
export interface VerlaufGrenzen {
  anzahl: number
  alter: number
  groesse: number
  mindestens: number
}

export const VERLAUF_GRENZEN: VerlaufGrenzen = {
  anzahl: 100,
  alter: 30 * 24 * 3_600_000,
  groesse: 80_000_000,
  mindestens: 3,
}

/** Kennungen der von selbst angelegten Einträge, die neueren weichen. */
export function auszusondern(eintraege: readonly VerlaufEintrag[], jetzt: number, grenzen: VerlaufGrenzen = VERLAUF_GRENZEN): string[] {
  const eigene = sortiert(eintraege.filter((e) => e.name === undefined))
  const weg: string[] = []
  let summe = 0
  eigene.forEach((e, i) => {
    summe += e.groesse
    if (i < grenzen.mindestens) return
    if (i >= grenzen.anzahl || jetzt - e.zeit > grenzen.alter || summe > grenzen.groesse) weg.push(e.id)
  })
  return weg
}

/** Jüngste zuerst; bei gleichem Zeitpunkt der mit der höheren Folge-Nummer. */
export function sortiert(eintraege: readonly VerlaufEintrag[]): VerlaufEintrag[] {
  return [...eintraege].sort((a, b) => b.zeit - a.zeit || b.folge - a.folge || (a.id < b.id ? 1 : -1))
}
