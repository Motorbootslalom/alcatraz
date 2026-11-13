import { tn } from '../i18n'
import { mergeStarters } from '../import/starterMerge'
import type { AppState, Starter } from '../types'
import { starterMitEingaben } from './eingaben'

// Mit einem Starter gehen seine erfassten Werte (state/reducer.ts `mitStartern`) – ohne
// Rückgängig. Jede Rückfrage vor einem solchen Schritt nennt deshalb, wie viele Starter mit
// schon erfassten Zeiten oder Fehlern betroffen sind.

/** So viele der Starter, die wegfallen sollen, haben schon erfasste Werte. */
export function verlustZahl(stand: Pick<AppState, 'eingaben'>, entfallen: Iterable<Pick<Starter, 'id'>>): number {
  const mit = starterMitEingaben(stand.eingaben)
  return [...entfallen].filter((p) => mit.has(p.id)).length
}

/** Der Zusatz für die Rückfrage; leer, wenn nichts Erfasstes verloren geht. */
export function verlustText(stand: Pick<AppState, 'eingaben'>, entfallen: Iterable<Pick<Starter, 'id'>>): string {
  const n = verlustZahl(stand, entfallen)
  return n > 0 ? tn('entries.loss', n) : ''
}

/**
 * Dasselbe für das Ersetzen der Starterliste: Verloren gehen die Werte derer, die der Import
 * nicht wiedererkennt – auch, wer in der neuen Liste in einer anderen Klasse steht (er gilt
 * als neu, siehe import/starterMerge.ts).
 */
export function verlustBeimErsetzen(stand: Pick<AppState, 'eingaben' | 'starters'>, neu: Starter[]): { zahl: number; text: string } {
  const zahl = verlustZahl(stand, mergeStarters(stand.starters, neu).removed)
  return { zahl, text: zahl > 0 ? tn('entries.lossImport', zahl) : '' }
}
