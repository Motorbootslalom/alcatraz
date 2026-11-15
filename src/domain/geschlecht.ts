import type { Geschlecht } from '../types'

// Das Geschlecht eines Starters – freiwillig, gebraucht allein für die Liste der Fahrer je Team
// nach Regel 960, Pkt. 3.7 („The list must contain: … Sex“). Vier Werte (Entscheidung des
// Nutzers vom 15.11.2026): M (männlich), F (weiblich), D (divers), nA (keine Angabe); ein leeres
// Feld heißt „nicht erfasst“ und ist erlaubt. „keine Angabe“ ist eine Antwort, „nicht erfasst“
// keine – die Liste je Team zählt nur Letzteres als fehlend.

/** Die Werte in der Reihenfolge der Auswahl. */
export const GESCHLECHTER: readonly Geschlecht[] = ['M', 'F', 'D', 'nA']

export const istGeschlecht = (x: unknown): x is Geschlecht => (GESCHLECHTER as readonly unknown[]).includes(x)

/** Gängige Schreibweisen je Wert – groß geschrieben, ohne Leerraum am Rand. */
const SCHREIBWEISEN: Readonly<Record<Geschlecht, readonly string[]>> = {
  M: ['M', 'MALE', 'MÄNNLICH', 'MAENNLICH'],
  F: ['F', 'W', 'FEMALE', 'WEIBLICH'],
  D: ['D', 'DIVERSE', 'DIVERS'],
  nA: ['NA', 'N/A', 'N.A.', 'KEINE ANGABE', 'K.A.', 'K. A.'],
}

/**
 * Ein Geschlecht aus einer Datei (Import): M, male, männlich; F, W, female, weiblich; D,
 * diverse, divers; nA, n/a, keine Angabe – Groß-/Kleinschreibung egal. `undefined`: leer oder
 * nicht erkannt (der Import meldet, was er nicht erkannt hat).
 */
export function parseGeschlecht(raw: string): Geschlecht | undefined {
  const s = raw.trim().replace(/\s+/g, ' ').toUpperCase()
  if (!s) return undefined
  return GESCHLECHTER.find((g) => SCHREIBWEISEN[g].includes(s))
}

/**
 * So steht das Geschlecht auf einer Liste: englisch M, F, D, n/a (Entscheidung des Nutzers vom
 * 15.11.2026), deutsch wie in der Eingabe M, F, D, nA. Nicht erfasst = leer.
 */
export function geschlechtAufListe(g: Geschlecht | undefined, sprache: 'de' | 'en'): string {
  if (g === undefined) return ''
  return sprache === 'en' && g === 'nA' ? 'n/a' : g
}
