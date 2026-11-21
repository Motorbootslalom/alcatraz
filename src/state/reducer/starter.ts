// Starterfeld: anlegen, importieren, ändern, in andere Klasse, entfernen, ab- und anmelden; Gewichte der Verwiegung.

import type { AppState, ClassId, Starter } from '../../types'
import { naechsteStartNr } from '../../domain/startnrBereiche'
import { dublettenSchluessel, mergeStarters } from '../../import/starterMerge'
import { nurStarter, setzeWerte, starterfeldFest } from '../../lib/eingaben'
import { wkrNurStarter } from './wkr'
import { abmeldeZellen, mitAbmeldung, mitAbmeldungInRunden } from '../../lib/abmeldung'
import { VORLAUF } from '../../planung/parallelRunden'
import { regelwerkOf, startNrRegeln } from '../../config/catalog'
import { istGeschlecht } from '../../domain/geschlecht'
import { konfigVon } from './gemeinsam'

export type StarterAenderung =
  /** Gewicht aus der Verwiegung; `null` heißt „noch nicht gewogen“. */
  | { type: 'SET_WEIGHT'; id: string; gewicht: number | null }
  /** Eigenes Durchschnittsgewicht setzen; `null` oder der Wert des Regelwerks entfernt den Eintrag. */
  | { type: 'SET_SOLLGEWICHT'; klasse: ClassId; kg: number | null }
  | { type: 'RESET_SOLLGEWICHT' }
  /**
   * `replace`: Die Liste gilt danach als Ganzes; wiedererkannte Starter behalten
   * ihre ID (Startlisten und Ergebnisse verweisen darauf). `merge`: Nur neue
   * Starter kommen hinzu, Dubletten (Klasse + Name) werden übergangen.
   */
  /**
   * `auswahlAusDatei`: Die Quelle kennt die Auswahl für die Pokalauswertung (Teilnehmerdaten-
   * Datei) – sie gilt dann wie geladen. Ohne (Excel) bleibt eine bestehende Abwahl stehen.
   */
  /** `nummerVomImport`: IDs der Starter, deren Nummer erst der Import vergab – zählt nicht zum Wiedererkennen. */
  | { type: 'IMPORT_STARTERS'; starters: Starter[]; mode: 'replace' | 'merge'; auswahlAusDatei?: true; nummerVomImport?: string[] }
  /** `beispiel`: erfundene Starter aus den Beispieldaten – das Feld gilt danach als Beispiel-Starterfeld. */
  | { type: 'ADD_STARTERS'; starters: Starter[]; beispiel?: boolean }
  | { type: 'UPDATE_STARTER'; id: string; patch: Partial<Omit<Starter, 'id'>> }
  /** In eine andere Klasse, weil der Jahrgang dorthin gehört – mit dem neuen Geburtsdatum (components/ClassSection.vue). */
  | { type: 'MOVE_STARTER_TO_CLASS'; id: string; klasse: ClassId; geburtsdatum?: string }
  | { type: 'REMOVE_STARTER'; id: string }
  /**
   * Nach Beginn des Wettkampfs statt Entfernen: als „nicht gestartet“ eintragen (X in jedem Lauf
   * ohne erfasste Werte) bzw. diese Abmeldung als Ganzes zurücknehmen – lib/abmeldung.ts.
   */
  | { type: 'ABMELDEN_STARTER'; id: string }
  | { type: 'ANMELDEN_STARTER'; id: string }
  | { type: 'CLEAR_CLASS'; klasse: ClassId }
  | { type: 'CLEAR_ALL_STARTERS' }

/**
 * Steht die Klasse der Starter fest? Sobald die Verzahnung oder der Startplan des Vorlaufs
 * festgeschrieben ist. Dieselbe Frage stellen Oberfläche und Reducer.
 */
export function klasseFest(state: Pick<AppState, 'verzahnungLocked' | 'parallelPlaene'>): boolean {
  return state.verzahnungLocked || state.parallelPlaene[VORLAUF] !== undefined
}

/** Mit den Startern gehen ihre Eingaben (und Rückfragen/Vorschläge der WKR-Geräte): Ohne Starter gäbe es keinen Weg mehr, sie zu sehen oder zu löschen. */
function mitStartern(state: AppState, starters: Starter[]): AppState {
  const ids = new Set(starters.map((p) => p.id))
  const abgemeldet = state.abgemeldet.some((id) => !ids.has(id)) ? state.abgemeldet.filter((id) => ids.has(id)) : state.abgemeldet
  const abgemeldetBis = abgemeldet === state.abgemeldet ? state.abgemeldetBis : Object.fromEntries(Object.entries(state.abgemeldetBis).filter(([id]) => ids.has(id)))
  return { ...state, starters, eingaben: nurStarter(state.eingaben, ids), abgemeldet, abgemeldetBis, wkr: wkrNurStarter(state.wkr, ids) }
}

