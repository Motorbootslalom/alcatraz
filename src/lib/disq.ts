import type { DisqDef } from '../types'

// Eingabehilfen für Disqualifikations-Codes.
//   • automatisch Großbuchstaben
//   • nur Codes zulässig, die für die jeweilige Position konfiguriert sind
//   • mehrere Codes mit Komma und/oder Leerzeichen getrennt

/** Menge der erlaubten Codes aus der (positionsspezifischen) Disq-Tabelle. */
export function allowedSet(disqTable?: DisqDef[]): Set<string> {
  return new Set((disqTable ?? []).map((d) => d.code))
}

/**
 * Bereinigt eine Disq-Eingabe: Großbuchstaben, nur erlaubte Codes; mehrere
 * Codes werden einheitlich mit ", " getrennt. Egal ob mit Komma, Leerzeichen
 * oder ohne Trenner getippt - "A B", "a,x" und "gf" werden zu "A, B" / "A, X"
 * / "G, F".
 */
export function sanitizeDisq(raw: string, allowed: Set<string>): string {
  const codes = [...raw.toUpperCase()].filter((c) => allowed.has(c))
  return codes.join(', ')
}

/**
 * Live-Bereinigung einer Fehler-Spalte während der Eingabe: Buchstaben
 * groß, nur Ziffern/Buchstaben/Trenner behalten. Die eigentliche Prüfung auf
 * gültige Codes/Disqualifikationen erfolgt beim Verlassen (normalizeCodeCell).
 */
export function sanitizeCodeInput(raw: string): string {
  return raw
    .replace(/×/g, 'x')
    .toUpperCase()
    .replace(/[^0-9A-Z ,;/]/g, '')
    .replace(/(\d)X(\d)/g, '$1x$2') // Faktor „2x6“ klein, X allein ist die Disqualifikation
}

/**
 * Bereinigt eine Bojen-/Tor-Zelle: entweder Punkte (Ziffern) ODER ein einzelner
 * erlaubter Disq-Buchstabe (großgeschrieben).
 */
export function sanitizeBuoy(raw: string, allowed: Set<string>): string {
  const up = raw.toUpperCase()
  // Enthält die Eingabe einen erlaubten Buchstaben, gilt sie als Disq-Marke.
  const letter = [...up].find((c) => allowed.has(c))
  if (letter) return letter
  // sonst nur Ziffern behalten
  return raw.replace(/\D/g, '')
}
