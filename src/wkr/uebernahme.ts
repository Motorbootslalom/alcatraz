import type { Eingaben, WkrZeile } from '../types'
import { setzeWerte, werteVon, type EingabeZelle } from '../lib/eingaben'
import { disqCodes } from '../lib/scoring'
import { NICHT_GESTARTET } from '../lib/abmeldung'

// Die Kernregel der Übernahme einer Gerätezeile in die Eingaben – rein, ohne Stand, vom Reducer benutzt
// (state/reducer/wkr.ts). Regel (Plan §4, WKR_ANNAHMEN.uebernahmeNurVorher): Steht schon der neue Wert da, geschieht
// nichts; steht dort, was das Gerät erwartet (`vorher`), wird gesetzt; sonst bleibt der Stand und es entsteht ein
// Konflikt (Rückfrage). Gemeinsame Zellen des Stegs (`vereinige`, F16): Disq.-Buchstaben werden vereinigt, Wegfall
// nur über einen Konflikt `entfernt`; Bemerkungen werden mit „; “ angehängt, nie ersetzt.

/** Ein Konflikt einer Zelle: Was das Gerät will (`wert`) und was dort steht (`steht`). */
export interface Konflikt {
  feld: string
  wert: string
  steht: string
  grund: 'zelle' | 'entfernt'
}

/** Trenner der Bemerkungen zweier Teile (Plan §9.4). */
export const BEMERKUNG_TRENNER = '; '

const eindeutig = (xs: readonly string[]) => [...new Set(xs)]

/**
 * Disq.-Buchstaben vereinigen: zu dem, was steht, kommen die Buchstaben, die das Gerät neu setzt (`wert` ohne
 * `vorher`), in der Form von `sanitizeDisq` („A, S“). Will das Gerät Buchstaben entfernen (in `vorher`, nicht in
 * `wert`), die dastehen, bleibt das ein Vorschlag: `entfernt` ist der Wert ohne sie.
 */
export function vereinigeDisq(aktuell: string, wert: string, vorher: string): { wert: string; entfernt: string | null } {
  const steht = disqCodes(aktuell)
  const neu = disqCodes(wert)
  const alt = disqCodes(vorher)
  const dazu = neu.filter((c) => !alt.includes(c))
  const weg = alt.filter((c) => !neu.includes(c) && steht.includes(c))
  const ergebnis = eindeutig([...steht, ...dazu])
  return { wert: ergebnis.join(', '), entfernt: weg.length > 0 ? ergebnis.filter((c) => !weg.includes(c)).join(', ') : null }
}

/**
 * Eine Bemerkung anhängen: Ohne `vorher` kommt der Text mit „; “ hinter das, was steht (steht er schon da, nichts).
 * Mit `vorher` (Korrektur) wird genau dieser Teil ersetzt; ein geleerter Teil ist ein Konflikt `entfernt`; findet sich
 * der Teil nicht, ein Konflikt `zelle`.
 */
export function haengeAn(aktuell: string, wert: string, vorher: string): { wert: string } | { konflikt: 'zelle' | 'entfernt'; wert: string } {
  const teile = aktuell === '' ? [] : aktuell.split(BEMERKUNG_TRENNER)
  if (vorher === '') return { wert: wert === '' || teile.includes(wert) ? aktuell : [...teile, wert].join(BEMERKUNG_TRENNER) }
  const i = teile.indexOf(vorher)
  if (i < 0) return { konflikt: 'zelle', wert }
  if (wert === '') return { konflikt: 'entfernt', wert: teile.filter((_, j) => j !== i).join(BEMERKUNG_TRENNER) }
  return { wert: teile.map((t, j) => (j === i ? wert : t)).join(BEMERKUNG_TRENNER) }
}

/** Steht X „nicht gestartet“ neben anderen Buchstaben? (BZ2: das soll nie still entstehen, 24.11.2026.) */
const xNebenAnderem = (disq: string) => {
  const c = disqCodes(disq)
  return c.includes(NICHT_GESTARTET) && c.length > 1
}

/** Ist das Feld eine Bemerkung (Text, wird angehängt)? Die Kennung ist `bemerkung@<liste>` (config/feld.ts). */
const istBemerkung = (feld: string) => feld.startsWith('bemerkung@')

/**
 * Was in einer gemeinsamen Zelle des Stegs (`vereinige`) steht, wenn der Wunsch des Geräts gilt – nach derselben
 * Regel wie {@link wendeZeileAn}, nur dass ein Wegfall (`entfernt`) mitgilt: Der Bediener hat für das Gerät entschieden.
 * Für Rückfragen `start` (Start nicht gezeigt): So geht der Buchstabe bzw. die Bemerkung des anderen Teils nie still
 * verloren (Prüfbefund 21.11.2026).
 */
