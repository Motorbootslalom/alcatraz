// Veranstaltung: leerer Stand (emptyState), Name, Jahr, Läufe, Art, Herkunft, Kennung; Stand laden und zurücksetzen.

import type { AppState, EventKind, OriginMode } from '../../types'
import { SCHEMA_VERSION } from '../../types'
import { POKAL_LEER } from '../../config/pokal'
import { DEFAULT_AUFBAU, DEFAULT_BESCHRIFTUNG, DEFAULT_REGELWERK, regelwerkOf } from '../../config/catalog'
import { istKennung } from '../../lib/qr'
import { WKR_LEERZEILEN_CLUB, WKR_LEERZEILEN_SEITE_VORGABE, WKR_LEERZEILEN_VORGABE } from './listen'
import { ERGEBNIS_LISTEN_VORGABE } from './wertung'

export type VeranstaltungAenderung =
  | { type: 'SET_EVENT'; patch: Partial<Pick<AppState, 'eventName' | 'eventJahr' | 'laufCount'>> }
  | { type: 'SET_EVENT_KIND'; eventKind: EventKind }
  | { type: 'SET_ORIGIN_MODE'; originMode: OriginMode }
  | { type: 'LOAD_STATE'; state: AppState }
  /** `kennung`: die Kennung der neuen Veranstaltung (lib/qr.ts) – eine andere als bisher. */
  | { type: 'RESET_ALL'; kennung?: string }
  /**
   * Der Veranstaltung ihre Kennung für die QR-Codes geben. Wirkt nur, solange sie keine hat:
   * Gedruckte Bögen tragen die Kennung, sie darf sich danach nicht mehr ändern.
   */
  | { type: 'SET_KENNUNG'; kennung: string }

/** Zustand einer frisch angelegten Veranstaltung. */
export function emptyState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    eventName: '',
    eventJahr: 2026,
    eventKind: 'meisterschaft',
    startNrMode: 'klasse',
    regelwerk: DEFAULT_REGELWERK,
    aufbau: DEFAULT_AUFBAU,
    eigeneAufbauten: [],
    laufCount: 3,
    versucheNacheinander: regelwerkOf(DEFAULT_REGELWERK).versucheNacheinander === true,
    einteilung: {},
    boote: {},
    coPiloten: {},
    wkrLeerzeilen: WKR_LEERZEILEN_VORGABE,
    wkrLeerzeilenKlasse: {},
    wkrLeerzeilenSeite: WKR_LEERZEILEN_SEITE_VORGABE,
    wkrRueckseite: false,
    eingaben: {},
    abgemeldet: [],
    abgemeldetBis: {},
    streichlaeufe: 'auto',
    wkrClubGemeinsam: true,
    ergebnisListen: ERGEBNIS_LISTEN_VORGABE,
    kennung: '',
    listenStand: {},
    beispielStarter: false,
    wkrZeilenJeSeite: 0,
    wkrTeilenAb: 0,
    beschriftung: DEFAULT_BESCHRIFTUNG,
    wkrSprachen: {},
    tor5MitParcours: false,
    zusatzListen: {},
    laufzettelLayout: 'seite',
    pokal: POKAL_LEER,
    nichtWerten: {},
    dolphinPraefix: 'E',
    parallelZebra: true,
    sollgewicht: {},
    verzahnungLocked: false,
    showBirthdate: true,
    listOrigin: 'lang',
    originShort: {},
    originMode: 'verein',
    starters: [],
    parcoursList: [
      { id: 'par_1', name: 'Parcours 1', classIds: ['E', '1', '2', '3'], wechselFaktor: 2 },
      { id: 'par_2', name: 'Parcours 2', classIds: ['4', '5', '6', '7'], wechselFaktor: 2 },
    ],
    boats: { klein: 2, gross: 2 },
    class4Small: false,
    parallelOrderByStartNr: false,
    parallelStreng: true,
    parallelPlaene: {},
    runningNumbers: { enabled: false, source: 'manoever', start: 1, skipText: '' },
  }
}

export function wendeVeranstaltungAn(state: AppState, action: VeranstaltungAenderung): AppState {
  switch (action.type) {
    case 'SET_EVENT': {
      const next = { ...state, ...action.patch }
      next.laufCount = Math.max(1, Math.min(9, Math.round(next.laufCount) || 1))
      return next
    }

    case 'SET_EVENT_KIND': {
      if (action.eventKind === state.eventKind) return state
      // Eine Clubmeisterschaft zeigt keine Herkunft; beim Wechsel zurück gilt
      // wieder der Verein, bis etwas anderes gewählt wird.
      // Bei der Clubmeisterschaft zählt das Papier: gemeinsame Bögen (Vorgabe) und nur eine
      // Leerzeile je Klasse. Wer die Zahl schon selbst gewählt hat, behält sie.
      const club = action.eventKind === 'club'
      const [von, nach] = club ? [WKR_LEERZEILEN_VORGABE, WKR_LEERZEILEN_CLUB] : [WKR_LEERZEILEN_CLUB, WKR_LEERZEILEN_VORGABE]
      return {
        ...state,
        eventKind: action.eventKind,
        wkrLeerzeilen: state.wkrLeerzeilen === von ? nach : state.wkrLeerzeilen,
        originMode:
          action.eventKind === 'club' ? 'none' : state.originMode === 'none' ? 'verein' : state.originMode,
      }
    }

    case 'SET_ORIGIN_MODE':
      return { ...state, originMode: action.originMode }

    case 'LOAD_STATE':
      return action.state

    case 'RESET_ALL':
      return { ...emptyState(), kennung: istKennung(action.kennung) ? action.kennung : '' }

    case 'SET_KENNUNG':
      return state.kennung || !istKennung(action.kennung) ? state : { ...state, kennung: action.kennung }
  }
}
