import type {
  AppState,
  BoatConfig,
  ClassId,
  EventKind,
  OriginMode,
  Parcours,
  StartNrMode,
  RunningNumberConfig,
  Starter,
  TrackItem,
  WechselFaktor,
} from '../types'
import type { RawAufbau } from '../config/schema'
import { SCHEMA_VERSION } from '../types'
import { CLASS_IDS } from '../domain/classes'
import {
  moveInOrder,
  orderBySize,
  redistributeNumbers,
  renumberSequential,
  sortedByStartNr,
} from '../domain/startnumbers'
import { mergeStarters } from '../import/starterMerge'
import { haengeUm, ohneParcours, setzeName } from '../lib/einteilung'
import { canonicalRunningNumbers } from '../planung/running'
import { aufbauOf, DEFAULT_AUFBAU, DEFAULT_REGELWERK, hasParallel, regelwerkOf } from '../config/catalog'

/**
 * Alle Änderungen am Zustand laufen als Action durch diesen Reducer.
 *
 * Der Reducer ist **rein und deterministisch**: Er würfelt nicht und fragt keine
 * Uhr. IDs und Zufallsdaten bringt die Action mit. Nur so lässt sich dieselbe
 * Action später auf mehreren Geräten anwenden (Mehr-Browser-Betrieb über ntfy)
 * und kommt überall zum selben Ergebnis.
 */
