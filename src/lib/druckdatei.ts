import type { PokalVariante } from '../config/pokal'

// Die Druckdatei (components/DruckdateiListen.vue): alles, was nach dem Wettkampf an die
// teilnehmenden Gruppen geht, in einer Datei. Hier steht die Auswahl und die Reihenfolge der
// Dokumente – rein, ohne DOM.

/** „Extern“ geht an alle (wie der Aushang), „Intern“ bleibt beim Veranstalter. */
export type DruckdateiFassung = 'extern' | 'intern'
/**
 * Die Teile in der Reihenfolge der Datei: Starterliste, Mannschaftswertungen, Einzelwertung
 * (Regel 960, Pkt. 5.2.3 – aus den Disziplinen, zu denen Werte erfasst sind; lib/disziplinen.ts),
 * Erklärung der Codes, Wertungslisten des Manövrierens, Wertungslisten des Parallelslaloms (nur
 * unter einem Regelwerk, das ihn kennt – sonst gibt es dazu weder Kästchen noch Dokumente): erst
 * das Gesamtergebnis je Klasse, dann die Runden in der Folge, in der sie gefahren wurden.
 */
export const DRUCKDATEI_TEILE = ['starter', 'pokal', 'einzel', 'codes', 'ergebnis', 'parallel'] as const
export type DruckdateiTeil = (typeof DRUCKDATEI_TEILE)[number]
/**
 * Teile, die später dazukamen: Eine gemerkte Auswahl aus der Zeit davor kennt sie nicht und
 * bleibt trotzdem gültig – der Teil gilt dann als gewählt ({@link teilGewaehlt}).
 */
const SPAETERE_TEILE: readonly DruckdateiTeil[] = ['einzel']

/** Ist der Teil gewählt? Ein Teil, den die gemerkte Auswahl noch nicht kennt, ist es. */
export const teilGewaehlt = (wahl: Pick<DruckdateiWahl, 'teile'>, teil: DruckdateiTeil): boolean => wahl.teile[teil] !== false

/** Was im Reiter „Druckdatei“ gewählt ist; übersteht Ansichtswechsel und Neuladen (lib/merken.ts). */
export interface DruckdateiWahl {
  fassung: DruckdateiFassung
  teile: Record<DruckdateiTeil, boolean>
  /** Wertungslisten: Läufe und Gesamtliste oder nur die Gesamtliste. */
  umfang: 'alles' | 'gesamt'
  /**
   * Parallelslalom: die Liste der Attempts nach Attempt oder nach Racecourse geteilt
   * (lib/parallelErgebnis.ts `RundenAnsicht`); fehlt = nach Attempt. Nur eine Ansicht.
   */
  ansicht?: 'attempt' | 'racecourse'
  /**
   * Parallelslalom: abgewählte Runden (`pre`, `semi`, `final`, `rerun-…`) und `stage` für das
   * Gesamtergebnis – gemerkt sind die abgewählten, damit eine Runde, die später festgeschrieben
   * wird, dabei ist. Fehlt = alles.
   */
  ohneRunden?: string[]
  /** Abgewählte Klassen – gemerkt sind die abgewählten, damit eine Klasse, die später dazukommt, dabei ist. */
  ohneKlassen: string[]
}
/** Vorgabe: die Fassung, die verschickt wird, vollständig. Jedes Mal ein neues Objekt – die Auswahl wird an Ort und Stelle geändert. */
export const druckdateiVorgabe = (): DruckdateiWahl => ({ fassung: 'extern', teile: { starter: true, pokal: true, einzel: true, codes: true, ergebnis: true, parallel: true }, umfang: 'alles', ohneKlassen: [] })

export function istDruckdateiWahl(x: unknown): x is DruckdateiWahl {
  const w = x as Partial<DruckdateiWahl> | null
  return (
    !!w &&
    typeof w === 'object' &&
    (w.fassung === 'extern' || w.fassung === 'intern') &&
    !!w.teile &&
    typeof w.teile === 'object' &&
    DRUCKDATEI_TEILE.every((teil) => typeof w.teile![teil] === 'boolean' || (w.teile![teil] === undefined && SPAETERE_TEILE.includes(teil))) &&
    (w.umfang === 'alles' || w.umfang === 'gesamt') &&
    (w.ansicht === undefined || w.ansicht === 'attempt' || w.ansicht === 'racecourse') &&
    (w.ohneRunden === undefined || (Array.isArray(w.ohneRunden) && w.ohneRunden.every((r) => typeof r === 'string'))) &&
    Array.isArray(w.ohneKlassen) &&
    w.ohneKlassen.every((k) => typeof k === 'string')
  )
}

/**
 * Ein Dokument der Datei: eine Liste mit eigener Seitenzählung. `startliste` ist kein wählbarer
 * Teil: die Startliste einer Runde des Parallelslaloms, die vor deren Wertungslisten steht und
 * mit dem Teil „Parallelslalom“ kommt und geht.
 */
