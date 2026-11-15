import type { PokalVariante } from '../config/pokal'

// Die Druckdatei (components/DruckdateiListen.vue): alles, was nach dem Wettkampf an die
// teilnehmenden Gruppen geht, in einer Datei. Hier steht die Auswahl und die Reihenfolge der
// Dokumente – rein, ohne DOM.

/** „Extern“ geht an alle (wie der Aushang), „Intern“ bleibt beim Veranstalter. */
export type DruckdateiFassung = 'extern' | 'intern'
/** Die Teile in der Reihenfolge der Datei: Starterliste, Mannschaftswertungen, Erklärung der Codes, Ergebnislisten. */
export const DRUCKDATEI_TEILE = ['starter', 'pokal', 'codes', 'ergebnis'] as const
export type DruckdateiTeil = (typeof DRUCKDATEI_TEILE)[number]

/** Was im Reiter „Druckdatei“ gewählt ist; übersteht Ansichtswechsel und Neuladen (lib/merken.ts). */
export interface DruckdateiWahl {
  fassung: DruckdateiFassung
  teile: Record<DruckdateiTeil, boolean>
  /** Ergebnislisten: Läufe und Gesamtliste oder nur die Gesamtliste. */
  umfang: 'alles' | 'gesamt'
  /** Abgewählte Klassen – gemerkt sind die abgewählten, damit eine Klasse, die später dazukommt, dabei ist. */
  ohneKlassen: string[]
}
/** Vorgabe: die Fassung, die verschickt wird, vollständig. Jedes Mal ein neues Objekt – die Auswahl wird an Ort und Stelle geändert. */
export const druckdateiVorgabe = (): DruckdateiWahl => ({ fassung: 'extern', teile: { starter: true, pokal: true, codes: true, ergebnis: true }, umfang: 'alles', ohneKlassen: [] })

export function istDruckdateiWahl(x: unknown): x is DruckdateiWahl {
  const w = x as Partial<DruckdateiWahl> | null
  return (
    !!w &&
    typeof w === 'object' &&
    (w.fassung === 'extern' || w.fassung === 'intern') &&
    !!w.teile &&
    typeof w.teile === 'object' &&
    DRUCKDATEI_TEILE.every((teil) => typeof w.teile![teil] === 'boolean') &&
    (w.umfang === 'alles' || w.umfang === 'gesamt') &&
    Array.isArray(w.ohneKlassen) &&
    w.ohneKlassen.every((k) => typeof k === 'string')
  )
}

/** Ein Dokument der Datei: eine Liste mit eigener Seitenzählung. */
export interface DruckdateiDokument {
  teil: DruckdateiTeil
  id: string
}

/**
 * Die Mannschaftswertungen in der Reihenfolge der Vorlage: erst die nach UIM-Punkten (die
 * Länderwertung des Reglements), dann die nach Plätzen.
 */
const POKAL_FOLGE: readonly PokalVariante[] = ['uim', 'plaetze3', 'plaetze6']

/**
 * Die Dokumente in Druckreihenfolge. `vorhanden` nennt, was es zum Stand der Veranstaltung
 * gibt: die Starterlisten (je Parcours), die Mannschaftswertungen mit Blatt, die Ergebnislisten
 * der gewählten Klassen – jeweils schon in ihrer eigenen Reihenfolge. Abgewählte Teile
 * entfallen; der Aushang der Codes hängt nur am Regelwerk und ist immer ein Dokument.
 */
export function druckdateiFolge(wahl: Pick<DruckdateiWahl, 'teile'>, vorhanden: { starter: readonly string[]; pokal: readonly PokalVariante[]; ergebnis: readonly string[] }): DruckdateiDokument[] {
  const teil = (t: DruckdateiTeil, ids: readonly string[]): DruckdateiDokument[] => (wahl.teile[t] ? ids.map((id) => ({ teil: t, id })) : [])
  return [
    ...teil('starter', vorhanden.starter),
    ...teil(
      'pokal',
      POKAL_FOLGE.filter((v) => vorhanden.pokal.includes(v)),
    ),
    ...teil('codes', ['codes']),
    ...teil('ergebnis', vorhanden.ergebnis),
  ]
}
