import type { AppState, PunktId, WkrAbschluss, WkrStand } from '../types'
import { betriebVon, istPunktId, lage, liesRef, punktVonLauf, rundenPunkt } from '../betrieb/folge'
import type { ListenTeil } from '../lib/eingaben'

// Abschlüsse je Liste und Punkt – am Steg je Teil (F16, Prüfbefund 21.11.2026): Schließt das Ablegen ab, erfasst das
// Anlegen weiter, und die digitale Unterschrift (F8) des einen Teils überschreibt nie die des anderen. Gespeichert
// unter dem Punkt (ganze Liste) bzw. `${punkt}|ab` / `${punkt}|an` (types/wkr.ts WkrStand.abschluss). Rein.

export const TEILE: readonly ListenTeil[] = ['ab', 'an']

/** Der Schlüssel eines Abschlusses: Punkt, bzw. Punkt und Teil. */
export function abschlussSchluessel(punkt: PunktId, teil?: ListenTeil): string {
  return teil === undefined ? punkt : `${punkt}|${teil}`
}

/** Punkt und Teil eines Abschluss-Schlüssels; `null`, wenn er unlesbar ist. */
export function liesAbschlussSchluessel(schluessel: string): { punkt: PunktId; teil?: ListenTeil } | null {
  const i = schluessel.indexOf('|')
  const punkt = i < 0 ? schluessel : schluessel.slice(0, i)
  if (!istPunktId(punkt)) return null
  if (i < 0) return { punkt }
  const teil = schluessel.slice(i + 1)
  return teil === 'ab' || teil === 'an' ? { punkt, teil } : null
}

/** Die Abschlüsse einer Liste (leer, wenn keiner da ist). */
function jeListe(wkr: WkrStand, liste: string): Record<string, WkrAbschluss> {
  return Object.hasOwn(wkr.abschluss, liste) ? wkr.abschluss[liste] : {}
}

/** Genau dieser Abschluss (Punkt der ganzen Liste bzw. eines Teils). */
export function abschlussVon(wkr: WkrStand, liste: string, punkt: PunktId, teil?: ListenTeil): WkrAbschluss | undefined {
  const a = jeListe(wkr, liste)
  const k = abschlussSchluessel(punkt, teil)
  return Object.hasOwn(a, k) ? a[k] : undefined
}

/**
 * Ist der Punkt für diesen Teil abgeschlossen? Mit Teil: die ganze Liste oder dieser Teil. Ohne Teil: die ganze Liste
 * oder – bei geteilten Listen (`geteilt`) – beide Teile.
 */
export function istAbgeschlossen(wkr: WkrStand, liste: string, punkt: PunktId, teil: ListenTeil | undefined, geteilt: boolean): boolean {
  if (abschlussVon(wkr, liste, punkt)) return true
  if (teil !== undefined) return !!abschlussVon(wkr, liste, punkt, teil)
  return geteilt && TEILE.every((t) => !!abschlussVon(wkr, liste, punkt, t))
}

/**
 * Wird eine Zeile (Teil oder ganze Zeile) für diesen Punkt Vorschlag, weil abgeschlossen ist? Eine ganze Zeile einer
 * geteilten Liste schon, wenn EIN Teil abgeschlossen ist – sie berührt dessen Spalten.
 */
export function zeileAbgeschlossen(wkr: WkrStand, liste: string, punkt: PunktId, teil: ListenTeil | undefined, geteilt: boolean): boolean {
  if (istAbgeschlossen(wkr, liste, punkt, teil, geteilt)) return true
  return teil === undefined && geteilt && TEILE.some((t) => !!abschlussVon(wkr, liste, punkt, t))
}

/** Die abgeschlossenen Punkte (für diesen Teil bzw. die ganze Liste), sortiert. */
export function abgeschlossenePunkte(wkr: WkrStand, liste: string, teil: ListenTeil | undefined, geteilt: boolean): PunktId[] {
  const punkte = new Set<PunktId>()
  for (const k of Object.keys(jeListe(wkr, liste))) {
    const s = liesAbschlussSchluessel(k)
    if (s && istAbgeschlossen(wkr, liste, s.punkt, teil, geteilt)) punkte.add(s.punkt)
  }
  return [...punkte].sort()
}

/** Alle Abschlüsse einer Liste mit Punkt und Teil (W2: Lage, Bedienung „Abschluss lösen“), nach Schlüssel sortiert. */
export function abschluesseVon(wkr: WkrStand, liste: string): { punkt: PunktId; teil?: ListenTeil; abschluss: WkrAbschluss }[] {
  return Object.entries(jeListe(wkr, liste))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .flatMap(([k, abschluss]) => {
      const s = liesAbschlussSchluessel(k)
      return s ? [{ ...s, abschluss }] : []
    })
}

/** Die Starts (`refKey`), die nach den Abschlüssen dieses Teils (bzw. der ganzen Liste) aufs Papier gingen. */
export function abschlussPapier(wkr: WkrStand, liste: string, teil: ListenTeil | undefined): Set<string> {
  const out = new Set<string>()
  for (const [k, a] of Object.entries(jeListe(wkr, liste))) {
    const s = liesAbschlussSchluessel(k)
    if (s && (s.teil === undefined || s.teil === teil)) for (const key of a.papier) out.add(key)
  }
  return out
}

/** Der Punkt eines Starts (Kennung); `null`, wenn sie unlesbar ist. */
export function punktVonRef(stand: AppState, ref: string): PunktId | null {
  const r = liesRef(ref)
  if (!r) return null
  return r.art === 'm' ? punktVonLauf(stand, r.lauf) : rundenPunkt(r.runde)
}

/**
 * Hat der Punkt im Bereich begonnen (er läuft, oder ein Start dieses Punkts ist gezeigt)? Nur dann nimmt der
 * Bedienrechner einen Abschluss an (Prüfbefund 21.11.2026): Ein Gerät mit veralteter Sicht schlösse sonst einen
 * künftigen Lauf ohne offene Starts ab, und dessen Zeilen würden später still Vorschläge.
 */
export function punktBegonnen(stand: AppState, bereich: string, punkt: PunktId): boolean {
  if (lage(stand, bereich).laufend === punkt) return true
  return betriebVon(stand, bereich).gezeigt.some((g) => punktVonRef(stand, g.ref) === punkt)
}
