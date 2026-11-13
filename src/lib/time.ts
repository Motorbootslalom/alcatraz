// Zeiteingabe für die Zeitnahme-Liste.
//
// Die WKR arbeiten mit unterschiedlichen Stoppuhren:
//   • solche, die mm:ss,00 anzeigen  (Minuten : Sekunden , Hundertstel)
//   • solche, die nur ss,00 anzeigen (Sekunden , Hundertstel)
//
// Damit die Eingabe über das Numpad extrem schnell geht, wird EINE Zahl mit
// Trenner (Komma ODER Punkt) getippt. Die Bedeutung des Teils VOR dem Trenner
// entscheidet sich über seinen Wert, der Trenner selbst darf auch fehlen:
//
//   • Zahl vor dem Trenner ≥ 20  → es sind SEKUNDEN, danach Hundertstel
//                                   Beispiel: 45,67  → 0:45,67
//                                             20     → 0:20,00
//   • Zahl vor dem Trenner < 20  → es sind MINUTEN, danach ss + Hundertstel
//                                   Beispiel: 1,2345 → 1:23,45
//                                             1      → 1:00,00
//
// Wer die Zeit so abtippt, wie die Uhr sie zeigt, schreibt einen Doppelpunkt: "1:23,45".
// Der ist dann eindeutig der Trenner zwischen Minuten und Sekunden. (Früher fiel er einfach
// weg – aus 1:23,45 wurden stillschweigend 123,45 Sekunden.)
//
// Ergebnis wird intern immer als Gesamt-Hundertstel gespeichert, sodass
// gerechnet werden kann. Anzeige nach Verlassen des Feldes: "mm:ss,00 (ss,00)".

export interface ParsedTime {
  /** Gesamtzeit in Hundertstelsekunden. */
  centis: number
}

const SEP = /[.,]/

/**
 * Nur Ziffern, ein Trenner und davor höchstens ein Doppelpunkt (für die Live-Eingabe).
 * `trenner` ist das Zeichen, als das Komma oder Punkt erscheinen (Sprache der Oberfläche).
 */
export function sanitizeTimeInput(raw: string, trenner: ',' | '.' = ','): string {
  // erste Trennstelle behalten, weitere entfernen, Rest auf Ziffern beschränken
  let seenSep = false
  let seenColon = false
  let out = ''
  for (const ch of raw) {
    if (/[0-9]/.test(ch)) {
      out += ch
    } else if (SEP.test(ch) && !seenSep) {
      out += trenner
      seenSep = true
    } else if (ch === ':' && !seenColon && !seenSep && out !== '') {
      out += ':'
      seenColon = true
    }
  }
  return out
}

/**
 * Parst eine Roh-Eingabe in Hundertstelsekunden.
 * Gibt null zurück, wenn nichts Sinnvolles erkennbar ist.
 */
export function parseTime(raw: string): ParsedTime | null {
  const s = raw.trim()
  if (s === '') return null

  // "m:ss" oder "m:ss,hh": so, wie die Uhr es zeigt. Unvollständiges ("1:", "1:75") gilt nicht.
  if (s.includes(':')) {
    const m = /^(\d{1,2}):(\d{1,2})(?:[.,](\d*))?$/.exec(s)
    if (!m || parseInt(m[2], 10) > 59) return null
    return { centis: parseInt(m[1], 10) * 6000 + parseInt(m[2], 10) * 100 + padHundredths(m[3] ?? '') }
  }

  const parts = s.split(SEP)
  const before = parts[0] ?? ''
  const after = parts[1] ?? ''

  // Führender Trenner (",354") → der Teil vor dem Komma ist leer und zählt als 0.
  if (!/^\d*$/.test(before) || !/^\d*$/.test(after)) return null
  if (before === '' && after === '') return null
  const lead = before === '' ? 0 : parseInt(before, 10)

  if (lead >= 20) {
    // Sekunden , Hundertstel  (ss,00)
    const hundredths = padHundredths(after)
    return { centis: lead * 100 + hundredths }
  }

  // Minuten , ss + Hundertstel  (mm,ss00)
  const rest = (after + '0000').slice(0, 4) // ssHH, rechts mit Nullen aufgefüllt
  const ss = parseInt(rest.slice(0, 2), 10)
  const hh = parseInt(rest.slice(2, 4), 10)
  return { centis: lead * 6000 + ss * 100 + hh }
}

/** "6"→60, "67"→67, "5"→50 (Hundertstel, rechts mit Nullen aufgefüllt). */
function padHundredths(after: string): number {
  if (after === '') return 0
  return parseInt((after + '00').slice(0, 2), 10)
}

/** mm:ss,cc - die "Uhrzeit"-Darstellung. */
export function formatClock(centis: number): string {
  const totalSecs = Math.floor(centis / 100)
  const mm = Math.floor(totalSecs / 60)
  const ss = totalSecs % 60
  const cc = centis % 100
  return `${pad2(mm)}:${pad2(ss)},${pad2(cc)}`
}

/** ss,cc - die reine Sekunden-Darstellung. */
export function formatSeconds(centis: number): string {
  const secs = Math.floor(centis / 100)
  const cc = centis % 100
  return `${secs},${pad2(cc)}`
}

/** Eingabe von der Stoppuhr: "1,2345" für 1:23,45. */
export function formatMinutenEingabe(centis: number): string {
  const totalSecs = Math.floor(centis / 100)
  return `${Math.floor(totalSecs / 60)},${pad2(totalSecs % 60)}${pad2(centis % 100)}`
}

/** Anzeige nach Verlassen des Feldes: "mm:ss,00 (ss,00)". */
export function formatTimeDisplay(centis: number): string {
  return `${formatClock(centis)} (${formatSeconds(centis)})`
}

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n)
}
