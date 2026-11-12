import { inject, ref, type InjectionKey, type Ref } from 'vue'
import type { AppState } from '../types'
import { emptyState, reducer, type Action } from './reducer'
import { loadState, saveState, STATE_KEY } from '../persistenz/storage'

export interface Store {
  /** Zustand als Ref – jede Action ersetzt ihn als Ganzes. */
  state: Ref<AppState>
  dispatch: (action: Action) => void
  /** `false`, sobald ein Stand nicht gespeichert werden konnte. */
  saved: Ref<boolean>
}

export const storeKey: InjectionKey<Store> = Symbol('store')

/**
 * Zentraler Store: reiner Reducer, jede Änderung wird sofort gespeichert.
 *
 * Mehrere Fenster desselben Browsers teilen sich den localStorage. Ändert ein
 * anderes Fenster den Stand, übernimmt dieses ihn (`storage`-Ereignis) – so
 * bleiben etwa Auswertung und Listenansicht auf zwei Bildschirmen gleich.
 */
export function createStore(): Store {
  const state = ref<AppState>(loadState() ?? emptyState())
  const saved = ref(true)

  function dispatch(action: Action) {
    const next = reducer(state.value, action)
    if (next === state.value) return
    state.value = next
    saved.value = saveState(next)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key !== STATE_KEY) return
      state.value = loadState() ?? emptyState()
    })
  }

  return { state, dispatch, saved }
}

export function useStore(): Store {
  const store = inject(storeKey, null)
  if (!store) throw new Error('useStore() needs a provided store')
  return store
}
