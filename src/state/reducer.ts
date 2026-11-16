import type { AppState } from '../types'
import { starterfeldFest } from '../lib/eingaben'
import { ergaenzeAbmeldungen, mitAbmeldungenInRunden } from '../lib/abmeldung'
import { geaenderteListen, listenStandNach } from '../lib/listenStand'
import { mitTor5Umzug } from './tor5'
import { mitVorlaufPlan, VORLAUF, vorlaufGebunden } from '../planung/parallelRunden'
import { hasParallel, regelwerkOf } from '../config/catalog'
import { konfigVon } from './reducer/gemeinsam'
import { wendeVeranstaltungAn, type VeranstaltungAenderung } from './reducer/veranstaltung'
import { wendeRegelwerkAn, type RegelwerkAenderung } from './reducer/regelwerk'
import { wendeStarterAn, type StarterAenderung } from './reducer/starter'
import { wendeStartnummernAn, type StartnummernAenderung } from './reducer/startnummern'
import { wendeVerzahnungAn, type VerzahnungAenderung } from './reducer/verzahnung'
import { wendeParallelAn, type ParallelAenderung } from './reducer/parallel'
import { wendeErfassungAn, type ErfassungAenderung } from './reducer/erfassung'
import { wendeWertungAn, type WertungAenderung } from './reducer/wertung'
import { wendeListenAn, type ListenAenderung } from './reducer/listen'

// Die case-Zweige stehen nach Bereichen in reducer/<bereich>.ts (Zuordnung: switch in wendeAn() unten).
// Hier bleiben Einstieg, Sperren und Nachbearbeitung; was die Bereiche nach außen geben, reicht
// diese Datei weiter, damit jeder Import aus '…/state/reducer' bleibt.
export { emptyState } from './reducer/veranstaltung'
export { klasseFest } from './reducer/starter'
export { assignStartNumbers } from './reducer/startnummern'
export { ERGEBNIS_LISTEN_VORGABE, streichlaeufeWert } from './reducer/wertung'
export {
  WKR_LEERZEILEN_VORGABE,
  WKR_LEERZEILEN_CLUB,
  WKR_LEERZEILEN_SEITE_VORGABE,
  WKR_LEERZEILEN_MAX,
  leerzeilenZahl,
  WKR_ZEILEN_JE_SEITE_MIN,
  WKR_ZEILEN_JE_SEITE_MAX,
  WKR_TEILEN_AB_MAX,
  zeilenJeSeiteZahl,
  teilenAbZahl,
  laufzettelLayoutWert,
} from './reducer/listen'

/**
 * Alle Änderungen am Zustand laufen als Action durch diesen Reducer.
 *
 * Der Reducer ist **rein und deterministisch**: Er würfelt nicht und fragt keine
 * Uhr. IDs und Zufallsdaten bringt die Action mit. Nur so lässt sich dieselbe
 * Action später auf mehreren Geräten anwenden (Mehr-Browser-Betrieb über ntfy)
 * und kommt überall zum selben Ergebnis.
 */
export type Action = Aenderung & {
  /**
   * Zeitpunkt, zu dem die Action entstand (Millisekunden seit 1970); der Store setzt ihn.
   * Er wird zum Stand der Wertungslisten, die sich durch die Action ändern
   * (lib/listenStand.ts). Fehlt er, bleibt deren Zeitpunkt unbekannt.
   */
  zeit?: number
}

type Aenderung =
  | VeranstaltungAenderung
  | RegelwerkAenderung
  | StarterAenderung
  | StartnummernAenderung
  | VerzahnungAenderung
  | ParallelAenderung
  | ErfassungAenderung
  | WertungAenderung
  | ListenAenderung

