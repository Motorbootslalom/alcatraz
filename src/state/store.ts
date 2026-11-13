import { inject, ref, type InjectionKey, type Ref } from 'vue'
import type { AppState } from '../types'
import { emptyState, reducer, type Action } from './reducer'
import { loadState, saveState, STATE_KEY } from '../persistenz/storage'
import { neueKennung } from '../lib/qr'

export interface Store {
  /** Zustand als Ref – jede Action ersetzt ihn als Ganzes. */
  state: Ref<AppState>
  dispatch: (action: Action) => void
  /**
   * Setzt den Stand ohne Action auf einen früheren zurück. Nur für den Handscanner
   * (lib/scanner.ts): Die ersten Zeichen eines Scans landen als Eingabe im Stand, bevor der
   * Code erkannt ist – sie sollen keine Spur hinterlassen, auch keinen Zeitpunkt auf einer
   * Ergebnisliste.
   */
  stelleHer: (stand: AppState) => void
  /** `false`, sobald ein Stand nicht gespeichert werden konnte. */
  saved: Ref<boolean>
}

export const storeKey: InjectionKey<Store> = Symbol('store')

/**
 * Zentraler Store: reiner Reducer, jede Änderung wird sofort gespeichert.
 *
 * Was der Reducer nicht darf, geschieht hier: Jede Action bekommt ihren Zeitpunkt (daraus
 * wird der Stand der Ergebnislisten), und eine Veranstaltung ohne Kennung für die QR-Codes
 * bekommt eine gewürfelte – beides reist als Teil der Action, sodass dieselbe Action überall
 * zum selben Ergebnis führt.
 *
 * Mehrere Fenster desselben Browsers teilen sich den localStorage. Ändert ein
 * anderes Fenster den Stand, übernimmt dieses ihn (`storage`-Ereignis) – so
 * bleiben etwa Auswertung und Listenansicht auf zwei Bildschirmen gleich.
 */
export function createStore(): Store {
  const state = ref<AppState>(loadState() ?? emptyState())
  const saved = ref(true)

  function dispatch(action: Action) {
    const zeit = action.zeit ?? Date.now()
    // Eine neue Veranstaltung ist eine andere: Sie bekommt gleich ihre eigene Kennung.
    const mitZeit: Action = action.type === 'RESET_ALL' ? { kennung: neueKennung(Math.random), ...action, zeit } : { ...action, zeit }
    let next = reducer(state.value, mitZeit)
    // Geladener Stand aus der Zeit vor den QR-Codes.
    if (!next.kennung) next = reducer(next, { type: 'SET_KENNUNG', kennung: neueKennung(Math.random), zeit })
    if (next === state.value) return
    state.value = next
    saved.value = saveState(next)
  }

  function stelleHer(stand: AppState) {
    if (stand === state.value) return
    state.value = stand
    saved.value = saveState(stand)
  }

  // Auch ohne erste Action: Die Bögen lassen sich sofort drucken und brauchen die Kennung.
  if (!state.value.kennung) dispatch({ type: 'SET_KENNUNG', kennung: neueKennung(Math.random) })

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key !== STATE_KEY) return
      state.value = loadState() ?? emptyState()
    })
  }

  return { state, dispatch, stelleHer, saved }
}

export function useStore(): Store {
  const store = inject(storeKey, null)
  if (!store) throw new Error('useStore() needs a provided store')
  return store
}
