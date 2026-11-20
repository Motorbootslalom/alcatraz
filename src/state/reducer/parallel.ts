// Parallelslalom: Schalter des Startplans (Reihenfolge, strenge Klassentrennung) und Runden festschreiben bzw. lösen.

import type { AppState, ClassId, ParallelPlaene, ParallelRunde } from '../../types'
import { mitAbmeldungenInRunden, NICHT_GESTARTET } from '../../lib/abmeldung'
import { alleWeiter, klassenStaende, loeseRunde, schreibeRundeFest } from '../../lib/parallelStage'
import { klassenDerRunde, PARALLEL_ANNAHMEN } from '../../lib/parallelErgebnis'
import { zerlegeAttempt } from '../../lib/parallelSchluessel'
import { istRunde, VORLAUF, verzahneRunde } from '../../planung/parallelRunden'
import { betriebVon, PARALLEL_BEREICH, rundenPunkt } from '../../betrieb/folge'
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
  /**
   * „Alle Klassen weiter“ (Wunsch des Nutzers vom 19.11.2026): für jede genannte Klasse ihre
   * nächste Runde in EINEM Schritt (ein Eintrag im Verlauf). Die Action nennt, was die Oberfläche
   * gezeigt hat; es wirkt nur, was jetzt noch ansteht (lib/parallelStage.ts `alleWeiter`, dieselbe
   * Prüfung wie beim Knopf je Klasse) – ein zweites Fenster oder ein doppelter Klick ändert nichts.
   */
  | { type: 'PARALLEL_RUNDEN_ALLE_FESTSCHREIBEN'; schritte: { klasse: ClassId; runde: ParallelRunde }[] }
  /**
   * Die Listen dieser Runden wurden gedruckt (Antwort des Nutzers vom 20.11.2026: „Ja, auf jeden
   * Fall“): Ab jetzt ordnet eine später festgeschriebene Klasse sie nicht mehr neu, sie kommt nur
   * ans Ende. Geschickt beim Drucken unter „Listen“ (views/ListsView.vue, `beforeprint`), nie vom
   * Reducer selbst; den Zeitpunkt setzt der Store. Der Vorlauf zählt nicht – er hängt an der
   * Verzahnung. Schon Gedrucktes behält seinen ersten Zeitpunkt (unverändert ⇒ derselbe Stand).
   */
  | { type: 'PARALLEL_RUNDEN_GEDRUCKT'; runden: ParallelRunde[] }
  /**
   * „Druck lösen“ (20.11.2026, „Man muss es aber wieder lösen können, wenn später ein Fehler
   * auffällt und neu gedruckt werden muss“): hebt die Bindung durch den Druck auf. Erfasste Werte
   * oder ein im Betrieb begonnener Lauf binden die Runde weiter.
   */
  | { type: 'PARALLEL_DRUCK_LOESEN'; runde: ParallelRunde }

/**
 * Ist in der Runde etwas erfasst? Nicht mit: das X eines Abgemeldeten, das festschreiben() beim
 * Festschreiben einer Klasse selbst einträgt (lib/abmeldung.ts) – sonst hielte das Festschreiben
 * der einen Klasse die Runde für die nächste schon fest, obwohl niemand etwas erfasst hat, und die
 * nächste Klasse käme ohne den Wechsel klein/groß ans Ende (Korrektur vom 19.11.2026).
 */
function rundeErfasst(state: AppState, runde: ParallelRunde): boolean {
  const ab = new Set(state.abgemeldet)
  return Object.entries(state.eingaben).some(
    ([schluessel, zeilen]) =>
      zerlegeAttempt(schluessel)?.runde === runde &&
      Object.entries(zeilen).some(([starter, werte]) => !(ab.has(starter) && Object.values(werte).every((w) => w === NICHT_GESTARTET))),
  )
}

