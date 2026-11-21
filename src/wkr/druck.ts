import type { Konfig } from '../config/konfig'
import type { WkrStand } from '../types'
import type { WkrBogen } from '../lib/wkrListen'
import { TEILE } from './abschluss'
import { WKR_ANNAHMEN } from './annahmen'
import { listenKennung, listeVonBogen, teileVon, type ListenTeil } from './liste'

// Druck nach Modus (Nutzer 21.11.2026: „Warum werden Listen gedruckt, wenn ich beim Betrieb nur Gerät ausgewählt habe
// und nicht beides? Das müsste bitte noch gefiltert werden.“): Welche WKR-Bögen NICHT aufs Papier müssen, weil ihre
// Liste nur digital erfasst wird. Rein, ohne DOM und Store, nichts aus geraete/ – welche Steg-Teile gekoppelte Geräte
// abdecken, gibt der Aufrufer als Funktion herein (am Bedienrechner aus dem Register, geraete/register.ts
// abgedeckteTeile). Auslegungen: WKR_ANNAHMEN Z1–Z7.

/** Welche Teile einer geteilten Liste (Steg) gekoppelte Geräte abdecken; `null` = unbekannt (kein Raum, kein Register). */
export type TeilAbdeckung = (kennung: string) => ReadonlySet<ListenTeil> | null

/**
 * Wird dieser Bogen nur digital erfasst (und deshalb nicht gedruckt)? Nur, wenn seine Liste den Modus `digital` hat
 * (Z1; `papier`, `beides` und eine Liste ohne Eintrag = Papier werden gedruckt), sie gerade erfasst (Z2: pausiert oder
 * abgemeldet → Papier übernimmt) und – am Steg – beide Teile digital sind (Z3): Ist ein Teil pausiert/abgemeldet oder
 * deckt das Register nur einen Teil ab („nur Ablegen auf dem Handy“), braucht das Anlegen den Bogen. Bögen ohne Liste
 * der WKR-Erfassung (Knoten, W5) sind nie nur digital (Z6).
 */
export function nurDigital(bogen: Pick<WkrBogen, 'parcoursId' | 'typeId' | 'runde'>, wkr: WkrStand | undefined, konfig: Konfig, abdeckung?: TeilAbdeckung): boolean {
  if (!WKR_ANNAHMEN.druckOhneDigital || !wkr) return false
  const liste = listeVonBogen(bogen, konfig)
  if (!liste) return false
  const kennung = listenKennung(liste)
  const eintrag = wkr.listen[kennung]
  if (!eintrag || eintrag.modus !== 'digital') return false
  if (eintrag.status !== 'aktiv') return false
  if (!teileVon(liste.typeId)) return true
  if (TEILE.some((t) => (eintrag.teile?.[t]?.status ?? 'aktiv') !== 'aktiv')) return false
  const teile = abdeckung?.(kennung) ?? null
  // Ohne gekoppeltes Gerät (oder ohne Register) zählt der Modus, den der Bediener gesetzt hat.
  if (teile && teile.size > 0 && TEILE.some((t) => !teile.has(t))) return false
  return true
}

/** Die Bögen nach Druck geteilt – beide in der Folge von `boegen`. */
export function teileNachDruck<B extends Pick<WkrBogen, 'parcoursId' | 'typeId' | 'runde'>>(
  boegen: readonly B[],
  wkr: WkrStand | undefined,
  konfig: Konfig,
  abdeckung?: TeilAbdeckung,
): { gedruckt: B[]; digital: B[] } {
  const gedruckt: B[] = []
  const digital: B[] = []
  for (const b of boegen) (nurDigital(b, wkr, konfig, abdeckung) ? digital : gedruckt).push(b)
  return { gedruckt, digital }
}
