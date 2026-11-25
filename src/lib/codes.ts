// Formatierung der Fehlercode-Felder (z. B. Steg "Fehler AB/AN", MüB, Tor 5).
// Beim Verlassen des Feldes werden die eingegebenen Codes numerisch sortiert und
// einheitlich mit ", " getrennt. Mehrfachnennungen zählen als mehrere Fehler und
// werden zusammengefasst: "6, 6" → "2x6".

import { WKR_ANNAHMEN } from '../wkr/annahmen'

/** Was ein Katalog-Eintrag über seine Höchstzahl weiß (types/bogen.ts ErrorDef, wkr/sicht.ts MaskenFeld.katalog). */
export interface CodeGrenze {
  code: string
  max?: number
  danach?: string
}

/**
 * Wie oft ein Code in einem Lauf höchstens vorkommen kann (Nutzer 24.11.2026): die Angabe `max` des Regelwerks
 * (YAML), sonst die allgemeine Grenze WKR_ANNAHMEN.codeMaxAllgemein (CM2). EINE Stelle für Gerät, Tabelle, Prüfung
 * der Gerätezeile und den Hinweis beim Abtippen.
 */
export function codeHoechstens(e: Pick<CodeGrenze, 'max'>): number {
  return e.max ?? WKR_ANNAHMEN.codeMaxAllgemein
}

/** Wie oft jeder Code in einer Fehler-Zelle steht („3, 2x6, 6“ → 3 → 1, 6 → 3), Schlüssel ohne führende Nullen. */
export function codeAnzahlen(wert: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const eintrag of codeEntries(wert)) {
    const c = parseCodeEntry(eintrag)
    if (!c || c.anzahl < 1) continue
    const code = String(Number(c.code))
    out.set(code, (out.get(code) ?? 0) + c.anzahl)
  }
  return out
}

/**
 * Die Codes einer Fehler-Zelle, die öfter stehen, als sie in einem Lauf vorkommen können ({@link codeHoechstens}) –
 * mit dem Buchstaben, den das Regelwerk für den Fall danach vorsieht (`danach`, „2. und 3. Versuch“ → D). Codes, die
 * der Katalog nicht kennt, zählen hier nicht (die verwirft normalizeCodeCell ohnehin).
 */
export function codesUeberMax(wert: string, katalog: readonly CodeGrenze[]): { code: string; anzahl: number; max: number; danach?: string }[] {
  const anzahlen = codeAnzahlen(wert)
  return katalog.flatMap((e) => {
    const anzahl = anzahlen.get(String(Number(e.code))) ?? 0
    const max = codeHoechstens(e)
    return anzahl > max ? [{ code: e.code, anzahl, max, ...(e.danach !== undefined ? { danach: e.danach } : {}) }] : []
  })
}

/**
 * Zerlegt eine Fehler-Spalte in ihre Einträge. „2 x 6“ gilt als ein Eintrag: Das
 * X zwischen zwei Zahlen ist der Faktor, nicht der Disq-Buchstabe X.
 */
export function codeEntries(raw: string): string[] {
  return raw
    .replace(/(\d+)\s*[xX×]\s*(\d+)/g, '$1x$2')
    .split(/[\s,;/]+/)
    .map((t) => t.trim())
    .filter((t) => t !== '')
}

/** Ein Eintrag als Code + Anzahl: „6“ → 1 × 6, „2x6“ → 2 × 6; sonst null. */
export function parseCodeEntry(entry: string): { code: string; anzahl: number } | null {
  if (/^\d+$/.test(entry)) return { code: entry, anzahl: 1 }
  const m = /^(\d+)x(\d+)$/i.exec(entry)
  return m ? { code: m[2], anzahl: Number(m[1]) } : null
}

/**
 * Normalisiert eine Fehler-Spalte beim Verlassen und lässt NUR gültige Werte zu:
 * Zahlen aus dem Spalten-Katalog (aufsteigend sortiert, mehrfache als „2x6“) sowie
 * erlaubte Disqualifikations-Buchstaben (großgeschrieben, ohne Dubletten, hinten).
 * Ungültige Codes/Buchstaben werden entfernt. Beispiel (Steg AB, allowedCodes
 * {3,4,5}): "12 4 k 3 3" → "2x3, 4, K"  (12 verworfen, k → K).
 */
export function normalizeCodeCell(
  raw: string,
  allowedCodes: Set<string>,
  allowedDisqs: Set<string>,
): string {
  const anzahl = new Map<number, number>()
  const letters: string[] = []
  for (const entry of codeEntries(raw)) {
    const parsed = parseCodeEntry(entry)
    if (parsed) {
      if (allowedCodes.has(parsed.code) && parsed.anzahl > 0) {
        const code = Number(parsed.code)
        anzahl.set(code, (anzahl.get(code) ?? 0) + parsed.anzahl)
      }
    } else if (!/^(\d+x|x\d+)$/i.test(entry)) {
      // Ein angefangenes „2x“ ist kein Disq-Buchstabe X.
      for (const ch of entry.toUpperCase()) if (allowedDisqs.has(ch)) letters.push(ch)
    }
  }
  const codes = [...anzahl.entries()]
    .sort(([a], [b]) => a - b)
    .map(([code, n]) => (n > 1 ? `${n}x${code}` : String(code)))
  return [...codes, ...[...new Set(letters)].sort()].join(', ')
}
