import type { AppState, ClassId, NichtWerten, WertungsDisziplin } from '../types'
import { CLASS_IDS } from '../domain/classes'
import { NICHT_GESTARTET } from './abmeldung'
import { zerlegeAttempt } from './parallelSchluessel'

// Welche Disziplin in Einzel- und Mannschaftswertung nach Regel 960 zählt – rein, ohne DOM.
//
// Entscheidungen des Nutzers vom 15.11.2026 (Organisation; Regel 960 nennt die Fälle nicht):
//   • Es gibt keine Wahl der Disziplinen. Eine Disziplin (Manövrieren, Parallelslalom) zählt,
//     sobald zu ihr der erste Wert erfasst ist; ohne Werte fehlt sie in Einzelwertung,
//     Mannschaftswertung und Druckdatei. Das gilt in beide Richtungen – auch nur der
//     Parallelslalom ohne Manövrieren –, und nirgends wird eine Reihenfolge der Disziplinen
//     vorausgesetzt.
//   • Wird eine Disziplin in einer Klasse abgebrochen, zählt sie für diese Klasse nicht. Ob sie
//     dann auch für fertige Klassen gestrichen wird, entscheidet der O.O.D. vor Ort: Dafür gibt
//     es den Schalter „Disziplin nicht werten“ je Disziplin und Klasse (`AppState.nichtWerten`).
//     Regel 960 sagt dazu nichts – nur Pkt. 5.1: „Drivers must complete the relevant stage and
//     cross the finishing line in order to be classified for the stage.“
//
// Auf Listen und in der Oberfläche steht nie eine Nummer der Stage („stage 2“, „2nd stage“),
// nur der Name der Disziplin (Entscheidung des Nutzers).

export const WERTUNGS_DISZIPLINEN = ['manoever', 'parallel'] as const satisfies readonly WertungsDisziplin[]

/** Schlüssel des Namens einer Disziplin (i18n): „Manövrieren“ / „Parallel-Slalom“. */
export const DISZIPLIN_TEXT = { manoever: 'running.source.manoever', parallel: 'parallel.title' } as const

/** Was die Frage „gefahren?“ braucht: die Werte und wer abgemeldet ist (dessen X zählt nicht). */
export type GefahrenStand = Pick<AppState, 'eingaben'> & Partial<Pick<AppState, 'abgemeldet'>>
export type DisziplinStand = GefahrenStand & Partial<Pick<AppState, 'nichtWerten'>>

/** Steht für den Starter in diesem Lauf nur ein X – und sonst nichts? So trägt es die Abmeldung ein (lib/abmeldung.ts). */
const nurX = (werte: Readonly<Record<string, string>>) => {
  const alle = Object.values(werte)
  return alle.length === 1 && alle[0].trim().toUpperCase() === NICHT_GESTARTET
}

/**
 * Ist zu der Disziplin ein Wert erfasst? Die Werte des Parallelslaloms stehen unter den Attempts
 * seiner Runden (lib/parallelSchluessel.ts), alles andere gehört zum Manövrieren – auch die
 * Knoten und der Haken „erfasst“.
 *
 * Nicht mit zählt das X, das die Abmeldung eines Starters von selbst in jeden Lauf und jeden
 * Attempt eines festgeschriebenen Plans schreibt (lib/abmeldung.ts): Es ist kein erfasster Wert
 * der Disziplin, sondern die Folge einer Abmeldung in der anderen. Zählte es, machte EINE
 * Abmeldung eine nie gefahrene Disziplin zur gefahrenen – die Einzelwertung verschwände, die
 * Mannschaftswertung würde zum Zwischenstand. Steht beim Abgemeldeten mehr als das X (er ist
 * gefahren, oder jemand hat etwas vermerkt), zählt es wie jeder Wert.
 */
export function disziplinGefahren(stand: GefahrenStand, disziplin: WertungsDisziplin): boolean {
  const ab = new Set(stand.abgemeldet ?? [])
  return Object.entries(stand.eingaben).some(
    ([schluessel, zeilen]) =>
      (zerlegeAttempt(schluessel) !== undefined) === (disziplin === 'parallel') && Object.entries(zeilen).some(([id, werte]) => !(ab.has(id) && nurX(werte))),
  )
}

/** Steht für die Klasse der Schalter „Disziplin nicht werten“? */
export function nichtGewertet(nichtWerten: NichtWerten | undefined, disziplin: WertungsDisziplin, klasse: ClassId): boolean {
  return nichtWerten?.[disziplin]?.includes(klasse) === true
}

/** Zählt die Disziplin für die Klasse? Gefahren (erster Wert erfasst) und nicht per Schalter gestrichen. */
export function disziplinZaehlt(stand: DisziplinStand, disziplin: WertungsDisziplin, klasse: ClassId): boolean {
  return disziplinGefahren(stand, disziplin) && !nichtGewertet(stand.nichtWerten, disziplin, klasse)
}

/** Den Schalter für die genannten Klassen setzen oder lösen; Klassen in ihrer festen Folge, eine leere Liste entfällt. */
export function setzeNichtWerten(nichtWerten: NichtWerten, disziplin: WertungsDisziplin, klassen: readonly ClassId[], an: boolean): NichtWerten {
  const bisher = nichtWerten[disziplin] ?? []
  const neu = CLASS_IDS.filter((k) => (klassen.includes(k) ? an : bisher.includes(k)))
  if (neu.length === bisher.length && neu.every((k, i) => k === bisher[i])) return nichtWerten
  const { [disziplin]: _alt, ...rest } = nichtWerten
  return neu.length === 0 ? rest : { ...rest, [disziplin]: neu }
}

/** Ein gelesener Schalter (localStorage, Sicherung): nur bekannte Disziplinen und Klassen. */
export function normalisiereNichtWerten(roh: unknown): NichtWerten {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return {}
  let aus: NichtWerten = {}
  for (const disziplin of WERTUNGS_DISZIPLINEN) {
    const klassen = (roh as Record<string, unknown>)[disziplin]
    if (Array.isArray(klassen)) aus = setzeNichtWerten(aus, disziplin, CLASS_IDS.filter((k) => klassen.includes(k)), true)
  }
  return aus
}

/** Je Disziplin die Klassen (von `klassen`), für die der Schalter steht – nur Disziplinen mit mindestens einer. */
export function gestricheneKlassen(nichtWerten: NichtWerten | undefined, klassen: readonly ClassId[]): { disziplin: WertungsDisziplin; klassen: ClassId[]; alle: boolean }[] {
  return WERTUNGS_DISZIPLINEN.flatMap((disziplin) => {
    const betroffen = klassen.filter((k) => nichtGewertet(nichtWerten, disziplin, k))
    return betroffen.length === 0 ? [] : [{ disziplin, klassen: betroffen, alle: betroffen.length === klassen.length }]
  })
}