export type Action =
  | { type: 'SET_EVENT'; patch: Partial<Pick<AppState, 'eventName' | 'eventJahr' | 'laufCount'>> }
  | { type: 'SET_EVENT_KIND'; eventKind: EventKind }
  | { type: 'SET_REGELWERK'; regelwerk: string }
  | { type: 'SET_AUFBAU'; aufbau: string }
  /**
   * Die eigenen Aufbauten als Ganzes ersetzen (anlegen, ändern, löschen, einspielen). Die
   * Action bringt die fertige, geprüfte Liste mit; mit `aufbau` wird zugleich dorthin
   * gewechselt. Gibt es den gewählten Aufbau danach nicht mehr, gilt wieder die Vorgabe.
   */
  | { type: 'SET_EIGENE_AUFBAUTEN'; aufbauten: RawAufbau[]; aufbau?: string }
  /** Gewicht aus der Verwiegung; `null` heißt „noch nicht gewogen“. */
  | { type: 'SET_WEIGHT'; id: string; gewicht: number | null }
  /** Eigenes Standardgewicht setzen; `null` oder der Wert des Regelwerks entfernt den Eintrag. */
  | { type: 'SET_SOLLGEWICHT'; klasse: ClassId; kg: number | null }
  | { type: 'RESET_SOLLGEWICHT' }
  /**
   * Verzahnung festschreiben oder freigeben. Beim Festschreiben bringt die
   * Action die gerade gezeigten Spuren mit; sie werden als feste Anordnung
   * übernommen, damit ein später nachgemeldeter Starter die Verteilung der
   * Klassen nicht mehr verschiebt.
   */
  | { type: 'SET_VERZAHNUNG_LOCK'; locked: boolean; tracks?: Record<string, TrackItem[][]> }
  | { type: 'SET_LIST_OPTIONS'; patch: Partial<Pick<AppState, 'showBirthdate' | 'listOrigin'>> }
  /** Eigenes Kürzel zu einem Namen setzen; ein leeres Kürzel entfernt den Eintrag (dann gilt wieder die Vorgabe). */
  | { type: 'SET_ORIGIN_SHORT'; name: string; short: string }
  | { type: 'SET_ORIGIN_MODE'; originMode: OriginMode }
  | { type: 'SET_BOATS'; boats: BoatConfig }
  | { type: 'SET_CLASS4_SMALL'; class4Small: boolean }
  | { type: 'SET_PARALLEL_INTERNATIONAL'; parallelInternational: boolean }
  | { type: 'SET_PARALLEL_ORDER_BY_STARTNR'; value: boolean }
  | { type: 'SET_RUNNING_NUMBERS'; patch: Partial<RunningNumberConfig> }
  /**
   * `replace`: Die Liste gilt danach als Ganzes; wiedererkannte Starter behalten
   * ihre ID (Startlisten und Ergebnisse verweisen darauf). `merge`: Nur neue
   * Starter kommen hinzu, Dubletten (Klasse + Name) werden übergangen.
   */
  | { type: 'IMPORT_STARTERS'; starters: Starter[]; mode: 'replace' | 'merge' }
  | { type: 'ADD_STARTERS'; starters: Starter[] }
  | { type: 'UPDATE_STARTER'; id: string; patch: Partial<Omit<Starter, 'id'>> }
  | { type: 'MOVE_STARTER'; id: string; target: 'first' | 'last' | 'up' | 'down' }
  | { type: 'ORDER_CLASS_BY_SIZE'; klasse: ClassId }
  | { type: 'SET_START_NR_MODE'; mode: StartNrMode }
  /** Vergibt alle Startnummern neu – nach der gewählten Art, siehe {@link assignStartNumbers}. */
  | { type: 'ASSIGN_START_NUMBERS' }
  | { type: 'REMOVE_STARTER'; id: string }
  | { type: 'CLEAR_CLASS'; klasse: ClassId }
  | { type: 'CLEAR_ALL_STARTERS' }
  | { type: 'ADD_PARCOURS'; id: string }
  | { type: 'SET_PARCOURS_PRESET'; parcours: { id: string; classIds: ClassId[] }[]; wechselFaktor?: WechselFaktor }
  | { type: 'REMOVE_PARCOURS'; id: string }
  | { type: 'RENAME_PARCOURS'; id: string; name: string }
  | { type: 'SET_PARCOURS_CLASSES'; id: string; classIds: ClassId[] }
  | { type: 'SET_PARCOURS_FACTOR'; id: string; wechselFaktor: WechselFaktor }
  | { type: 'SET_PARCOURS_TRACKS'; id: string; tracks: TrackItem[][] }
  | { type: 'RESET_TRACKS'; id: string }
  /**
   * Name des Wettkampfrichters an einer Liste auf einem Parcours; ein leerer Name entfernt
   * den Eintrag. Je Feld eine Action (nicht die ganze Einteilung), damit zwei Geräte, die
   * verschiedene Felder ausfüllen, einander nichts überschreiben.
   */
  | { type: 'SET_WKR_NAME'; parcoursId: string; typeId: string; name: string }
  /**
   * Leerzeilen der Wettkampfrichter-Listen: allgemein (`klasse` fehlt) oder für eine Klasse;
   * `null` = wieder die allgemeine Zahl bzw. die Vorgabe. `alleKlassen` verwirft dabei die
   * abweichenden Zahlen einzelner Klassen.
   */
  | { type: 'SET_WKR_LEERZEILEN'; klasse?: ClassId; anzahl: number | null; alleKlassen?: boolean }
  | { type: 'SET_WKR_RUECKSEITE'; rueckseite: boolean }
  | { type: 'LOAD_STATE'; state: AppState }
  | { type: 'RESET_ALL' }

/** Leerzeilen je Klasse auf den Wettkampfrichter-Listen: Vorgabe wie im Prototyp (`emptyRows: 3`). */
export const WKR_LEERZEILEN_VORGABE = 3
export const WKR_LEERZEILEN_MAX = 30

/** Eine brauchbare Zahl von Leerzeilen (0 bis 30, ganz); sonst `undefined`. */
export function leerzeilenZahl(n: unknown): number | undefined {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(WKR_LEERZEILEN_MAX, Math.round(n))) : undefined
}

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
    einteilung: {},
    wkrLeerzeilen: WKR_LEERZEILEN_VORGABE,
    wkrLeerzeilenKlasse: {},
    wkrRueckseite: false,
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
    parallelInternational: true,
    parallelOrderByStartNr: false,
    runningNumbers: { enabled: false, source: 'manoever', start: 1, skipText: '' },
  }
}

