// Erfassung: Werte setzen und löschen (alle oder Läufe/Runden); Beispielwerte, -Besetzung, -Gewichte, -Boote und -Co-Piloten aus der `saat`;
// Wiederholung nach Ausfall (26.11.2026, R11-11): die Werte eines abgebrochenen Versuchs verwerfen – und mit „Doch keine
// Wiederholung“ zurückholen (Prüfbefund 27.11.2026).

import type { AppState, BereichId, ParallelRunde, WkrPunkt, WkrVerworfen } from '../../types'
import { einteilungsZellen } from '../../lib/einteilung'
import { beispielBoote, beispielCoPiloten, beispielEinteilung, beispielGewichte } from '../../lib/beispieldaten'
import { besetzungsKlassen, coPilotKlassen } from '../../lib/besetzung'
import { parallelListen } from '../../lib/parallelBogen'
import { erfasstKennung, gueltigeZellen, laufSchluessel, listenFelder, OHNE_LAUF, setzeWerte, type EingabeZelle } from '../../lib/eingaben'
import { attemptSchluessel } from '../../lib/parallelSchluessel'
import { mitAbmeldung, mitAbmeldungenInRunden } from '../../lib/abmeldung'
import { beispielEingaben, beispielRunde, zufallAus, type Zeitnahme } from '../../lib/beispielwerte'
import { VORLAUF } from '../../planung/parallelRunden'
import { hasParallel, sollgewichtOf } from '../../config/catalog'
import { konfigVon } from './gemeinsam'
import { wkrOhneLaeufe, wkrOhneVersuch } from './wkr'
import { mitWiederholung, ohneWiederholung } from './betrieb'
import { laufPunkt, liesRef, rundenPunkt } from '../../betrieb/folge'
import { liesListe } from '../../wkr/liste'
import { giltFuerAlleVersuche } from '../../wkr/versuch'
import { keineZeitVon, kzSchluessel, mitKeineZeit } from '../../wkr/keineZeit'

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
   * Beispiel-Boote bzw. -Co-Piloten (Wunsch des Nutzers vom 19.11.2026): ein erfundener Bootsname
   * für jede Klasse der Veranstaltung, eine erfundene Person für jede Klasse, in der das Regelwerk
   * einen Co-Piloten vorsieht (lib/besetzung.ts besetzungsKlassen/coPilotKlassen). Ersetzt deren
   * Angaben; die Rückfrage stellt die Oberfläche. Der Zufall steckt in der `saat`.
   */
  | { type: 'FILL_BEISPIEL_BOOTE'; saat: number }
  | { type: 'FILL_BEISPIEL_CO_PILOTEN'; saat: number }
  /**
   * Die erfassten Werte des Gewählten verwerfen: Läufe des Manövrierens (mit dem 1. Lauf auch die
   * Listen ohne Lauf, die Knoten – so, wie die Beispielwerte sie füllen) und/oder Runden des
   * Parallelslaloms (beide Attempts). Festgeschriebene Pläne bleiben. Bleibt danach kein Wert
   * übrig, gilt es wie `CLEAR_EINGABEN`.
   */
  | { type: 'CLEAR_EINGABEN_TEIL'; laeufe?: number[]; runden?: ParallelRunde[] }
  /**
   * Wiederholung nach Ausfall (Nutzer 26.11.2026, R11-11): Die Wettkampfleitung hat für den gezeigten Start `ref` (Starter
   * und Lauf, betrieb/folge.ts refKey) eines Bereichs des Manövrierens eine Wiederholung entschieden. Die Werte dieses
   * Starters in diesem Lauf werden auf ALLEN Listen verworfen (samt Haken, Teilhaken, Disq., Bemerkung; Knoten haben
   * keinen Lauf und bleiben; die Zeile am Vorsteg mit „Versuche nacheinander“ gilt für alle Versuche und bleibt, WH6),
   * dazu was an ihnen in der WKR-Erfassung hing (reducer/wkr.ts wkrOhneVersuch). Der Betrieb führt den Start danach unter
   * „Wiederholung offen“ (reducer/betrieb.ts mitWiederholung) – EINE Action, damit Werte und Folge nie auseinanderlaufen.
   * Eine Action der Erfassung, nicht des Betriebs: „Der Betrieb schreibt nie in `eingaben`“ (Projektkarte, Ausnahme
   * 26.11.2026). Nur ein gezeigter, geltender Start eines nicht abgemeldeten Starters; sonst ändert sich nichts.
   */
  | { type: 'WIEDERHOLUNG_AUSFALL'; bereich: BereichId; ref: string }
  /**
   * „Doch keine Wiederholung“ (Nutzer 26.11.2026, R11-11, BETRIEB_ANNAHMEN.wiederholungAufheben; seit dem Prüfbefund
   * 27.11.2026 eine Action der Erfassung): Der zuletzt abgebrochene Versuch von `ref` gilt wieder (reducer/betrieb.ts
   * ohneWiederholung), und seine verworfenen Werte kommen zurück (WkrStand.verworfen) – nur in leere Zellen: Was seit dem
   * Ausfall eingetragen wurde, bleibt (nie still überschreiben). Rückfragen, Vorschläge und Papier-Vermerke von damals
   * kommen nicht zurück. Nur, solange der Start auf seine Wiederholung wartet; sonst ändert sich nichts. Nur am
   * Bedienrechner (nicht in der Positivliste des Freigabe-Handys, geraete/aufgaben.ts).
   */
  | { type: 'WIEDERHOLUNG_AUFHEBEN'; bereich: BereichId; ref: string }

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
      // Ebenso Rückfragen, Vorschläge und Abschlüsse der WKR-Geräte (W1): Sie betreffen Werte, die es nicht mehr gibt.
      // Modus und Status der Listen bleiben – sie gehören zur Organisation, nicht zu den Werten.
      return Object.keys(state.eingaben).length === 0 &&
        state.abgemeldet.length === 0 &&
        Object.keys(state.nichtWerten).length === 0 &&
        Object.keys(state.parallelPlaene).every((r) => r === VORLAUF) &&
        (state.verzahnungLocked || state.parallelPlaene[VORLAUF] === undefined) &&
        wkrOhneLaeufe(state.wkr, () => true, () => true) === state.wkr
        ? state
        : {
            ...state,
            eingaben: {},
            abgemeldet: [],
            abgemeldetBis: {},
            nichtWerten: {},
            parallelPlaene: state.parallelPlaene[VORLAUF] ? { [VORLAUF]: state.parallelPlaene[VORLAUF] } : {},
            wkr: wkrOhneLaeufe(state.wkr, () => true, () => true),
          }
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
      return { ...state, starters: beispielGewichte(state.starters, (klasse) => sollgewichtOf(state.regelwerk, state.sollgewicht, klasse), zufallAus(action.saat), state.ausgleichStufe) }
    }
    case 'FILL_BEISPIEL_BOOTE': {
      const klassen = besetzungsKlassen(state)
      return klassen.length === 0 ? state : { ...state, boote: beispielBoote(state.boote, klassen, zufallAus(action.saat)) }
    }
    case 'FILL_BEISPIEL_CO_PILOTEN': {
      const klassen = coPilotKlassen(state)
      return klassen.length === 0 ? state : { ...state, coPiloten: beispielCoPiloten(state.coPiloten, klassen, zufallAus(action.saat)) }
    }
    case 'WIEDERHOLUNG_AUSFALL': {
      const r = liesRef(action.ref)
      if (r?.art !== 'm') return state
      const starter = state.starters.find((s) => s.id === r.starter)
      // Abgemeldet (WH10): Das X käme beim Leeren nicht zurück – der Start stünde offen da, obwohl er nicht startet.
      if (!starter || state.abgemeldet.includes(starter.id)) return state
      const betrieben = mitWiederholung(state, action.bereich, action.ref)
      if (betrieben === state) return state
      const konfig = konfigVon(state)
      const lauf = laufSchluessel(konfig.getAufbau(state.aufbau).disziplin, r.lauf)
      // Die Zeile am Vorsteg mit „Versuche nacheinander“ gilt für alle Versuche (WH6): ihre Felder und ihr Haken bleiben.
      const alleVersuche = new Set(konfig.getPositions().filter((p) => giltFuerAlleVersuche(state, konfig, p.typeId)).map((p) => p.typeId))
      const bleibt = new Set([...alleVersuche].flatMap((typeId) => [...listenFelder(konfig, typeId, starter.klasse).map((f) => f.kennung), erfasstKennung(typeId)]))
      const werte = state.eingaben[lauf]?.[starter.id] ?? {}
      const eingaben = setzeWerte(
        state.eingaben,
        Object.keys(werte)
          .filter((feld) => !bleibt.has(feld))
          .map((feld) => ({ lauf, starter: starter.id, feld, wert: '' })),
      )
      const ohne = wkrOhneVersuch(state.wkr, { lauf, starter: starter.id, ref: action.ref }, (kennung) => alleVersuche.has(liesListe(kennung)?.typeId ?? ''))
      // Was verworfen wird, merkt sich die Erfassung, solange der Abbruch steht – für „Doch keine Wiederholung“
      // (Prüfbefund 27.11.2026). Ein zweiter Ausfall desselben Starts ersetzt den ersten: Der ist dann endgültig vorbei.
      const kz = kzSchluessel(lauf, starter.id)
      const keineZeit = Object.fromEntries(Object.entries(state.wkr.keineZeit).flatMap(([liste, jeZelle]) => (Object.hasOwn(jeZelle, kz) ? [[liste, { ...jeZelle[kz] }]] : [])))
      const verworfen: WkrVerworfen = {
        bereich: action.bereich,
        ref: action.ref,
        lauf,
        starter: starter.id,
        werte: Object.fromEntries(Object.entries(werte).filter(([feld, wert]) => !bleibt.has(feld) && wert !== '')),
        keineZeit,
      }
      const wkr = { ...ohne, verworfen: [...(ohne.verworfen ?? []).filter((v) => !(v.bereich === action.bereich && v.ref === action.ref)), verworfen] }
      return { ...betrieben, eingaben, wkr }
    }
    case 'WIEDERHOLUNG_AUFHEBEN': {
      const betrieben = ohneWiederholung(state, action.bereich, action.ref)
      if (betrieben === state) return state
      const v = (state.wkr.verworfen ?? []).find((x) => x.bereich === action.bereich && x.ref === action.ref)
      if (!v) return betrieben
      // Nur in leere Zellen: Was seit dem Ausfall eingetragen wurde, ist jünger (nie still überschreiben).
      const jetzt = state.eingaben[v.lauf]?.[v.starter] ?? {}
      const zellen = gueltigeZellen(
        Object.entries(v.werte)
          .filter(([feld]) => (jetzt[feld] ?? '') === '')
          .map(([feld, wert]) => ({ lauf: v.lauf, starter: v.starter, feld, wert })),
        new Set(state.starters.map((p) => p.id)),
      )
      const eingaben = setzeWerte(state.eingaben, zellen)
      // „Keine Zeit“ nur, wo die Liste für diesen Start keins hat und das Feld leer ist.
      let keineZeit = state.wkr.keineZeit
      for (const [liste, felder] of Object.entries(v.keineZeit)) {
        if (Object.keys(keineZeitVon(state.wkr, liste, v.lauf, v.starter)).length > 0) continue
        const frei = Object.fromEntries(Object.entries(felder).filter(([feld]) => (jetzt[feld] ?? '') === ''))
        if (Object.keys(frei).length > 0) keineZeit = mitKeineZeit(keineZeit, liste, v.lauf, v.starter, frei)
      }
      const rest = (state.wkr.verworfen ?? []).filter((x) => x !== v)
      const { verworfen: _weg, ...wkrOhne } = state.wkr
      return { ...betrieben, eingaben, wkr: { ...wkrOhne, keineZeit, ...(rest.length > 0 ? { verworfen: rest } : {}) } }
    }
    case 'CLEAR_EINGABEN_TEIL': {
      const disziplin = konfigVon(state).getAufbau(state.aufbau).disziplin
      const weg = new Set<string>([
        ...(action.laeufe ?? []).flatMap((l) => [laufSchluessel(disziplin, l), ...(l === 1 ? [laufSchluessel(disziplin, OHNE_LAUF)] : [])]),
        ...(action.runden ?? []).flatMap((r) => [attemptSchluessel(r, 1), attemptSchluessel(r, 2)]),
      ])
      const bleibt = Object.entries(state.eingaben).filter(([schluessel]) => !weg.has(schluessel))
      // Rückfragen, Vorschläge und Abschlüsse der WKR-Geräte zu diesen Läufen und Runden gehen mit (W1).
      // Lauf 1 nimmt die Listen ohne Lauf mit (wie oben die Eingaben) – also auch den Abschluss `ohne` (W5.3, 22.11.2026).
      const punkte = new Set<WkrPunkt>([
        ...(action.laeufe ?? []).flatMap((l): WkrPunkt[] => [laufPunkt(l), ...(l === 1 ? ['ohne' as const] : [])]),
        ...(action.runden ?? []).map(rundenPunkt),
      ])
      const wkr = wkrOhneLaeufe(state.wkr, (lauf) => weg.has(lauf), (punkt) => punkte.has(punkt))
      if (bleibt.length === Object.keys(state.eingaben).length) return wkr === state.wkr ? state : { ...state, wkr }
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
      let next: AppState = { ...state, eingaben: Object.fromEntries(bleibt), wkr }
      const laeufe = (action.laeufe ?? []).filter((l) => l >= 1 && l <= Math.max(1, state.laufCount))
      for (const s of state.starters) if (laeufe.length > 0 && state.abgemeldet.includes(s.id)) next = { ...next, eingaben: mitAbmeldung(next, konfig, s, laeufe) }
      return action.runden && action.runden.length > 0 ? mitAbmeldungenInRunden(next, konfig, action.runden) : next
    }
  }
}
