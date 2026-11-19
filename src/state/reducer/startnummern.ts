// Startnummern und Reihenfolge im Starter-Reiter: verschieben, sortieren, mischen, vergeben, Art, Dolphin-Präfix, laufende Nummern.

import type { AppState, ClassId, RunningNumberConfig, StartNrMode, Starter } from '../../types'
import { CLASS_IDS } from '../../domain/classes'
import { moveInOrder, redistributeNumbers, sortedByStartNr } from '../../domain/startnumbers'
import { normalisiereBereichsListe, verteileInBereichen, vergibKlasse, type StartNrBereich, type StartNrBereiche } from '../../domain/startnrBereiche'
import { mische, ordneNach, type SortierSpalte } from '../../lib/reihenfolge'
import { canonicalRunningNumbers } from '../../planung/running'
import { startNrRegeln } from '../../config/catalog'

export type StartnummernAenderung =
  | { type: 'SET_RUNNING_NUMBERS'; patch: Partial<RunningNumberConfig> }
  | { type: 'MOVE_STARTER'; id: string; target: 'first' | 'last' | 'up' | 'down' }
  /**
   * Die Starter jeder genannten Klasse neu ordnen – nach einer Spalte des Reiters „Starter“
   * (stabil: gleiche Werte behalten ihre bisherige Reihenfolge) bzw. zufällig aus der `saat`.
   * Jede Klasse für sich, die Reihenfolge der Klassen bleibt; die vorhandenen Startnummern der
   * Klasse werden nur neu verteilt (lib/reihenfolge.ts). Gesperrt, solange die Verzahnung
   * festgeschrieben ist (VERZAHNUNG_ACTIONS; Entscheidung des Nutzers vom 15.11.2026).
   */
  | { type: 'ORDER_STARTERS'; klassen: ClassId[]; nach: SortierSpalte; absteigend: boolean }
  | { type: 'SHUFFLE_STARTERS'; klassen: ClassId[]; saat: number }
  | { type: 'SET_START_NR_MODE'; mode: StartNrMode }
  /** Vergibt alle Startnummern neu – nach der gewählten Art, siehe {@link assignStartNumbers}. */
  | { type: 'ASSIGN_START_NUMBERS' }
  /** Der Buchstabe vor den Startnummern der Klasse Dolphin (E oder D); gilt für neu vergebene Nummern. */
  | { type: 'SET_DOLPHIN_PRAEFIX'; praefix: 'E' | 'D' }
  /**
   * Eigene Startnummern-Bereiche einer Klasse (19.11.2026); `null` = wieder die Vorgabe des
   * Regelwerks, `[]` = bewusst ohne Bereiche. Vorhandene Nummern bleiben, bis neu vergeben wird.
   */
  | { type: 'SET_START_NR_BEREICHE'; klasse: ClassId; bereiche: StartNrBereich[] | null }
  /** Die Startnummern, deren Weste fehlt (19.11.2026), wie auf der Weste geschrieben. */
  | { type: 'SET_FEHLENDE_START_NR'; nummern: string[] }

/** Übernimmt die geänderten Starter aus `updated` (per ID); die Reihenfolge bleibt. */
function replaceById(starters: Starter[], updated: Starter[]): Starter[] {
  const byId = new Map(updated.map((p) => [p.id, p]))
  return starters.map((p) => byId.get(p.id) ?? p)
}

/**
 * Stellt die Starter EINER Klasse in eine neue Reihenfolge (Verschieben, „Sortierung ändern“,
 * „Zufall“): Die vorhandenen Nummern werden neu verteilt, und die Starter rücken im Array auf die
 * Plätze ihrer Klasse in dieser Folge. Das Zweite braucht es für Starter ohne Nummer – klassisch
 * der übliche Fall, bis die Verzahnung die Nummern vergibt: sortedByStartNr, die Verzahnung und
 * der Export ordnen sie in der Folge des Arrays; sonst bliebe die neue Reihenfolge ohne Wirkung
 * (Prüfbefund zu Paket F, 16.11.2026). `vorher` ist die Klasse nach Startnummer; steht `geordnet`
 * schon so, bleibt das Array dasselbe.
 */
function inFolge(state: AppState, starters: Starter[], vorher: readonly Starter[], geordnet: readonly Starter[]): Starter[] {
  if (geordnet.length === 0 || geordnet.every((p, i) => p.id === vorher[i]?.id)) return starters
  const klasse = geordnet[0].klasse
  let neu = redistributeNumbers([...geordnet])
  // Mit Startnummern-Bereichen (19.11.2026) bleiben die Nummern in ihrem Bereich: Die neue Folge gilt
  // nur innerhalb jeder Größengruppe, und das Array folgt den Nummern. Ändert sich so nichts, bleibt der Stand.
  // Fehlt noch jemandem die Nummer, ist nichts vergeben, das zu halten wäre: dann wie bisher.
  const regeln = startNrRegeln(state, klasse)
  if (state.startNrMode === 'klasse' && regeln.bereiche.length > 0 && geordnet.every((p) => p.startNr.trim() !== '')) {
    neu = sortedByStartNr(verteileInBereichen(geordnet, klasse, regeln))
    if (neu.every((p, i) => p.id === vorher[i]?.id && p.startNr === vorher[i]?.startNr)) return starters
  }
  let i = 0
  return starters.map((p) => (p.klasse === klasse ? neu[i++] : p))
}

