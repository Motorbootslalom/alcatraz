import type { Geschlecht } from '../types'

// Das Geschlecht eines Starters – freiwillig, gebraucht allein für die Liste der Fahrer je Team
// nach Regel 960, Pkt. 3.7 („The list must contain: … Sex“). Vier Werte (Entscheidung des
// Nutzers vom 15.11.2026): M (männlich), F (weiblich), D (divers), nA (keine Angabe); ein leeres
// Feld heißt „nicht erfasst“ und ist erlaubt. „keine Angabe“ ist eine Antwort, „nicht erfasst“
// keine – die Liste je Team zählt nur Letzteres als fehlend. Gespeichert werden immer diese vier;
// gezeigt wird das Kürzel der jeweiligen Sprache ({@link geschlechtKuerzel}).

/** Die Werte in der Reihenfolge der Auswahl. */
export const GESCHLECHTER: readonly Geschlecht[] = ['M', 'F', 'D', 'nA']

export const istGeschlecht = (x: unknown): x is Geschlecht => (GESCHLECHTER as readonly unknown[]).includes(x)

/**
 * Gängige Schreibweisen je Wert, verglichen ohne Leerraum, Punkte und Schrägstriche (`kompakt`):
 * „k. A.“, „k.A.“ und „KA“ sind dasselbe, ebenso „n/a“ und „NA“. Deutsch und englisch, weil eine
 * Datei aus beiden Welten kommen kann – W (weiblich) wie auf deutschen Listen, F wie auf englischen.
 */
const SCHREIBWEISEN: Readonly<Record<Geschlecht, readonly string[]>> = {
  M: ['M', 'MALE', 'MAN', 'MÄNNLICH', 'MAENNLICH', 'MÄNNL', 'MAENNL'],
  F: ['F', 'W', 'FEMALE', 'WOMAN', 'WEIBLICH', 'WEIBL'],
  D: ['D', 'DIVERSE', 'DIVERS', 'DIV'],
  nA: ['NA', 'KA', 'KEINEANGABE', 'KEINEANGABEN', 'NOTSPECIFIED'],
}

/** Groß geschrieben, ohne Leerraum, Punkte und Schrägstriche: „k. A.“ → „KA“, „n/a“ → „NA“. */
const kompakt = (s: string) => s.toUpperCase().replace(/[\s./]+/g, '')

/**
 * Ein Geschlecht aus einer Datei (Import): M, male, männlich; F, W, female, weiblich; D,
 * diverse, divers; nA, n/a, k. A., keine Angabe – Groß-/Kleinschreibung, Leerzeichen und
 * Punkte egal. `undefined`: leer oder nicht erkannt (der Import meldet, was er nicht erkannt hat).
 */
export function parseGeschlecht(raw: string): Geschlecht | undefined {
  const s = kompakt(raw)
  if (!s) return undefined
  return GESCHLECHTER.find((g) => SCHREIBWEISEN[g].includes(s))
}

/**
 * Die Kürzel je Sprache (Entscheidung des Nutzers vom 15.11.2026): englisch M, F, D, n/a,
 * deutsch M, W, D, k. A. Gespeichert wird immer M, F, D, nA – nur die Anzeige wechselt.
 */
const KUERZEL: Readonly<Record<'de' | 'en', Readonly<Record<Geschlecht, string>>>> = {
  de: { M: 'M', F: 'W', D: 'D', nA: 'k. A.' },
  en: { M: 'M', F: 'F', D: 'D', nA: 'n/a' },
}

/**
 * Das Kürzel eines Geschlechts in einer Sprache: auf Listen in der Sprache der Liste (englische
 * Listen der UIM M, F, D, n/a; deutsche der DM M, W, D, k. A.), in der Oberfläche (Starter-Reiter)
 * in deren Sprache. Andere Sprachen nehmen das Englische.
 */
export function geschlechtKuerzel(g: Geschlecht, sprache: string): string {
  return (sprache === 'de' ? KUERZEL.de : KUERZEL.en)[g]
}

/** So steht das Geschlecht auf einer Liste ({@link geschlechtKuerzel}); nicht erfasst = leer. */
export function geschlechtAufListe(g: Geschlecht | undefined, sprache: 'de' | 'en'): string {
  return g === undefined ? '' : geschlechtKuerzel(g, sprache)
}
