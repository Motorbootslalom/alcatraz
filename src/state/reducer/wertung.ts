// Wertung: Streichläufe, Fassung der Wertungslisten, „Disziplin nicht werten“, Mannschaftswertung (Pokal) mit Auswahl.

import type { AppState, ClassId, ErgebnisFassung, ErgebnisHerkunft, ErgebnisListenOptionen, ErgebnisNamen, Starter, Streichlaeufe, WertungsDisziplin } from '../../types'
import { setzeNichtWerten, WERTUNGS_DISZIPLINEN } from '../../lib/disziplinen'
import { POKAL_PLATZ_VARIANTEN, istPokalVariante, pokalVorgabe, pokalZahl, punkteListe, type PokalPlatzVariante, type PokalVariante } from '../../config/pokal'
import { hasParallel } from '../../config/catalog'

export type WertungAenderung =
  | { type: 'SET_ERGEBNIS_LISTEN'; fassung: ErgebnisFassung; patch: { namen?: ErgebnisNamen; herkunft?: ErgebnisHerkunft } }
  /** Streichläufe der Gesamtwertung: `auto` (Regel) oder eine feste Zahl. */
  | { type: 'SET_STREICHLAEUFE'; streichlaeufe: Streichlaeufe }
  /** Eine Variante der Pokalauswertung ein- oder ausschalten; im Stand bleibt nur die Abweichung vom Regelwerk. */
  | { type: 'SET_POKAL_VARIANTE'; variante: PokalVariante; an: boolean }
  /** Punkte je Platz einer Variante (Platz 1, 2, 3 …); `null` oder die Vorgabe selbst = wieder die Vorgabe. */
  | { type: 'SET_POKAL_PUNKTE'; variante: PokalPlatzVariante; punkte: number[] | null }
  /** UIM-Variante: Zahl der Besten und Mindestzahl der Starter je Herkunft; `null` = wieder die des Regelwerks. */
  | { type: 'SET_POKAL_UIM'; patch: { beste?: number | null; mindestens?: number | null } }
  /** „Nur ausgewählte Starter zählen“. Die Auswahl selbst bleibt beim Ausschalten stehen. */
  | { type: 'SET_POKAL_NUR_AUSWAHL'; an: boolean }
  /**
   * Auswahl für die Pokalauswertung: die genannten Starter zählen (oder nicht) bzw. ihre
   * Markierung wird umgekehrt. Ändert das Starterfeld nicht und geht deshalb auch, wenn schon
   * Ergebnisse erfasst sind.
   */
  | { type: 'SET_POKAL_ZAEHLT'; ids: readonly string[]; zaehlt: boolean }
  | { type: 'INVERT_POKAL_ZAEHLT'; ids: readonly string[] }
  /**
   * „Disziplin nicht werten“ für die genannten Klassen setzen oder lösen (lib/disziplinen.ts) –
   * die Entscheidung des O.O.D., eine (etwa in einer Klasse abgebrochene) Disziplin nicht in
   * Einzel- und Mannschaftswertung zu zählen. Für „alle Klassen“ nennt die Action alle.
   */
  | { type: 'SET_NICHT_WERTEN'; disziplin: WertungsDisziplin; klassen: readonly ClassId[]; an: boolean }

/** Wertungslisten: Vorgabe wie bisher – volle Namen, Herkunft als Kürzel. */
export const ERGEBNIS_LISTEN_VORGABE: ErgebnisListenOptionen = { aushang: { namen: 'voll', herkunft: 'kurz' }, intern: { herkunft: 'kurz' } }

/** Eine brauchbare Angabe der Streichläufe: `auto` oder eine ganze Zahl von 0 bis 8. */
export function streichlaeufeWert(wert: unknown): Streichlaeufe {
  return typeof wert === 'number' && Number.isFinite(wert) ? Math.max(0, Math.min(8, Math.round(wert))) : 'auto'
}

/** Die Markierung „zählt für die Pokalauswertung“ setzen: Im Stand steht nur `false`. */
function mitPokalZaehlt(p: Starter, zaehlt: boolean): Starter {
  if ((p.pokal !== false) === zaehlt) return p
  const { pokal: _alt, ...rest } = p
  return zaehlt ? rest : { ...rest, pokal: false }
}

