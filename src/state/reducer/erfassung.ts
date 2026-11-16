// Erfassung: Werte setzen und löschen (alle oder Läufe/Runden); Beispielwerte, -Besetzung und -Gewichte aus der `saat`.

import type { AppState, ParallelRunde } from '../../types'
import { einteilungsZellen } from '../../lib/einteilung'
import { beispielEinteilung, beispielGewichte } from '../../lib/beispieldaten'
import { parallelListen } from '../../lib/parallelBogen'
import { gueltigeZellen, laufSchluessel, OHNE_LAUF, setzeWerte, type EingabeZelle } from '../../lib/eingaben'
import { attemptSchluessel } from '../../lib/parallelSchluessel'
import { mitAbmeldung, mitAbmeldungenInRunden } from '../../lib/abmeldung'
import { beispielEingaben, beispielRunde, zufallAus, type Zeitnahme } from '../../lib/beispielwerte'
import { VORLAUF } from '../../planung/parallelRunden'
import { hasParallel, sollgewichtOf } from '../../config/catalog'
import { konfigVon } from './gemeinsam'

export type ErfassungAenderung =
  /**
   * Erfasste Werte setzen, Zelle für Zelle (Lauf-Schlüssel, Starter-ID, Feld-Kennung); ein
   * leerer Wert löscht die Zelle. Eine Action je Eingabe – oder ein Bündel, etwa wenn später
   * ein Wettkampfrichter seine Liste vom eigenen Gerät abliefert: Verschiedene Geräte
   * schreiben verschiedene Zellen und überschreiben einander nichts.
   */
  | { type: 'SET_EINGABEN'; zellen: EingabeZelle[] }
  /** Alle erfassten Werte verwerfen. Einzelne Zellen löscht `SET_EINGABEN` mit leerem Wert. */
  | { type: 'CLEAR_EINGABEN' }
  /**
   * Beispielwerte für alle Listen des Aufbaus. Der Zufall steckt in der `saat`: Dieselbe
   * Action ergibt überall dieselben Werte.
   */
  /**
   * Gefüllt wird nur das Gewählte (Entscheidung des Nutzers vom 15.11.2026): das Manövrieren
   * (`laeufe`, fehlt = alle Läufe) oder einzelne Runden des Parallelslaloms.
   * `runden`: diese Runden des Parallelslaloms füllen – nur festgeschriebene.
   * `nurRunden`: das Manövrieren bleibt, wie es ist.
   * `nurLeere`: In den Runden werden nur Attempts ohne Werte gefüllt – sonst stünden nach dem
   * Füllen eines Halbfinales andere Werte in den Klassen, deren Finals schon auf ihrem
   * Halbfinale stehen.
   */
  | { type: 'FILL_BEISPIELWERTE'; zeitnahme: Zeitnahme; saat: number; laeufe?: number[]; runden?: ParallelRunde[]; nurRunden?: boolean; nurLeere?: boolean }
  /**
   * Beispiel-Besetzung: zwei bis drei erfundene Namen in jede Zelle der WKR-Einteilung, deren
   * Bogen gedruckt wird – je Parcours und Liste, unter einem Regelwerk mit Parallelslalom auch je
   * Racecourse (lib/beispieldaten.ts). Ersetzt, was dort stand; die Rückfrage stellt die
   * Oberfläche. Der Zufall steckt in der `saat`.
   */
  | { type: 'FILL_BEISPIEL_BESETZUNG'; saat: number }
  /**
   * Beispielgewichte: ein erfundenes Gewicht für jeden Starter um das Durchschnittsgewicht seiner
   * Klasse, ein Teil leichter (lib/beispieldaten.ts). Ersetzt vorhandene Gewichte; die Rückfrage
   * stellt die Oberfläche. Der Zufall steckt in der `saat`.
   */
  | { type: 'FILL_BEISPIELGEWICHTE'; saat: number }
  /**
   * Die erfassten Werte des Gewählten verwerfen: Läufe des Manövrierens (mit dem 1. Lauf auch die
   * Listen ohne Lauf, die Knoten – so, wie die Beispielwerte sie füllen) und/oder Runden des
   * Parallelslaloms (beide Attempts). Festgeschriebene Pläne bleiben. Bleibt danach kein Wert
   * übrig, gilt es wie `CLEAR_EINGABEN`.
   */
  | { type: 'CLEAR_EINGABEN_TEIL'; laeufe?: number[]; runden?: ParallelRunde[] }