export function vereinigt(feld: string, aktuell: string, wert: string, vorher: string): string {
  if (aktuell === wert || aktuell === vorher) return wert
  if (istBemerkung(feld)) {
    const r = haengeAn(aktuell, wert, vorher)
    if (!('konflikt' in r) || r.konflikt === 'entfernt') return r.wert
    // Der korrigierte Teil steht nicht mehr da: den neuen Text anhängen statt etwas zu ersetzen.
    const angehaengt = haengeAn(aktuell, wert, '')
    return 'konflikt' in angehaengt ? aktuell : angehaengt.wert
  }
  const r = vereinigeDisq(aktuell, wert, vorher)
  // X nie neben anderen Buchstaben (24.11.2026, NG6/BZ2): Der Bediener hat für das Gerät entschieden – dann gilt dessen
  // Wert wie bei einer Rückfrage `zelle` (wendeZeileAn), statt X und Buchstaben zu mischen.
  if (xNebenAnderem(r.entfernt ?? r.wert) && !xNebenAnderem(aktuell)) return wert
  return r.entfernt ?? r.wert
}

/**
 * Wendet die Zellen einer Zeile auf die Eingaben an. Zurück kommen die neuen Eingaben (dieselbe Referenz, wenn sich
 * nichts ändert) und die Konflikte; Zellen mit Konflikt bleiben, wie sie stehen. Mit `weitere` (Vorsteg mit „Versuche
 * nacheinander“) steht danach in jedem weiteren Lauf-Schlüssel dasselbe wie im ersten – geprüft wird nur dort.
 * Die Haken setzt der Reducer (nur ohne Konflikt).
 */
export function wendeZeileAn(eingaben: Eingaben, zeile: Pick<WkrZeile, 'lauf' | 'weitere' | 'starter' | 'zellen'>): { eingaben: Eingaben; konflikte: Konflikt[] } {
  const werte = werteVon(eingaben, zeile.lauf, zeile.starter)
  const setzen: EingabeZelle[] = []
  const konflikte: Konflikt[] = []
  const setze = (feld: string, wert: string) => {
    for (const lauf of [zeile.lauf, ...zeile.weitere]) setzen.push({ lauf, starter: zeile.starter, feld, wert })
  }
  for (const { feld, wert, vorher, vereinige } of zeile.zellen) {
    const steht = werte[feld] ?? ''
    if (steht === wert || steht === vorher) {
      setze(feld, wert)
      continue
    }
    if (vereinige && istBemerkung(feld)) {
      const r = haengeAn(steht, wert, vorher)
      if ('konflikt' in r) konflikte.push({ feld, wert: r.wert, steht, grund: r.konflikt })
      else setze(feld, r.wert)
      continue
    }
    if (vereinige) {
      const r = vereinigeDisq(steht, wert, vorher)
      // X „nicht gestartet“ nie still neben anderen Buchstaben (Prüfbefund 24.11.2026, NG6, BZ2): Steht X vom einen
      // Teil und bringt der andere einen Buchstaben (oder umgekehrt), entscheidet der Bediener – Rückfrage `zelle`.
      // „Nicht gestartet“ selbst kommt ohne `vereinige` (wkr/zeile.ts); das hier fängt die Gegenrichtung.
      if (xNebenAnderem(r.wert) && !xNebenAnderem(steht) && r.wert !== steht) {
        konflikte.push({ feld, wert, steht, grund: 'zelle' })
        continue
      }
      setze(feld, r.wert)
      if (r.entfernt !== null) konflikte.push({ feld, wert: r.entfernt, steht: r.wert, grund: 'entfernt' })
      continue
    }
    konflikte.push({ feld, wert, steht, grund: 'zelle' })
  }
  return { eingaben: setzeWerte(eingaben, setzen), konflikte }
}

/**
 * Prüfsumme der Werte einer Zeile über die genannten Felder (FNV-1a, 32 Bit, hex): Beim Abschluss (F7, F8) schickt
 * das Gerät sie je Start mit; passt sie nicht zum Stand, vermerkt der Abschluss den Start als abweichend. Leere
 * Felder zählen wie fehlende; die Reihenfolge der Felder zählt nicht.
 */
export function zeilenPruefsumme(werte: Readonly<Record<string, string>>, felder: readonly string[]): string {
  const text = eindeutig(felder)
    .filter((f) => (werte[f] ?? '') !== '')
    .sort()
    .map((f) => `${f}=${werte[f]}`)
    .join('\n')
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
