import { reducer, type Action } from './state/reducer'
import type { AppState } from './types'

// Hilfen nur für Tests – kein Teil der Anwendung.

/**
 * Das Regelwerk wechseln, auch wenn schon Werte erfasst sind. In der Anwendung ist das gesperrt
 * (state/reducer.ts, SET_REGELWERK); ein solcher Stand entsteht dort nur durch eine geladene
 * Sicherung. Tests, die dieselben Werte unter beiden Regelwerken zeigen, kommen so dorthin: Der
 * Wechsel stellt alles wie SET_REGELWERK, die Werte und ihre Zeitpunkte bleiben.
 */
export function wechsleRegelwerk(store: { state: { value: AppState }; dispatch: (action: Action) => void }, regelwerk: string): void {
  const stand = store.state.value
  const gewechselt = reducer({ ...stand, eingaben: {} }, { type: 'SET_REGELWERK', regelwerk })
  store.dispatch({ type: 'LOAD_STATE', state: { ...gewechselt, eingaben: stand.eingaben, listenStand: stand.listenStand } })
}

/** Der Haken „erfasst“ der Knoten-Liste für die genannten Starter: Unter Regel 960 gibt es die UIM points des Manövrierens erst mit den Knoten. */
export function knotenHaken(ids: readonly string[]): { lauf: string; starter: string; feld: string; wert: string }[] {
  return ids.map((id) => ({ lauf: 'manoevrieren/0', starter: id, feld: 'erfasst@knoten', wert: '1' }))
}
