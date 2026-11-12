import type { RawSpalte } from './schema'

// Feld-Kennungen: was eine Spalte erfasst, unabhängig von Aufbau, Liste und Beschriftung.
// Gleiche Kennung = dasselbe Feld, z. B. „t1a|hin seiteA“ (Tor 1, Hinfahrt, rechte Boje)
// oder „katalog:tor5“ (Fehler der Einfahrt Tor 5). Disq. und Bemerkung gehören dagegen zu
// ihrer Liste („disq@steg“). Läuft auch ohne Bundler (scripts/check-config.ts).

/** Spalten-Key ohne Aufteilung: Tor 5 darf auf zwei Spalten verteilt sein (t5a, t5b). */
export function spaltenKennung(key: string): string {
  return key.replace(/^t5[ab]$/, 't5')
}

/** Die Kennungen einer Spalte: eine je Unter-Spalte, sonst genau eine. */
export function feldKennungen(
  sp: Pick<RawSpalte, 'key' | 'typ' | 'sub' | 'katalog'>,
  positionsKatalog?: string,
  positionId?: string,
): string[] {
  const key = spaltenKennung(sp.key ?? '')
  if (sp.sub && sp.sub.length > 0) return sp.sub.map((s) => `${key}|${s}`)
  if (positionId && (sp.typ === 'disq' || sp.typ === 'text')) return [`${key}@${positionId}`]
  const katalog = sp.katalog ?? positionsKatalog
  return [sp.typ === 'code' && katalog ? `katalog:${katalog}` : key]
}
