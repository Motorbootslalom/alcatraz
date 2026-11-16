// Parallelslalom: Schalter des Startplans (Reihenfolge, strenge Klassentrennung) und Runden festschreiben bzw. lösen.

import type { AppState, ClassId, ParallelRunde } from '../../types'
import { mitAbmeldungenInRunden } from '../../lib/abmeldung'
import { loeseRunde, schreibeRundeFest } from '../../lib/parallelStage'
import { hasParallel } from '../../config/catalog'
import { konfigVon } from './gemeinsam'

export type ParallelAenderung =
  | { type: 'SET_PARALLEL_ORDER_BY_STARTNR'; value: boolean }
  /** Parallelslalom: strenge Klassentrennung (Regel 960, Pkt. 4.4) an oder aus. */
  | { type: 'SET_PARALLEL_STRENG'; value: boolean }
  /**
   * Parallelslalom: die nächste Runde einer Klasse (Halbfinale, Finals, Wiederholung)
   * festschreiben bzw. die letzte wieder lösen (lib/parallelStage.ts). Wer fährt, rechnet der
   * Reducer aus dem Stand – die Action nennt nur Klasse und Runde und wirkt nicht, wenn diese
   * Runde für die Klasse gerade nicht ansteht. Beim Lösen gehen die Werte der Klasse in der Runde.
   */
  | { type: 'PARALLEL_RUNDE_FESTSCHREIBEN'; klasse: ClassId; runde: ParallelRunde }
  | { type: 'PARALLEL_RUNDE_LOESEN'; klasse: ClassId; runde: ParallelRunde }

export function wendeParallelAn(state: AppState, action: ParallelAenderung): AppState {
  switch (action.type) {
    case 'SET_PARALLEL_ORDER_BY_STARTNR':
      return { ...state, parallelOrderByStartNr: action.value }

    case 'SET_PARALLEL_STRENG':
      return action.value === state.parallelStreng ? state : { ...state, parallelStreng: action.value }

    case 'PARALLEL_RUNDE_FESTSCHREIBEN': {
      const konfig = konfigVon(state)
      const parallelPlaene = hasParallel(state.regelwerk) ? schreibeRundeFest(state, konfig, action.klasse, action.runde) : null
      if (!parallelPlaene) return state
      // Wer abgemeldet ist und trotzdem in der Runde steht, bekommt dort gleich sein X – nur in
      // der Klasse, die festgeschrieben wird: Ein X, das in einer anderen Klasse derselben Runde
      // von Hand entfernt wurde (er fährt doch), bleibt entfernt.
      return mitAbmeldungenInRunden({ ...state, parallelPlaene }, konfig, [action.runde], action.klasse)
    }

    case 'PARALLEL_RUNDE_LOESEN': {
      const geloest = loeseRunde(state, konfigVon(state), action.klasse, action.runde)
      return geloest ? { ...state, ...geloest } : state
    }
  }
}