/**
 * Alle Startnummern frisch vergeben – die einzige Stelle, die das tut; Lücken
 * und importierte Nummern gehen dabei verloren.
 *
 * - klassenbasiert: je Klasse in der aktuellen Reihenfolge – fortlaufend (E01, E02 …, 101,
 *   102 …) oder, wo es Startnummern-Bereiche gibt, aus dem Bereich der Größe jedes Starters;
 *   fehlende Westen werden übersprungen (domain/startnrBereiche.ts vergibKlasse, 19.11.2026).
 * - klassisch: fortlaufend in der Reihenfolge der Verzahnung (Manövrieren oder
 *   Parallel-Slalom), ab dem Startwert und ohne die zu überspringenden Nummern.
 *   Wer in dieser Reihenfolge nicht vorkommt (Klasse auf keinem Parcours),
 *   bleibt ohne Nummer.
 */
export function assignStartNumbers(state: AppState): Starter[] {
  if (state.startNrMode === 'klasse') {
    const renumbered = CLASS_IDS.flatMap((k) =>
      vergibKlasse(sortedByStartNr(state.starters.filter((p) => p.klasse === k)), k, startNrRegeln(state, k)),
    )
    return replaceById(state.starters, renumbered)
  }
  const numbers = canonicalRunningNumbers({ ...state, runningNumbers: { ...state.runningNumbers, enabled: true } })
  return state.starters.map((p) => ({ ...p, startNr: String(numbers?.get(p.id) ?? '') }))
}

export function wendeStartnummernAn(state: AppState, action: StartnummernAenderung): AppState {
  switch (action.type) {
    case 'SET_RUNNING_NUMBERS':
      return { ...state, runningNumbers: { ...state.runningNumbers, ...action.patch } }

    case 'MOVE_STARTER': {
      const target = state.starters.find((p) => p.id === action.id)
      if (!target) return state
      const inClass = sortedByStartNr(state.starters.filter((p) => p.klasse === target.klasse))
      const starters = inFolge(state, state.starters, inClass, moveInOrder(inClass, action.id, action.target))
      return starters === state.starters ? state : { ...state, starters }
    }

    case 'ORDER_STARTERS':
    case 'SHUFFLE_STARTERS': {
      let starters = state.starters
      for (const klasse of new Set(action.klassen)) {
        // Die bisherige Reihenfolge ist die der Startnummern – bei Gleichstand bleibt sie.
        const inClass = sortedByStartNr(state.starters.filter((p) => p.klasse === klasse))
        if (inClass.length < 2) continue
        const geordnet = action.type === 'ORDER_STARTERS' ? ordneNach(inClass, { spalte: action.nach, absteigend: action.absteigend }, state.originMode) : mische(inClass, action.saat + CLASS_IDS.indexOf(klasse))
        starters = inFolge(state, starters, inClass, geordnet)
      }
      return starters === state.starters ? state : { ...state, starters }
    }

    case 'SET_START_NR_MODE':
      // Nur die Art wechselt; die Nummern bleiben, bis sie neu vergeben werden.
      return { ...state, startNrMode: action.mode }

    case 'ASSIGN_START_NUMBERS':
      return { ...state, starters: assignStartNumbers(state) }

    case 'SET_DOLPHIN_PRAEFIX': {
      const dolphinPraefix = action.praefix === 'D' ? 'D' : 'E'
      return dolphinPraefix === state.dolphinPraefix ? state : { ...state, dolphinPraefix }
    }

    case 'SET_START_NR_BEREICHE': {
      if (!CLASS_IDS.includes(action.klasse)) return state
      const { [action.klasse]: _alt, ...andere } = state.startNrBereiche
      const liste = action.bereiche === null ? null : normalisiereBereichsListe(action.bereiche)
      const startNrBereiche: StartNrBereiche = liste === null ? andere : { ...andere, [action.klasse]: liste }
      return JSON.stringify(startNrBereiche) === JSON.stringify(state.startNrBereiche) ? state : { ...state, startNrBereiche }
    }

    case 'SET_FEHLENDE_START_NR': {
      const fehlendeStartNr = normalisiereFehlende(action.nummern)
      return JSON.stringify(fehlendeStartNr) === JSON.stringify(state.fehlendeStartNr) ? state : { ...state, fehlendeStartNr }
    }
  }
}

/** Eigene Startnummern-Bereiche aus einem gelesenen Stand (migrate): nur bekannte Klassen, brauchbare Einträge. */
export function normalisiereStartNrBereiche(roh: unknown): StartNrBereiche {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return {}
  const out: StartNrBereiche = {}
  for (const k of CLASS_IDS) {
    const liste = normalisiereBereichsListe((roh as Record<string, unknown>)[k])
    if (liste) out[k] = liste
  }
  return out
}

/** Fehlende Startnummern: Texte, getrimmt, groß geschrieben, ohne Leere und Doppelte. */
export function normalisiereFehlende(roh: unknown): string[] {
  if (!Array.isArray(roh)) return []
  const out: string[] = []
  for (const x of roh) {
    const s = typeof x === 'string' || typeof x === 'number' ? String(x).trim().toUpperCase() : ''
    if (s && !out.includes(s)) out.push(s)
  }
  return out
}