export function wendeErfassungAn(state: AppState, action: ErfassungAenderung): AppState {
  switch (action.type) {
    case 'SET_EINGABEN': {
      // Zellen für unbekannte Starter oder kaputte Lauf-Schlüssel kommen gar nicht erst in den Stand.
      const zellen = gueltigeZellen(action.zellen, new Set(state.starters.map((p) => p.id)))
      const eingaben = setzeWerte(state.eingaben, zellen)
      return eingaben === state.eingaben ? state : { ...state, eingaben }
    }
    case 'CLEAR_EINGABEN':
      // Mit den Werten gehen die Abmeldungen: Das Starterfeld ist danach wieder frei.
      // Und die Runden nach dem Vorlauf: Sie stehen auf seinem Ergebnis, das es nicht mehr gibt.
      // Ebenso „Disziplin nicht werten“: Ohne Werte zählt ohnehin keine Disziplin.
      // Der Plan des Vorlaufs hängt an der Verzahnung und bleibt, solange sie festgeschrieben
      // ist; bei freigegebener Verzahnung entfällt er hier (in `reducer`, planung/parallelRunden.ts).
      return Object.keys(state.eingaben).length === 0 &&
        state.abgemeldet.length === 0 &&
        Object.keys(state.nichtWerten).length === 0 &&
        Object.keys(state.parallelPlaene).every((r) => r === VORLAUF) &&
        (state.verzahnungLocked || state.parallelPlaene[VORLAUF] === undefined)
        ? state
        : { ...state, eingaben: {}, abgemeldet: [], abgemeldetBis: {}, nichtWerten: {}, parallelPlaene: state.parallelPlaene[VORLAUF] ? { [VORLAUF]: state.parallelPlaene[VORLAUF] } : {} }
    case 'FILL_BEISPIELWERTE': {
      // Die Konfiguration ist eine reine Funktion des Stands – der Reducer bleibt deterministisch.
      const konfig = konfigVon(state)
      const zufall = zufallAus(action.saat)
      const eingaben = action.nurRunden ? state.eingaben : beispielEingaben(state, konfig, { zeitnahme: action.zeitnahme, laeufe: action.laeufe }, zufall)
      if (!hasParallel(state.regelwerk)) return { ...state, eingaben }
      const runden = action.runden ?? []
      return { ...state, eingaben: runden.reduce((e, runde) => beispielRunde({ ...state, eingaben: e }, konfig, runde, { zeitnahme: action.zeitnahme, nurLeere: action.nurLeere === true }, zufall), eingaben) }
    }
    case 'FILL_BEISPIEL_BESETZUNG': {
      const konfig = konfigVon(state)
      const zellen = einteilungsZellen(konfig, state, hasParallel(state.regelwerk) ? parallelListen(konfig) : [])
      const einteilung = beispielEinteilung(state.einteilung, zellen, zufallAus(action.saat))
      return einteilung === state.einteilung ? state : { ...state, einteilung }
    }
    case 'FILL_BEISPIELGEWICHTE': {
      if (state.starters.length === 0) return state
      return { ...state, starters: beispielGewichte(state.starters, (klasse) => sollgewichtOf(state.regelwerk, state.sollgewicht, klasse), zufallAus(action.saat)) }
    }
    case 'CLEAR_EINGABEN_TEIL': {
      const disziplin = konfigVon(state).getAufbau(state.aufbau).disziplin
      const weg = new Set<string>([
        ...(action.laeufe ?? []).flatMap((l) => [laufSchluessel(disziplin, l), ...(l === 1 ? [laufSchluessel(disziplin, OHNE_LAUF)] : [])]),
        ...(action.runden ?? []).flatMap((r) => [attemptSchluessel(r, 1), attemptSchluessel(r, 2)]),
      ])
      const bleibt = Object.entries(state.eingaben).filter(([schluessel]) => !weg.has(schluessel))
      if (bleibt.length === Object.keys(state.eingaben).length) return state
      // Bleibt nichts übrig, ist es dasselbe wie „Alle erfassten Werte löschen“ – mit Abmeldungen
      // und späteren Runden (den Plan des Vorlaufs nimmt `reducer` dann ebenso weg).
      // Der Aufruf geht direkt an den case, nicht über wendeAn() (reducer.ts): Dessen Sperren gelten
      // hier nicht. Das ist gleich, solange CLEAR_EINGABEN in keiner Sperrmenge steht – kommt es in
      // eine, hier mitziehen.
      if (bleibt.length === 0) return wendeErfassungAn(state, { type: 'CLEAR_EINGABEN' })
      // Wer abgemeldet ist, bleibt es: Sein X „nicht gestartet“ kommt in die gelöschten Läufe und
      // Runden zurück (lib/abmeldung.ts) – sonst stünde er dort als „noch offen“ da, obwohl er
      // als abgemeldet gilt, und Beispielwerte gäben ihm Zeiten.
      const konfig = konfigVon(state)
      let next: AppState = { ...state, eingaben: Object.fromEntries(bleibt) }
      const laeufe = (action.laeufe ?? []).filter((l) => l >= 1 && l <= Math.max(1, state.laufCount))
      for (const s of state.starters) if (laeufe.length > 0 && state.abgemeldet.includes(s.id)) next = { ...next, eingaben: mitAbmeldung(next, konfig, s, laeufe) }
      return action.runden && action.runden.length > 0 ? mitAbmeldungenInRunden(next, konfig, action.runden) : next
    }
  }
}