/**
 * Darf die Runde nicht mehr neu geordnet werden? Sobald darin etwas erfasst ist (die Zeilen stehen
 * auf Papier und in der Erfassung), sie im Betrieb begonnen ist (die Tafel zeigt ihre Folge) oder
 * ihre Listen gedruckt sind (`parallelGedruckt`, Antwort des Nutzers vom 20.11.2026), kommt eine
 * Klasse nur noch ans Ende – PARALLEL_ANNAHMEN.rundenVerzahnen.
 */
function rundeGebunden(state: AppState, runde: ParallelRunde): boolean {
  return rundeGedruckt(state, runde) || rundeErfasst(state, runde) || betriebVon(state, PARALLEL_BEREICH).begonnen.includes(rundenPunkt(runde))
}

/** Sind die Listen der Runde gedruckt (und nicht wieder gelöst)? Nur mit Plan – siehe {@link ohneVerwaistenDruck}. */
export function rundeGedruckt(state: Pick<AppState, 'parallelGedruckt' | 'parallelPlaene'>, runde: ParallelRunde): boolean {
  return state.parallelGedruckt[runde] !== undefined && state.parallelPlaene[runde] !== undefined
}

/**
 * Der Druckvermerk einer Runde, deren Plan es nicht mehr gibt (letzte Klasse gelöscht, „Werte
 * löschen“, andere Sicherung), fällt weg: Ein neu festgeschriebener Plan derselben Runde ist noch
 * nicht gedruckt. Aufgerufen in reducer() nach jeder Action.
 */
export function ohneVerwaistenDruck(state: AppState): AppState {
  const runden = Object.keys(state.parallelGedruckt) as ParallelRunde[]
  if (runden.every((r) => state.parallelPlaene[r] !== undefined)) return state
  return { ...state, parallelGedruckt: Object.fromEntries(runden.filter((r) => state.parallelPlaene[r] !== undefined).map((r) => [r, state.parallelGedruckt[r]])) }
}

/**
 * Welche Runden das Festschreiben dieser Schritte neu ordnete: Sie haben schon Starts anderer
 * Klassen und sind nicht gebunden – deren Zeilen rücken also. Die Oberfläche fragt dann nach
 * (components/ParallelRunden.vue), weil schon gedruckte Listen der Runde nicht mehr passten
 * (Prüfbefund vom 19.11.2026: beim Löschen gab es die Warnung schon, beim Festschreiben nicht).
 */
export function rundenNeuGeordnet(state: AppState, schritte: readonly { klasse: ClassId; runde: ParallelRunde }[]): ParallelRunde[] {
  if (!PARALLEL_ANNAHMEN.rundenVerzahnen) return []
  const runden = [...new Set(schritte.map((s) => s.runde))]
  return runden.filter((runde) => {
    const neu = new Set(schritte.filter((s) => s.runde === runde).map((s) => s.klasse))
    const plan = state.parallelPlaene[runde]
    return !!plan && plan.starts.some((s) => s.klasse !== undefined && !neu.has(s.klasse)) && !rundeGebunden(state, runde)
  })
}

/** Die Runden `runden` als Ganzes verzahnen (klein/groß im Wechsel, Klassen in der Folge des Vorlaufs). */
function verzahnt(state: AppState, runden: Iterable<ParallelRunde>): AppState {
  if (!PARALLEL_ANNAHMEN.rundenVerzahnen) return state
  const folge = klassenDerRunde(state, VORLAUF)
  let parallelPlaene = state.parallelPlaene
  for (const runde of runden) parallelPlaene = verzahneRunde(parallelPlaene, runde, folge)
  return parallelPlaene === state.parallelPlaene ? state : { ...state, parallelPlaene }
}