export function wendeStarterAn(state: AppState, action: StarterAenderung): AppState {
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

    case 'IMPORT_STARTERS': {
      if (action.mode === 'replace') {
        // Die Liste gilt als Ganzes: Es ist nicht mehr das Beispiel-Starterfeld.
        return { ...mitStartern(state, mergeStarters(state.starters, action.starters, action.auswahlAusDatei ? 'datei' : 'bisher', new Set(action.nummerVomImport)).starters), beispielStarter: false }
      }
      const seen = new Set(state.starters.map(dublettenSchluessel))
      return { ...state, starters: state.starters.concat(action.starters.filter((p) => !seen.has(dublettenSchluessel(p)))) }
    }

    case 'ADD_STARTERS':
      return { ...state, starters: state.starters.concat(action.starters), beispielStarter: state.beispielStarter || (action.beispiel === true && action.starters.length > 0) }

    case 'UPDATE_STARTER': {
      // Die Klasse eines Starters lässt sich nicht mehr ändern, sobald die Verzahnung bzw. der
      // Startplan des Parallelslaloms festgeschrieben ist (Entscheidung des Nutzers vom
      // 15.11.2026): Er stünde sonst in Spur, Paar und Boot einer Klasse, zu der er nicht gehört.
      // Die übrigen Angaben des Patches gelten weiter.
      const { klasse, ...ohneKlasse } = action.patch
      const patch = klasse !== undefined && klasseFest(state) ? ohneKlasse : action.patch
      if (Object.keys(patch).length === 0) return state
      return {
        ...state,
        starters: state.starters.map((p) => {
          if (p.id !== action.id) return p
          const neu = { ...p, ...patch }
          // Freiwillige Angabe: „nicht erfasst“ steht nicht als leeres Feld im Stand.
          if (!istGeschlecht(neu.geschlecht)) delete neu.geschlecht
          return neu
        }),
      }
    }

    case 'MOVE_STARTER_TO_CLASS': {
      // Vorschlag beim Bearbeiten, wenn der Jahrgang nicht mehr zur Klasse passt (Entscheidung des
      // Nutzers vom 15.11.2026): nur solange die Klasse nicht feststeht (klasseFest), wie bei
      // UPDATE_STARTER. Klassenbasierte Nummern gehören zur Klasse – der Starter bekommt in der
      // neuen die nächste freie und steht dort hinten; eine klassische bleibt (die Verzahnung vergibt sie).
      if (klasseFest(state)) return state
      const starter = state.starters.find((p) => p.id === action.id)
      if (!starter || starter.klasse === action.klasse) return state
      // Mit Startnummern-Bereichen (19.11.2026) die erste freie aus dem Bereich seiner Größe.
      const startNr = state.startNrMode === 'klasse' ? naechsteStartNr(state.starters, action.klasse, starter.groesse, startNrRegeln(state, action.klasse)) : starter.startNr
      const geburtsdatum = action.geburtsdatum ?? starter.geburtsdatum
      return { ...state, starters: state.starters.map((p) => (p.id === starter.id ? { ...p, klasse: action.klasse, startNr, geburtsdatum } : p)) }
    }

    case 'ABMELDEN_STARTER': {
      // Vor dem ersten Ergebnis wird ein Starter einfach entfernt – abgemeldet wird erst danach.
      const starter = state.starters.find((p) => p.id === action.id)
      if (!starter || !starterfeldFest(state) || state.abgemeldet.includes(starter.id)) return state
      return {
        ...state,
        abgemeldet: [...state.abgemeldet, starter.id],
        abgemeldetBis: { ...state.abgemeldetBis, [starter.id]: Math.max(1, state.laufCount) },
        eingaben: mitAbmeldungInRunden({ ...state, eingaben: mitAbmeldung(state, konfigVon(state), starter) }, konfigVon(state), starter),
      }
    }

    case 'ANMELDEN_STARTER': {
      const starter = state.starters.find((p) => p.id === action.id)
      if (!starter || !state.abgemeldet.includes(starter.id)) return state
      return {
        ...state,
        abgemeldet: state.abgemeldet.filter((id) => id !== starter.id),
        abgemeldetBis: Object.fromEntries(Object.entries(state.abgemeldetBis).filter(([id]) => id !== starter.id)),
        eingaben: setzeWerte(state.eingaben, abmeldeZellen(state.eingaben, konfigVon(state), starter)),
      }
    }

    case 'REMOVE_STARTER':
      return mitStartern(state, state.starters.filter((p) => p.id !== action.id))

    case 'CLEAR_CLASS':
      return mitStartern(state, state.starters.filter((p) => p.klasse !== action.klasse))

    case 'CLEAR_ALL_STARTERS':
      return mitStartern(state, [])
  }
}
