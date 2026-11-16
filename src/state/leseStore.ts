import { inject, shallowRef, type InjectionKey, type ShallowRef } from 'vue'
import type { AppState } from '../types'
import { emptyState } from './reducer'
import { standAus, STATE_KEY } from '../persistenz/storage'

/**
 * Nur-Lese-Store für ein Fenster, das den Stand nur zeigt – die Anzeigetafel am zweiten Bildschirm
 * (`#/anzeige`, Plan vom 16.11.2026). Er liest den Stand aus dem localStorage und folgt dem
 * `storage`-Ereignis, wenn ein anderes Fenster desselben Browsers speichert.
 *
 * Er schreibt NIE: kein dispatch, keine Kennung (der volle Store vergäbe beim Start eine per
 * SET_KENNUNG und speicherte), kein zweiter Speicher (state/zweit.ts schriebe beim Start), keine
 * Speichermarke. So gibt es neben dem Bedienfenster keinen zweiten Schreiber, und ein Tafel-Fenster
 * kann nie einen Stand überschreiben – auch nicht mit einem älteren oder leeren.
 *
 * Der Stand liegt in einer `shallowRef`: Er wird nur gelesen und als Ganzes ersetzt; tiefe Hüllen
 * kosteten bei jedem Ereignis nur Zeit. Ob sich für die Anzeige etwas geändert hat, entscheidet
 * der Bildschirm nach Inhalt (betrieb/sicht.ts).
 */
export interface LeseStore {
  /** Der zuletzt gelesene Stand; ohne gespeicherten (oder bei unlesbarem) der leere. */
  readonly state: Readonly<ShallowRef<AppState>>
  /**
   * Den localStorage jetzt lesen. Von selbst beim Anlegen und bei jedem `storage`-Ereignis; von
   * außen etwa auf eine Nachricht des öffnenden Fensters (`postMessage`), wo das Ereignis nicht
   * trägt (manche Browser unter file://). Unveränderter Text ⇒ derselbe Stand.
   */
  lies: () => void
  /** Hört nicht mehr auf andere Fenster (Tests mit mehreren Stores). */
  beende: () => void
}

export const leseStoreKey: InjectionKey<LeseStore> = Symbol('leseStore')

export function createLeseStore(): LeseStore {
  const state = shallowRef<AppState>(emptyState())
  // Zuletzt gelesener Text: Ein Ereignis ohne neuen Inhalt legt keinen neuen Stand an.
  let text: string | null | undefined

  function lies() {
    let json: string | null = null
    try {
      json = localStorage.getItem(STATE_KEY)
    } catch {
      // Gesperrter Speicher: wie leer.
    }
    if (json === text) return
    text = json
    state.value = standAus(json) ?? emptyState()
  }
  lies()

  const lauscher = new AbortController()
  if (typeof window !== 'undefined') {
    // `key === null`: Ein anderes Fenster hat den ganzen Speicher geleert.
    window.addEventListener(
      'storage',
      (event) => {
        if (event.key === STATE_KEY || event.key === null) lies()
      },
      { signal: lauscher.signal },
    )
  }

  return { state, lies, beende: () => lauscher.abort() }
}

export function useLeseStore(): LeseStore {
  const store = inject(leseStoreKey, null)
  if (!store) throw new Error('useLeseStore() needs a provided leseStore')
  return store
}