/** Was die Verzahnung verändert – gesperrt, solange sie festgeschrieben ist. */
const VERZAHNUNG_ACTIONS: ReadonlySet<Action['type']> = new Set([
  'SET_BOATS',
  'SET_CLASS4_SMALL',
  'SET_PARALLEL_ORDER_BY_STARTNR',
  'SET_PARALLEL_STRENG',
  'ADD_PARCOURS',
  'SET_PARCOURS_PRESET',
  'REMOVE_PARCOURS',
  'SET_PARCOURS_CLASSES',
  'SET_PARCOURS_FACTOR',
  'SET_PARCOURS_TRACKS',
  'RESET_TRACKS',
  // Die Startnummern stehen mit der Verzahnung fest: Sortieren verteilte sie neu (Entscheidung
  // des Nutzers vom 15.11.2026), ebenso ▲▼ im Starter-Reiter (16.11.2026). Nummern von Hand gehen
  // weiter – für Korrekturen.
  'ORDER_STARTERS',
  'SHUFFLE_STARTERS',
  'MOVE_STARTER',
])

/**
 * Was Starter hinzufügt oder entfernt. Sobald Ergebnisse erfasst sind, ändern diese Actions
 * den Stand nicht mehr (lib/eingaben.ts `starterfeldFest`) – die Sperre hängt so nicht nur an
 * den Knöpfen. Angaben ändern (UPDATE_STARTER), eine Sicherung laden und Zurücksetzen gehen weiter.
 */
/** Die Schalter, nach denen der Startplan des Parallelslaloms gerechnet wird. */
const PLAN_ACTIONS: ReadonlySet<Action['type']> = new Set(['SET_CLASS4_SMALL', 'SET_PARALLEL_ORDER_BY_STARTNR', 'SET_PARALLEL_STRENG'])

// Ein Starter in eine andere Klasse ist für beide Klassen wie Entfernen und Hinzufügen: Die
// gedruckten Bögen enthalten seine Zeile – deshalb hier und nicht bei den Angaben.
export const STARTERFELD_ACTIONS: ReadonlySet<Action['type']> = new Set(['IMPORT_STARTERS', 'ADD_STARTERS', 'REMOVE_STARTER', 'CLEAR_CLASS', 'CLEAR_ALL_STARTERS', 'MOVE_STARTER_TO_CLASS'])