export function wendeWertungAn(state: AppState, action: WertungAenderung): AppState {
  switch (action.type) {
    case 'SET_ERGEBNIS_LISTEN': {
      const { aushang, intern } = state.ergebnisListen
      return {
        ...state,
        ergebnisListen:
          action.fassung === 'aushang'
            ? { intern, aushang: { ...aushang, ...action.patch } }
            : { aushang, intern: { herkunft: action.patch.herkunft ?? intern.herkunft } },
      }
    }

    case 'SET_STREICHLAEUFE':
      return { ...state, streichlaeufe: streichlaeufeWert(action.streichlaeufe) }

    case 'SET_POKAL_VARIANTE': {
      if (!istPokalVariante(action.variante)) return state
      const { [action.variante]: _alt, ...rest } = state.pokal.varianten
      // Nur die Abweichung von der Vorgabe des Regelwerks steht im Stand (wie bei den zusätzlichen Listen).
      const vorgabe = pokalVorgabe(state.regelwerk).an.includes(action.variante)
      const varianten = action.an === vorgabe ? rest : { ...rest, [action.variante]: action.an }
      return JSON.stringify(varianten) === JSON.stringify(state.pokal.varianten) ? state : { ...state, pokal: { ...state.pokal, varianten } }
    }

    case 'SET_POKAL_PUNKTE': {
      if (!(POKAL_PLATZ_VARIANTEN as readonly string[]).includes(action.variante)) return state
      const vorgabe = pokalVorgabe(state.regelwerk).punkte[action.variante]
      const { [action.variante]: _alt, ...rest } = state.pokal.punkte
      // Die Zahl der Plätze steht mit der Variante fest: Fehlendes zählt 0, Überzähliges entfällt.
      const neu = action.punkte === null ? vorgabe : vorgabe.map((_, i) => punkteListe(action.punkte)[i] ?? 0)
      const punkte = neu.every((n, i) => n === vorgabe[i]) ? rest : { ...rest, [action.variante]: neu }
      return JSON.stringify(punkte) === JSON.stringify(state.pokal.punkte) ? state : { ...state, pokal: { ...state.pokal, punkte } }
    }

    case 'SET_POKAL_UIM': {
      const vorgabe = pokalVorgabe(state.regelwerk)
      const { beste: _b, mindestens: _m, ...rest } = state.pokal
      const wert = (feld: 'beste' | 'mindestens') => {
        const neu = action.patch[feld] === undefined ? state.pokal[feld] : (pokalZahl(action.patch[feld]) ?? undefined)
        return neu === undefined || neu === vorgabe[feld] ? {} : { [feld]: neu }
      }
      const pokal = { ...rest, ...wert('beste'), ...wert('mindestens') }
      return JSON.stringify(pokal) === JSON.stringify(state.pokal) ? state : { ...state, pokal }
    }

    case 'SET_POKAL_NUR_AUSWAHL':
      return action.an === state.pokal.nurAuswahl ? state : { ...state, pokal: { ...state.pokal, nurAuswahl: action.an } }

    case 'SET_NICHT_WERTEN': {
      // Den Schalter gibt es nur nach Regel 960 (Einzelwertung aus zwei Disziplinen).
      if (!hasParallel(state.regelwerk) || !(WERTUNGS_DISZIPLINEN as readonly string[]).includes(action.disziplin)) return state
      const nichtWerten = setzeNichtWerten(state.nichtWerten, action.disziplin, action.klassen, action.an)
      return nichtWerten === state.nichtWerten ? state : { ...state, nichtWerten }
    }

    case 'SET_POKAL_ZAEHLT':
    case 'INVERT_POKAL_ZAEHLT': {
      const ids = new Set(action.ids)
      const starters = state.starters.map((p) => (ids.has(p.id) ? mitPokalZaehlt(p, action.type === 'SET_POKAL_ZAEHLT' ? action.zaehlt : p.pokal === false) : p))
      return starters.every((p, i) => p === state.starters[i]) ? state : { ...state, starters }
    }
  }
}
