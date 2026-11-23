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

/** Trenner einer Bojenzelle – zwischen Punkten und Buchstaben und zwischen den Buchstaben (BZ6, 22.11.2026). */
export const BOJEN_TRENNER = ', '

/**
 * Die EINE Schreibweise einer Bojen-/Tor-Zelle (BZ1 umgebaut, BZ6, 22.11.2026 – R7-14): Punkte zuerst, dahinter die
 * Disq.-Buchstaben in der Folge des Disq.-Katalogs der Zelle (`erlaubt`, eine Set in Katalogfolge), getrennt mit „, “:
 * „5“, „J“, „5, J“, „5, J, D“, „10, G“ (Tor 5 Zähler). Katalogfolge statt Tippfolge, damit zwei Zellen mit gleichem
 * Inhalt String-gleich sind (BZ5 „abweichend = String-ungleich“ bleibt einfach); Dubletten fallen weg, fremde Buchstaben
 * ebenso. Speicherform = Anzeigeform – Wertungsliste, Erfassung und Gerät zeigen sie, wie sie steht.
 * Ohne `erlaubt` bleibt die Folge, wie sie kommt (nur entdoppelt).
 *
 * X „nicht gestartet“ steht immer allein (BZ2): Wer nicht gestartet ist, hat keine Boje berührt und keinen anderen
 * Grund – „5, X“ und „J, X“ werden „X“. 'X' = lib/abmeldung.ts NICHT_GESTARTET; nicht importiert, weil
 * abmeldung → eingaben → disq einen Ring schlösse.
 */
export function bojenZelle(punkte: string | number, buchstaben: Iterable<string>, erlaubt?: Set<string>): string {
  const gross = new Set([...buchstaben].map((b) => b.toUpperCase()))
  if (gross.has('X') && (!erlaubt || erlaubt.has('X'))) return 'X'
  const folge = erlaubt ? [...erlaubt].filter((b) => gross.has(b)) : [...gross]
  const zahl = typeof punkte === 'number' ? (punkte > 0 ? String(punkte) : '') : punkte
  return [...(zahl ? [zahl] : []), ...folge].join(BOJEN_TRENNER)
}

/**
 * Bereinigt eine Bojen-/Tor-Zelle beim Abtippen (je Taste, ErfassungTabelle onInput) und beim Laden aus Tabelle oder
 * Gerät: alle Ziffern = eine Zahl (wie seit jeher, „5 5“ bleibt „55“), jeder erlaubte Buchstabe einzeln, gleich mit
 * welchem Trenner – „5JD“, „5 J D“, „5,J,D“, „j5d“, „5, d, j“ werden „5, J, D“ (bojenZelle, Katalogfolge). Mehrere
 * Disq. je Boje seit R7-14 (22.11.2026, BZ1 umgebaut): Der WKR notiert an einer Boje Fehlerpunkte UND jeden Grund.
 * Zwischenstände beim Tippen stören nicht: „5 “ und „5,“ werden „5“, „5, J“ + „D“ wird „5, J, D“ (der Cursor steht
 * danach am Ende – das Feld bekommt den ganzen Wert neu).
 */
export function sanitizeBuoy(raw: string, allowed: Set<string>): string {
  return bojenZelle(raw.replace(/\D/g, ''), [...raw.toUpperCase()].filter((c) => allowed.has(c)), allowed)
}