export function reducer(state: AppState, action: Action): AppState {
  // Ein geladener oder neuer Stand bringt seine Zeitpunkte mit; verglichen wird er mit sich selbst.
  const frisch = action.type === 'LOAD_STATE' || action.type === 'RESET_ALL'
  const angewendet = wendeAn(state, action)
  if (angewendet === state) return state
  // Der Plan des Vorlaufs, der bei freigegebener Verzahnung an erfassten Werten hängt, entfällt
  // nur über „Werte löschen“ (Entscheidung des Nutzers vom 15.11.2026) – nicht schon, wenn das
  // letzte einzelne Feld geleert wird: Wer einen Tippfehler berichtigt, verlöre sonst den Plan,
  // nach dem gedruckt ist. Bei gesetzter Sperre ändert sich hier nichts
  // (planung/parallelRunden.ts `mitVorlaufPlan`).
  // „Werte des Gewählten löschen“, das alles leert, ist dasselbe wie „Werte löschen“.
  const allesGeloescht = action.type === 'CLEAR_EINGABEN' || (action.type === 'CLEAR_EINGABEN_TEIL' && Object.keys(angewendet.eingaben).length === 0)
  const roh = allesGeloescht && !angewendet.verzahnungLocked ? mitVorlaufPlan(angewendet, hasParallel(angewendet.regelwerk)) : angewendet
  // Wird der Plan des Vorlaufs festgeschrieben, bekommen schon Abgemeldete dort ihr X.
  const mitX = !frisch && roh.abgemeldet.length > 0 && roh.parallelPlaene[VORLAUF] !== undefined && state.parallelPlaene[VORLAUF] === undefined ? mitAbmeldungenInRunden(roh, konfigVon(roh), [VORLAUF]) : roh
  // Wechselt die Liste für Tor 5 (Option, Aufbau, geänderter eigener Aufbau), zieht mit, was an
  // ihr hing. Ein geladener Stand ist in sich stimmig und bleibt, wie er ist; eine Vorlage
  // zieht beim Anwenden selbst um (persistenz/backup.ts).
  const umgezogen = frisch ? mitX : mitTor5Umzug(state, mitX)
  // Kommt ein Lauf dazu (Zahl der Läufe, andere Disziplin), bekommen Abgemeldete das X auch dort.
  const angewandt =
    frisch || umgezogen.abgemeldet.length === 0 || (umgezogen.laufCount === state.laufCount && umgezogen.aufbau === state.aufbau && umgezogen.eigeneAufbauten === state.eigeneAufbauten && umgezogen.regelwerk === state.regelwerk)
      ? umgezogen
      : ergaenzeAbmeldungen(state, umgezogen, konfigVon(state), konfigVon(umgezogen))
  // Ohne Starter gibt es kein Beispiel-Starterfeld mehr – gleich, wie die Starter gingen.
  const next = angewandt.beispielStarter && angewandt.starters.length === 0 ? { ...angewandt, beispielStarter: false } : angewandt
  // Eine Eingabe betrifft nur die Klassen ihrer Starter – bei jedem Tastendruck alle Klassen neu zu werten wäre unnötig.
  const klassen =
    action.type === 'SET_EINGABEN'
      ? [...new Set(action.zellen.flatMap((z) => next.starters.find((p) => p.id === z.starter)?.klasse ?? []))]
      : undefined
  // Jede Eingabe (getippt, gescannt, gelöscht, Beispielwerte) setzt den Zeitpunkt der Liste
  // ihrer Klasse und ihres Laufs – auch wenn die Liste danach gleich aussieht (Vorgabe des
  // Nutzers; lib/listenStand.ts). Nur für die Wege der Eingabe: Ein Umzug von Werten beim
  // Wechsel des Aufbaus ist keine.
  const eingegeben =
    action.type === 'SET_EINGABEN' || action.type === 'FILL_BEISPIELWERTE' || action.type === 'CLEAR_EINGABEN_TEIL' || action.type === 'ABMELDEN_STARTER' || action.type === 'ANMELDEN_STARTER' || action.type === 'PARALLEL_RUNDE_LOESEN'
      ? geaenderteListen(state, next)
      : undefined
  // Die Mannschaftswertung führt keinen eigenen Stand: Ihr Zeitpunkt ist der jüngste der
  // Gesamtlisten (lib/listenStand.ts `wertungZeit`).
  const listenStand = listenStandNach(frisch ? next : state, next, action.zeit, klassen, eingegeben)
  return listenStand === next.listenStand ? next : { ...next, listenStand }
}