/** Schlüssel zur Dubletten-Erkennung beim Ergänzen (Klasse + Name). */
function dupKey(p: Starter): string {
  return `${p.klasse}|${p.nachname.trim().toLowerCase()}|${p.vorname.trim().toLowerCase()}`
}

/** Übernimmt die geänderten Starter aus `updated` (per ID); die Reihenfolge bleibt. */
function replaceById(starters: Starter[], updated: Starter[]): Starter[] {
  const byId = new Map(updated.map((p) => [p.id, p]))
  return starters.map((p) => byId.get(p.id) ?? p)
}

function mapParcours(state: AppState, id: string, fn: (p: Parcours) => Parcours): AppState {
  return { ...state, parcoursList: state.parcoursList.map((p) => (p.id === id ? fn(p) : p)) }
}

/**
 * Alle Startnummern frisch vergeben – die einzige Stelle, die das tut; Lücken
 * und importierte Nummern gehen dabei verloren.
 *
 * - klassenbasiert: je Klasse fortlaufend (E01, E02 …, 101, 102 …) in der
 *   aktuellen Reihenfolge.
 * - klassisch: fortlaufend in der Reihenfolge der Verzahnung (Manövrieren oder
 *   Parallel-Slalom), ab dem Startwert und ohne die zu überspringenden Nummern.
 *   Wer in dieser Reihenfolge nicht vorkommt (Klasse auf keinem Parcours),
 *   bleibt ohne Nummer.
 */
export function assignStartNumbers(state: AppState): Starter[] {
  if (state.startNrMode === 'klasse') {
    const renumbered = CLASS_IDS.flatMap((k) =>
      renumberSequential(sortedByStartNr(state.starters.filter((p) => p.klasse === k))),
    )
    return replaceById(state.starters, renumbered)
  }
  const numbers = canonicalRunningNumbers({ ...state, runningNumbers: { ...state.runningNumbers, enabled: true } })
  return state.starters.map((p) => ({ ...p, startNr: String(numbers?.get(p.id) ?? '') }))
}

/** Was die Verzahnung verändert – gesperrt, solange sie festgeschrieben ist. */
const VERZAHNUNG_ACTIONS: ReadonlySet<Action['type']> = new Set([
  'SET_BOATS',
  'SET_CLASS4_SMALL',
  'SET_PARALLEL_INTERNATIONAL',
  'SET_PARALLEL_ORDER_BY_STARTNR',
  'ADD_PARCOURS',
  'SET_PARCOURS_PRESET',
  'REMOVE_PARCOURS',
  'SET_PARCOURS_CLASSES',
  'SET_PARCOURS_FACTOR',
  'SET_PARCOURS_TRACKS',
  'RESET_TRACKS',
])

