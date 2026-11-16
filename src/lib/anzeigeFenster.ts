import { watch } from 'vue'
import type { BereichId } from '../types'
import { vollbildAdresse } from './router'

/**
 * Das Fenster der Anzeigetafel (`#/anzeige`, src/AnzeigeApp.vue) und das Bedienfenster, das es öffnet.
 *
 * Die Anzeigetafel liest den Stand aus dem localStorage und folgt dem `storage`-Ereignis
 * (state/leseStore.ts). Ob dieses Ereignis unter file:// (dist-single) zwischen zwei Fenstern trägt, hängt
 * vom Browser ab (Plan vom 16.11.2026, Abnahme E1). Rückfall: Das Bedienfenster stößt jede von ihm
 * geöffnete oder bei ihm gemeldete Anzeigetafel per `postMessage` an, und die liest dann selbst nach.
 *
 * Die Nachricht trägt keine Daten – nur „lies nach“. Deshalb genügt `'*'` als Ziel (unter file:// ist der
 * Ursprung „null“ und ließe sich gar nicht nennen), und ein fremder Absender könnte höchstens ein
 * überflüssiges Nachlesen auslösen; die Anzeigetafel nimmt sie trotzdem nur von ihrem `opener` an.
 */

/** Bedienfenster → Anzeigetafel: „Der Stand hat sich geändert.“ */
const STAND = 'alcatraz-stand'
/** Anzeigetafel → Bedienfenster: „Hier bin ich“ – damit auch ein neu geladenes Bedienfenster sie wieder kennt. */
const DA = 'alcatraz-anzeige-da'
/** So oft meldet sich die Anzeigetafel bei ihrem `opener` (ms): Nach dessen Neuladen kennt er sie sonst nicht mehr. */
export const MELDEN_MS = 10_000

const art = (data: unknown): unknown => (data && typeof data === 'object' ? (data as { alcatraz?: unknown }).alcatraz : undefined)

// --- Bedienfenster ------------------------------------------------------------------------------

const anzeigen = new Set<Window>()

/** Der Fenstername einer Anzeigetafel: Ein zweites „Öffnen“ holt dasselbe Fenster nach vorn, statt ein neues aufzumachen. */
export function anzeigeFensterName(bereich?: BereichId): string {
  return bereich ? `alcatraz-anzeige-${bereich}` : 'alcatraz-anzeige'
}

/** Die volle Adresse der Anzeigetafel (dieselbe Datei bzw. Seite, nur mit `#/anzeige[/<bereich>]`). */
export function anzeigeUrl(bereich?: BereichId): string {
  return `${location.href.split('#')[0]}${vollbildAdresse({ art: 'anzeige', ...(bereich ? { bereich } : {}) })}`
}

/** Öffnet die Anzeigetafel (gemeinsam oder nur für einen Bereich) in einem eigenen Fenster und merkt es sich. */
export function oeffneAnzeige(bereich?: BereichId): void {
  const w = window.open(anzeigeUrl(bereich), anzeigeFensterName(bereich))
  if (w) anzeigen.add(w)
}

/** Stößt alle bekannten Anzeigetafeln an, nachzulesen; geschlossene vergisst es. */
export function stoesseAnzeigenAn(): void {
  for (const w of anzeigen) {
    try {
      if (w.closed) anzeigen.delete(w)
      else w.postMessage({ alcatraz: STAND }, '*')
    } catch {
      anzeigen.delete(w)
    }
  }
}

/**
 * Im Bedienfenster (src/main.ts): nach jeder Änderung des Stands die Anzeigetafeln anstoßen. Der Watch
 * läuft nach dem dispatch (nicht `sync`) – dann steht der neue Stand schon im localStorage. Meldet sich
 * eine Anzeigetafel, wird sie ab jetzt mit angestoßen. Rückgabe: aufhören (Tests).
 */
export function verbindeAnzeigen(stand: () => unknown): () => void {
  const hoere = (e: MessageEvent) => {
    if (art(e.data) === DA && e.source && 'postMessage' in e.source) anzeigen.add(e.source as Window)
  }
  window.addEventListener('message', hoere)
  const ende = watch(stand, stoesseAnzeigenAn)
  return () => {
    window.removeEventListener('message', hoere)
    ende()
    anzeigen.clear()
  }
}

// --- Anzeigetafel -------------------------------------------------------------------------------

/**
 * In der Anzeigetafel (src/AnzeigeApp.vue): bei „lies nach“ vom `opener` `lies()` rufen und sich bei ihm
 * melden – gleich und alle {@link MELDEN_MS}. Ohne `opener` (von Hand geöffnet) gilt allein das
 * `storage`-Ereignis. Rückgabe: aufhören.
 */
export function folgeBedienfenster(lies: () => void): () => void {
  const hoere = (e: MessageEvent) => {
    if (e.source !== null && e.source === window.opener && art(e.data) === STAND) lies()
  }
  const melde = () => {
    try {
      const opener: Window | null = window.opener
      opener?.postMessage({ alcatraz: DA }, '*')
    } catch {
      // Das Bedienfenster ist geschlossen oder gehört zu einem anderen Ursprung: Es bleibt beim storage-Ereignis.
    }
  }
  window.addEventListener('message', hoere)
  melde()
  const takt = setInterval(melde, MELDEN_MS)
  return () => {
    window.removeEventListener('message', hoere)
    clearInterval(takt)
  }
}