/** Runden je Klasse festschreiben – für den Knopf je Klasse und für „Alle Klassen weiter“. */
function festschreiben(state: AppState, schritte: readonly { klasse: ClassId; runde: ParallelRunde }[]): AppState {
  if (!hasParallel(state.regelwerk)) return state
  const konfig = konfigVon(state)
  // Gebunden oder nicht entscheidet der Stand VOR dem Schritt: Das X eines Abgemeldeten, das beim
  // Festschreiben gleich eingetragen wird, ist kein erfasster Wert, der die Runde festhielte.
  const ordnen = new Set(schritte.map((s) => s.runde).filter((r) => !rundeGebunden(state, r)))
  let next = state
  for (const { klasse, runde } of schritte) {
    const parallelPlaene = schreibeRundeFest(next, konfig, klasse, runde)
    if (!parallelPlaene) continue
    // Wer abgemeldet ist und trotzdem in der Runde steht, bekommt dort gleich sein X – nur in
    // der Klasse, die festgeschrieben wird: Ein X, das in einer anderen Klasse derselben Runde
    // von Hand entfernt wurde (er fährt doch), bleibt entfernt.
    next = mitAbmeldungenInRunden({ ...next, parallelPlaene }, konfig, [runde], klasse)
  }
  return next === state ? state : verzahnt(next, ordnen)
}

/**
 * Für migrate(): nur Runden nach dem Vorlauf mit Plan und gültigem Zeitpunkt (Zahl ≥ 0);
 * Unbrauchbares fällt weg – dann gilt die Runde als nicht gedruckt.
 */
export function normalisiereGedruckt(roh: unknown, plaene: ParallelPlaene): AppState['parallelGedruckt'] {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return {}
  return Object.fromEntries(
    Object.entries(roh).filter(([r, z]) => istRunde(r) && r !== VORLAUF && plaene[r] !== undefined && typeof z === 'number' && Number.isFinite(z) && z >= 0),
  )
}

export function wendeParallelAn(state: AppState, action: ParallelAenderung & { zeit?: number }): AppState {
  switch (action.type) {
    case 'SET_PARALLEL_ORDER_BY_STARTNR':
      return { ...state, parallelOrderByStartNr: action.value }

    case 'SET_PARALLEL_STRENG':
      return action.value === state.parallelStreng ? state : { ...state, parallelStreng: action.value }

    case 'PARALLEL_RUNDE_FESTSCHREIBEN':
      return festschreiben(state, [{ klasse: action.klasse, runde: action.runde }])

    case 'PARALLEL_RUNDEN_ALLE_FESTSCHREIBEN': {
      if (!hasParallel(state.regelwerk)) return state
      const jetzt = new Set(alleWeiter(klassenStaende(state, konfigVon(state))).weiter.map((s) => `${s.klasse}|${s.runde}`))
      return festschreiben(
        state,
        action.schritte.filter((s) => jetzt.has(`${s.klasse}|${s.runde}`)),
      )
    }

    case 'PARALLEL_RUNDEN_GEDRUCKT': {
      if (!hasParallel(state.regelwerk)) return state
      const neu = [...new Set(action.runden)].filter((r) => r !== VORLAUF && state.parallelPlaene[r] !== undefined && state.parallelGedruckt[r] === undefined)
      if (neu.length === 0) return state
      return { ...state, parallelGedruckt: { ...state.parallelGedruckt, ...Object.fromEntries(neu.map((r) => [r, action.zeit ?? 0])) } }
    }

    case 'PARALLEL_DRUCK_LOESEN': {
      if (state.parallelGedruckt[action.runde] === undefined) return state
      const { [action.runde]: _alt, ...parallelGedruckt } = state.parallelGedruckt
      return { ...state, parallelGedruckt }
    }

    case 'PARALLEL_RUNDE_LOESEN': {
      const geloest = loeseRunde(state, konfigVon(state), action.klasse, action.runde)
      if (!geloest) return state
      const next = { ...state, ...geloest }
      // Ohne die Klasse rückt die Runde wieder zusammen – nur, solange darin nichts erfasst und sie
      // im Betrieb nicht begonnen ist (PARALLEL_ANNAHMEN.rundenVerzahnen).
      return rundeGebunden(next, action.runde) ? next : verzahnt(next, [action.runde])
    }
  }
}
