/**
 * Ein Datum aus einem Textfeld lesen (Entscheidung des Nutzers vom 15.11.2026): Die Datumswahl
 * des Browsers (`<input type="date">`) zeigt je nach Systemsprache mm/dd/yyyy – „das darf es nie
 * geben“. Die Felder sind deshalb Textfelder mit festem Muster (components/DatumFeld.vue):
 * deutsche Oberfläche TT.MM.JJJJ, englische JJJJ-MM-TT (Entscheidung vom 13.11.2026).
 *
 * Gelesen wird jede dieser Schreibweisen, gleich in welcher Oberfläche – getippt oder eingefügt:
 * - 2019-12-01, auch 2019-12-1
 * - 01.12.2019, 1.12.2019, auch mit Leerzeichen nach dem Punkt
 * - 01/12/2019, 1/12/2019 – mit Schrägstrich IMMER Tag zuerst, nie Monat/Tag
 * Ein Datum, das es nicht gibt (31.02.2019, Monat 13), heißt `ungueltig`, alles andere, was
 * keinem Muster folgt, `unbekannt`. Gespeichert wird JJJJ-MM-TT wie bisher.
 *
 * Rein: kein Date-Objekt, keine Zeitzone – ein Geburtsdatum ist ein Kalendertag.
 */
export type DatumGelesen = { art: 'leer' } | { art: 'ok'; iso: string } | { art: 'ungueltig' } | { art: 'unbekannt' }

const ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})$/
// Tag zuerst, Punkt oder Schrägstrich, beide Trenner gleich.
const TAG_ZUERST = /^(\d{1,2})\s*([./])\s*(\d{1,2})\s*\2\s*(\d{4})$/

const zwei = (n: number) => String(n).padStart(2, '0')

/** Tage im Monat nach dem gregorianischen Kalender (Schaltjahr: durch 4, nicht durch 100, außer durch 400). */
export function tageImMonat(jahr: number, monat: number): number {
  if (monat === 2) return (jahr % 4 === 0 && jahr % 100 !== 0) || jahr % 400 === 0 ? 29 : 28
  return [4, 6, 9, 11].includes(monat) ? 30 : 31
}

/** Gibt es diesen Tag? Dann JJJJ-MM-TT, sonst `null`. */
export function isoDatum(jahr: string, monat: number, tag: number): string | null {
  const j = Number(jahr)
  if (monat < 1 || monat > 12 || tag < 1 || tag > tageImMonat(j, monat)) return null
  return `${jahr}-${zwei(monat)}-${zwei(tag)}`
}

export function liesDatum(text: string): DatumGelesen {
  const s = text.trim()
  if (s === '') return { art: 'leer' }
  const iso = s.match(ISO)
  const tagZuerst = iso ? null : s.match(TAG_ZUERST)
  const teile = iso ? { jahr: iso[1], monat: iso[2], tag: iso[3] } : tagZuerst ? { jahr: tagZuerst[4], monat: tagZuerst[3], tag: tagZuerst[1] } : null
  if (!teile) return { art: 'unbekannt' }
  const ergebnis = isoDatum(teile.jahr, Number(teile.monat), Number(teile.tag))
  return ergebnis ? { art: 'ok', iso: ergebnis } : { art: 'ungueltig' }
}

/**
 * Excel zählt Tage seit dem 31.12.1899 (1 = 1.1.1900) und hält den 29.2.1900 für einen Tag, den
 * es nicht gab – ab Tag 61 (1.3.1900) ist deshalb der 30.12.1899 der Nullpunkt. Für eine
 * Seriennummer aus einer kopierten Zelle, die als Zahl statt als Datum formatiert ist.
 */
export function excelSeriennummer(n: number): string | null {
  if (!Number.isInteger(n) || n < 61 || n > 2958465) return null
  // Rechnen in UTC: ohne Sommerzeit und Ortszeit ist ein Tag immer 86 400 000 ms.
  return new Date(Date.UTC(1899, 11, 30) + n * 86_400_000).toISOString().slice(0, 10)
}