function wendeAn(state: AppState, action: Action): AppState {
  if (state.verzahnungLocked && VERZAHNUNG_ACTIONS.has(action.type)) return state
  // Sind zum Vorlauf des Parallelslaloms Werte erfasst, bleibt sein Plan fest – und mit ihm die
  // Schalter, nach denen er gerechnet wurde (planung/parallelRunden.ts `vorlaufGebunden`).
  if (PLAN_ACTIONS.has(action.type) && vorlaufGebunden(state)) return state
  // Das Regelwerk bestimmt Listen, Felder und Wertung: Sobald Ergebnisse erfasst sind, lässt es
  // sich nicht mehr wechseln – bis alle Werte gelöscht sind (Entscheidung des Nutzers vom
  // 15.11.2026). Ein Klick auf das schon gewählte ändert ohnehin nichts.
  if (action.type === 'SET_REGELWERK' && starterfeldFest(state) && regelwerkOf(action.regelwerk).id !== state.regelwerk) return state
  if (STARTERFELD_ACTIONS.has(action.type) && starterfeldFest(state)) return state

  // Jede Action gehört zu genau einem Bereich; dort steht ihr case.
  switch (action.type) {
    case 'SET_EVENT':
    case 'SET_EVENT_KIND':
    case 'SET_ORIGIN_MODE':
    case 'LOAD_STATE':
    case 'RESET_ALL':
    case 'SET_KENNUNG':
      return wendeVeranstaltungAn(state, action)

    case 'SET_REGELWERK':
    case 'SET_AUFBAU':
    case 'SET_EIGENE_AUFBAUTEN':
    case 'SET_TOR5_MIT_PARCOURS':
    case 'SET_VERSUCHE_NACHEINANDER':
    case 'SET_ZUSATZ_LISTE':
      return wendeRegelwerkAn(state, action)

    case 'SET_WEIGHT':
    case 'SET_SOLLGEWICHT':
    case 'RESET_SOLLGEWICHT':
    case 'IMPORT_STARTERS':
    case 'ADD_STARTERS':
    case 'UPDATE_STARTER':
    case 'MOVE_STARTER_TO_CLASS':
    case 'REMOVE_STARTER':
    case 'ABMELDEN_STARTER':
    case 'ANMELDEN_STARTER':
    case 'CLEAR_CLASS':
    case 'CLEAR_ALL_STARTERS':
      return wendeStarterAn(state, action)

    case 'SET_RUNNING_NUMBERS':
    case 'MOVE_STARTER':
    case 'ORDER_STARTERS':
    case 'SHUFFLE_STARTERS':
    case 'SET_START_NR_MODE':
    case 'ASSIGN_START_NUMBERS':
    case 'SET_DOLPHIN_PRAEFIX':
      return wendeStartnummernAn(state, action)

    case 'SET_VERZAHNUNG_LOCK':
    case 'SET_BOATS':
    case 'SET_CLASS4_SMALL':
    case 'ADD_PARCOURS':
    case 'SET_PARCOURS_PRESET':
    case 'REMOVE_PARCOURS':
    case 'RENAME_PARCOURS':
    case 'SET_PARCOURS_CLASSES':
    case 'SET_PARCOURS_FACTOR':
    case 'SET_PARCOURS_TRACKS':
    case 'RESET_TRACKS':
      return wendeVerzahnungAn(state, action)

    case 'SET_PARALLEL_ORDER_BY_STARTNR':
    case 'SET_PARALLEL_STRENG':
    case 'PARALLEL_RUNDE_FESTSCHREIBEN':
    case 'PARALLEL_RUNDE_LOESEN':
      return wendeParallelAn(state, action)

    case 'SET_EINGABEN':
    case 'CLEAR_EINGABEN':
    case 'FILL_BEISPIELWERTE':
    case 'FILL_BEISPIEL_BESETZUNG':
    case 'FILL_BEISPIELGEWICHTE':
    case 'CLEAR_EINGABEN_TEIL':
      return wendeErfassungAn(state, action)

    case 'SET_ERGEBNIS_LISTEN':
    case 'SET_STREICHLAEUFE':
    case 'SET_POKAL_VARIANTE':
    case 'SET_POKAL_PUNKTE':
    case 'SET_POKAL_UIM':
    case 'SET_POKAL_NUR_AUSWAHL':
    case 'SET_POKAL_ZAEHLT':
    case 'INVERT_POKAL_ZAEHLT':
    case 'SET_NICHT_WERTEN':
      return wendeWertungAn(state, action)

    case 'SET_LIST_OPTIONS':
    case 'SET_ORIGIN_SHORT':
    case 'SET_WKR_NAME':
    case 'SET_BOOT':
    case 'SET_CO_PILOT':
    case 'SET_WKR_LEERZEILEN':
    case 'SET_WKR_RUECKSEITE':
    case 'SET_WKR_CLUB_GEMEINSAM':
    case 'SET_WKR_SEITEN':
    case 'SET_BESCHRIFTUNG':
    case 'SET_WKR_SPRACHE':
    case 'SET_WKR_LEERZEILEN_SEITE':
    case 'SET_LAUFZETTEL_LAYOUT':
    case 'SET_PARALLEL_ZEBRA':
      return wendeListenAn(state, action)

    default:
      // Fehlt oben eine Action aus den Bereichen, meldet das die Typprüfung hier.
      action satisfies never
      return state
  }
}