export interface DruckdateiDokument {
  teil: DruckdateiTeil | 'startliste'
  id: string
  /** Parallelslalom: der Abschnitt, zu dem das Dokument gehört – eine Runde oder das Gesamtergebnis. */
  gruppe?: string
}

/** Ein Abschnitt des Parallelslaloms in der Datei: das Gesamtergebnis oder eine Runde mit ihren Wertungslisten. */
export interface ParallelAbschnitt {
  /** Kennung des Abschnitts: die Runde (`pre` …) oder `stage`. */
  gruppe: string
  /** Die Runde, deren Startliste vor den Listen steht; fehlt beim Gesamtergebnis. */
  startliste?: string
  ids: readonly string[]
}

/**
 * Die Mannschaftswertungen in der Reihenfolge der Vorlage: erst die nach UIM-Punkten (die
 * Länderwertung des Reglements), dann die nach Plätzen.
 */
const POKAL_FOLGE: readonly PokalVariante[] = ['uim', 'plaetze3', 'plaetze6']

/**
 * Die Dokumente in Druckreihenfolge. `vorhanden` nennt, was es zum Stand der Veranstaltung
 * gibt: die Starterlisten (je Parcours), die Mannschaftswertungen mit Blatt, die Einzelwertungen
 * der gewählten Klassen (nur unter Regel 960), die Wertungslisten
 * der gewählten Klassen (Manövrieren, dahinter die des Parallelslaloms) – jeweils schon in ihrer
 * eigenen Reihenfolge. Abgewählte Teile entfallen; der Aushang der Codes hängt nur am Regelwerk
 * und ist immer ein Dokument.
 *
 * Zwei Ordnungen:
 * - `dm` (Vorgabe, wie die lange PDF der Deutschen Meisterschaft): Starterliste,
 *   Mannschaftswertungen, Einzelwertung, Codes, Wertungslisten.
 * - `regel960` (Entscheidung des Nutzers vom 15.11.2026 für Wettkämpfe nach UIM): erst, was alle
 *   zuerst suchen – Mannschaftswertung, Legende der Fehlerpunkte (Codes), Einzelwertung –, dann je
 *   Disziplin deren Listen: vor den Wertungslisten des Manövrierens die verzahnte Starterliste,
 *   vor den Wertungslisten jeder Runde des Parallelslaloms deren Startliste mit den Blöcken
 *   (`parallelAbschnitte`). Die Starterliste gehört dort zum Manövrieren: Ist nur der
 *   Parallelslalom gefahren, entfällt sie.
 */
export function druckdateiFolge(
  wahl: Pick<DruckdateiWahl, 'teile'>,
  vorhanden: {
    starter: readonly string[]
    pokal: readonly PokalVariante[]
    einzel?: readonly string[]
    ergebnis: readonly string[]
    parallel?: readonly string[]
    /** Nur für die Ordnung `regel960`: der Parallelslalom in Abschnitten (statt `parallel`). */
    parallelAbschnitte?: readonly ParallelAbschnitt[]
  },
  ordnung: 'dm' | 'regel960' = 'dm',
): DruckdateiDokument[] {
  const teil = (t: DruckdateiTeil, ids: readonly string[]): DruckdateiDokument[] => (teilGewaehlt(wahl, t) ? ids.map((id) => ({ teil: t, id })) : [])
  const pokal = teil(
    'pokal',
    POKAL_FOLGE.filter((v) => vorhanden.pokal.includes(v)),
  )
  if (ordnung === 'dm') {
    return [...teil('starter', vorhanden.starter), ...pokal, ...teil('einzel', vorhanden.einzel ?? []), ...teil('codes', ['codes']), ...teil('ergebnis', vorhanden.ergebnis), ...teil('parallel', vorhanden.parallel ?? [])]
  }
  const abschnitte = teilGewaehlt(wahl, 'parallel') ? (vorhanden.parallelAbschnitte ?? []).filter((a) => a.ids.length > 0) : []
  // Die verzahnte Starterliste ist die Startfolge des Manövrierens: Steht nur der Parallelslalom in der Datei, fehlt sie.
  const nurParallel = vorhanden.ergebnis.length === 0 && (vorhanden.parallelAbschnitte ?? []).some((a) => a.ids.length > 0)
  return [
    ...pokal,
    ...teil('codes', ['codes']),
    ...teil('einzel', vorhanden.einzel ?? []),
    ...(nurParallel ? [] : teil('starter', vorhanden.starter)),
    ...teil('ergebnis', vorhanden.ergebnis),
    ...abschnitte.flatMap((a): DruckdateiDokument[] => [
      ...(a.startliste === undefined ? [] : [{ teil: 'startliste' as const, id: a.startliste, gruppe: a.gruppe }]),
      ...a.ids.map((id) => ({ teil: 'parallel' as const, id, gruppe: a.gruppe })),
    ]),
  ]
}