export function reducer(state: AppState, action: Action): AppState {
  if (state.verzahnungLocked && VERZAHNUNG_ACTIONS.has(action.type)) return state

  switch (action.type) {
    case 'SET_WEIGHT':
      return {
        ...state,
        starters: state.starters.map((p) => {
          if (p.id !== action.id) return p
          const { gewicht: _old, ...rest } = p
          return action.gewicht === null ? rest : { ...rest, gewicht: action.gewicht }
        }),
      }

    case 'SET_SOLLGEWICHT': {
      const { [action.klasse]: _old, ...rest } = state.sollgewicht
      const preset = regelwerkOf(state.regelwerk).gewichte[action.klasse]
      const own = action.kg !== null && action.kg > 0 && action.kg !== preset
      return { ...state, sollgewicht: own ? { ...rest, [action.klasse]: action.kg } : rest }
    }

    case 'RESET_SOLLGEWICHT':
      return { ...state, sollgewicht: {} }

    case 'SET_VERZAHNUNG_LOCK': {
      const tracks = action.locked ? action.tracks : undefined
      return {
        ...state,
        verzahnungLocked: action.locked,
        parcoursList: tracks
          ? state.parcoursList.map((p) => (tracks[p.id] ? { ...p, tracks: tracks[p.id] } : p))
          : state.parcoursList,
      }
    }

    case 'SET_EVENT': {
      const next = { ...state, ...action.patch }
      next.laufCount = Math.max(1, Math.min(9, Math.round(next.laufCount) || 1))
      return next
    }

    case 'SET_EVENT_KIND':
      // Eine Clubmeisterschaft zeigt keine Herkunft; beim Wechsel zurück gilt
      // wieder der Verein, bis etwas anderes gewählt wird.
      return {
        ...state,
        eventKind: action.eventKind,
        originMode:
          action.eventKind === 'club' ? 'none' : state.originMode === 'none' ? 'verein' : state.originMode,
      }

    case 'SET_REGELWERK': {
      const regelwerk = regelwerkOf(action.regelwerk).id
      // Ohne Parallelslalom kann er auch nicht die Reihenfolge der Nummern vorgeben.
      const source = hasParallel(regelwerk) ? state.runningNumbers.source : 'manoever'
      return { ...state, regelwerk, runningNumbers: { ...state.runningNumbers, source } }
    }

    case 'SET_AUFBAU':
      return { ...state, aufbau: aufbauOf(action.aufbau, state.eigeneAufbauten).id }

    case 'SET_EIGENE_AUFBAUTEN':
      return {
        ...state,
        eigeneAufbauten: action.aufbauten,
        aufbau: aufbauOf(action.aufbau ?? state.aufbau, action.aufbauten).id,
      }

    case 'SET_LIST_OPTIONS':
      return { ...state, ...action.patch }

    case 'SET_WKR_LEERZEILEN': {
      if (action.klasse === undefined) {
        const anzahl = leerzeilenZahl(action.anzahl) ?? WKR_LEERZEILEN_VORGABE
        // Was danach nicht mehr abweicht, ist keine eigene Angabe mehr.
        const eigene = action.alleKlassen ? {} : Object.fromEntries(Object.entries(state.wkrLeerzeilenKlasse).filter(([, n]) => n !== anzahl))
        return { ...state, wkrLeerzeilen: anzahl, wkrLeerzeilenKlasse: eigene }
      }
      const { [action.klasse]: _alt, ...rest } = state.wkrLeerzeilenKlasse
      const anzahl = leerzeilenZahl(action.anzahl)
      return {
        ...state,
        wkrLeerzeilenKlasse: anzahl === undefined || anzahl === state.wkrLeerzeilen ? rest : { ...rest, [action.klasse]: anzahl },
      }
    }

    case 'SET_WKR_RUECKSEITE':
      return { ...state, wkrRueckseite: action.rueckseite }

    case 'SET_ORIGIN_SHORT': {
      const { [action.name]: _old, ...rest } = state.originShort
      const short = action.short.trim()
      return { ...state, originShort: short ? { ...rest, [action.name]: short } : rest }
    }

    case 'SET_ORIGIN_MODE':
      return { ...state, originMode: action.originMode }

    case 'SET_BOATS':
      return { ...state, boats: action.boats }

    case 'SET_CLASS4_SMALL':
      return { ...state, class4Small: action.class4Small }

    case 'SET_PARALLEL_INTERNATIONAL':
      return { ...state, parallelInternational: action.parallelInternational }

    case 'SET_PARALLEL_ORDER_BY_STARTNR':
      return { ...state, parallelOrderByStartNr: action.value }

    case 'SET_RUNNING_NUMBERS':
      return { ...state, runningNumbers: { ...state.runningNumbers, ...action.patch } }

    case 'IMPORT_STARTERS': {
      if (action.mode === 'replace') {
        return { ...state, starters: mergeStarters(state.starters, action.starters).starters }
      }
      const seen = new Set(state.starters.map(dupKey))
      return { ...state, starters: state.starters.concat(action.starters.filter((p) => !seen.has(dupKey(p)))) }
    }

    case 'ADD_STARTERS':
      return { ...state, starters: state.starters.concat(action.starters) }

    case 'UPDATE_STARTER':
      return {
        ...state,
        starters: state.starters.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
      }

    case 'MOVE_STARTER': {
      const target = state.starters.find((p) => p.id === action.id)
      if (!target) return state
      const inClass = sortedByStartNr(state.starters.filter((p) => p.klasse === target.klasse))
      const moved = moveInOrder(inClass, action.id, action.target)
      return { ...state, starters: replaceById(state.starters, redistributeNumbers(moved)) }
    }

    case 'ORDER_CLASS_BY_SIZE': {
      const inClass = state.starters.filter((p) => p.klasse === action.klasse)
      return { ...state, starters: replaceById(state.starters, redistributeNumbers(orderBySize(inClass))) }
    }

    case 'SET_START_NR_MODE':
      // Nur die Art wechselt; die Nummern bleiben, bis sie neu vergeben werden.
      return { ...state, startNrMode: action.mode }

    case 'ASSIGN_START_NUMBERS':
      return { ...state, starters: assignStartNumbers(state) }

    case 'REMOVE_STARTER':
      return { ...state, starters: state.starters.filter((p) => p.id !== action.id) }

    case 'CLEAR_CLASS':
      return { ...state, starters: state.starters.filter((p) => p.klasse !== action.klasse) }

    case 'CLEAR_ALL_STARTERS':
      return { ...state, starters: [] }

    case 'ADD_PARCOURS':
      return {
        ...state,
        parcoursList: state.parcoursList.concat({
          id: action.id,
          name: `Parcours ${state.parcoursList.length + 1}`,
          classIds: [],
          wechselFaktor: 2,
        }),
      }

    case 'SET_PARCOURS_PRESET':
      return {
        ...state,
        parcoursList: action.parcours.map((p, i) => ({
          id: p.id,
          name: `Parcours ${i + 1}`,
          classIds: p.classIds,
          wechselFaktor: action.wechselFaktor ?? 2,
        })),
        // Die WKR-Namen hängen an der Kennung des Parcours: Sie ziehen mit, sonst wären sie
        // nach jeder Schnellauswahl unsichtbar, stünden aber weiter in jeder Sicherung.
        einteilung: haengeUm(
          state.einteilung,
          state.parcoursList.map((p) => p.id),
          action.parcours.map((p) => p.id),
        ),
      }

    case 'REMOVE_PARCOURS':
      // Mit dem Parcours gehen die Namen seiner Wettkampfrichter: Es bliebe sonst kein Weg, sie zu löschen.
      return {
        ...state,
        parcoursList: state.parcoursList.filter((p) => p.id !== action.id),
        einteilung: ohneParcours(state.einteilung, action.id),
      }

    case 'RENAME_PARCOURS':
      return mapParcours(state, action.id, (p) => ({ ...p, name: action.name }))

    case 'SET_PARCOURS_CLASSES':
      // Andere Klassen machen die manuelle Spur-Anordnung ungültig.
      return mapParcours(state, action.id, (p) => ({ ...p, classIds: action.classIds, tracks: undefined }))

    case 'SET_PARCOURS_FACTOR':
      // Ein anderer Faktor macht die manuelle Spur-Anordnung ungültig.
      return mapParcours(state, action.id, (p) => ({ ...p, wechselFaktor: action.wechselFaktor, tracks: undefined }))

    case 'SET_PARCOURS_TRACKS':
      return mapParcours(state, action.id, (p) => ({ ...p, tracks: action.tracks }))

    case 'RESET_TRACKS':
      return mapParcours(state, action.id, (p) => ({ ...p, tracks: undefined }))

    case 'SET_WKR_NAME':
      return { ...state, einteilung: setzeName(state.einteilung, action.parcoursId, action.typeId, action.name) }

    case 'LOAD_STATE':
      return action.state

    case 'RESET_ALL':
      return emptyState()

    default:
      return state
  }
}
