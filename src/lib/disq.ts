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
 * Bereinigt eine Bojen-/Tor-Zelle: Ziffern (Punkte, 5, 10 …), dahinter höchstens ein erlaubter Disq-Buchstabe
 * (großgeschrieben), ohne Leerzeichen gespeichert: „5“, „J“, „5J“, „10G“ (Tor 5 Zähler). Die Eingabe ist tolerant –
 * „5 j“, „j5“ und „5,J“ werden „5J“ –, weil der WKR an der Boje Fehlerpunkte UND den Disq.-Grund notiert und
 * beides beim Abtippen in derselben Zelle steht (Antwort W4-12 vom 21.11.2026, WKR_ANNAHMEN.bojenZelle BZ1).
 * Vorher hieß ein Buchstabe „nur Disq.“ und verwarf die Punkte; alte Werte („5“, „J“) sind in der neuen Form
 * unverändert gültig.
 *
 * X „nicht gestartet“ steht nie mit Punkten (BZ2): Wer nicht gestartet ist, hat keine Boje berührt – „5X“ wird „X“.
 */
export function sanitizeBuoy(raw: string, allowed: Set<string>): string {
  const up = raw.toUpperCase()
  const letter = [...up].find((c) => allowed.has(c)) ?? ''
  // 'X' = lib/abmeldung.ts NICHT_GESTARTET; nicht importiert, weil abmeldung → eingaben → disq einen Ring schlösse.
  if (letter === 'X') return letter
  return `${raw.replace(/\D/g, '')}${letter}`
}
