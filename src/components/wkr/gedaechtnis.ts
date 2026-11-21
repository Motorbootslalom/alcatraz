import { toRaw } from 'vue'
import type { ErfassungsQuelle } from '../../geraete/erfassen'

/**
 * Was die Maske einer Liste über ihr eigenes Leben hinaus behält (Prüfbefund W3, 21.11.2026): Ein Wechsel des Reiters
 * (Freigabe ↔ Liste in GeraetFreigabe, zwei Listen auf dem Pad) baut WkrMaske neu auf – sonst kämen mit „So lassen“
 * weggelegte Bänder und die schon beantwortete Frage zum verwaisten Entwurf wieder. Nur im Arbeitsspeicher, an die
 * Quelle gebunden (eine neue Erfassung bzw. Übung beginnt leer); nie in Ablage oder AppState – reine Bedienung.
 */
export interface MaskenGedaechtnis {
  /** Zeilen (`z`), deren Band mit „So lassen“ weggelegt oder deren Korrektur geschickt ist. */
  erledigt: ReadonlySet<number>
  /** Verwaiste Entwürfe (`${s}|${teil}`), zu denen „behalten“ schon gewählt ist. */
  gefragt: ReadonlySet<string>
}

const ablage = new WeakMap<ErfassungsQuelle, Map<string, MaskenGedaechtnis>>()

/** Das Gedächtnis der Maske dieser Liste – dasselbe Objekt bei jedem Aufbau (Felder ersetzen, nicht ändern). */
export function gedaechtnis(quelle: ErfassungsQuelle, liste: string): MaskenGedaechtnis {
  // toRaw: Dieselbe Quelle kommt mal roh, mal als reaktiver Stellvertreter an.
  const roh = toRaw(quelle)
  let jeListe = ablage.get(roh)
  if (!jeListe) ablage.set(roh, (jeListe = new Map()))
  let g = jeListe.get(liste)
  if (!g) jeListe.set(liste, (g = { erledigt: new Set(), gefragt: new Set() }))
  return g
}

/**
 * „Ausblenden“ des Hinweises „Bildschirm kann ausgehen“ (N7, Feldtest 21.11.2026): nur im Arbeitsspeicher, über den
 * Neuaufbau der Maske (Reiter Freigabe ↔ Liste) hinweg – nach dem Neuladen (am nächsten Tag) ist er wieder da.
 */
export const wachHinweisWeg = { weg: false }
