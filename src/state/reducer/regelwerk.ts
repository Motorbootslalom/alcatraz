// Regelwerk und Aufbau mit dem, was an ihnen hängt: eigene Aufbauten, Tor 5, zusätzliche Listen, Versuche nacheinander.

import type { AppState } from '../../types'
import type { RawAufbau } from '../../config/schema'
import { normalisiereZusatzListen, vorgabeListenVon } from '../../lib/listen'
import { streichlaeufeVon } from '../../lib/ergebnis'
import { mitVorlaufPlan } from '../../planung/parallelRunden'
import { aufbauOf, hasParallel, regelwerkOf } from '../../config/catalog'
import { streichlaeufeWert } from './wertung'

export type RegelwerkAenderung =
  | { type: 'SET_REGELWERK'; regelwerk: string }
  | { type: 'SET_AUFBAU'; aufbau: string }
  /**
   * Die eigenen Aufbauten als Ganzes ersetzen (anlegen, ändern, löschen, einspielen). Die
   * Action bringt die fertige, geprüfte Liste mit; mit `aufbau` wird zugleich dorthin
   * gewechselt. Gibt es den gewählten Aufbau danach nicht mehr, gilt wieder die Vorgabe.
   */
  | { type: 'SET_EIGENE_AUFBAUTEN'; aufbauten: RawAufbau[]; aufbau?: string }
  /**
   * „Tor 5 übernimmt die Parcoursüberwachung“. Was zur Liste Tor 5 gehört (Disq., Bemerkung,
   * Haken „erfasst“, Name des Wettkampfrichters), zieht dabei auf die zusammengelegte Liste
   * um und beim Abschalten zurück.
   */
  | { type: 'SET_TOR5_MIT_PARCOURS'; on: boolean }
  /** „Versuche direkt nacheinander“ – nur unter einem Regelwerk, das den Schalter kennt. */
  | { type: 'SET_VERSUCHE_NACHEINANDER'; on: boolean }
  /** Eine zusätzliche Liste außerhalb des Aufbaus an- oder abwählen (lib/listen.ts). */
  | { type: 'SET_ZUSATZ_LISTE'; liste: string; an: boolean }

export function wendeRegelwerkAn(state: AppState, action: RegelwerkAenderung): AppState {
  switch (action.type) {
    case 'SET_REGELWERK': {
      const regelwerk = regelwerkOf(action.regelwerk).id
      // Ohne Parallelslalom kann er auch nicht die Reihenfolge der Nummern vorgeben.
      const source = hasParallel(regelwerk) ? state.runningNumbers.source : 'manoever'
      // „Versuche direkt nacheinander“ folgt beim Wechsel der Vorgabe des neuen Regelwerks
      // (UIM: an, Regel 960 Pkt. 4.3.2); kennt es den Schalter nicht, ist er aus. Ein Klick auf
      // das schon gewählte Regelwerk verstellt nichts.
      const versucheNacheinander = regelwerk === state.regelwerk ? state.versucheNacheinander : regelwerkOf(regelwerk).versucheNacheinander === true
      // Kommt der Parallelslalom bei festgeschriebener Verzahnung erst mit dem Regelwerk dazu,
      // wird sein Plan jetzt festgeschrieben; ein schon vorhandener bleibt.
      const next = mitVorlaufPlan({ ...state, regelwerk, versucheNacheinander, runningNumbers: { ...state.runningNumbers, source } }, hasParallel(regelwerk))
      // Die Wahl des Regelwerks stellt Läufe und Streichläufe so, wie es sie vorsieht (YAML
      // `wertungslaeufe`: DM 3 Läufe/1 gestrichen, UIM 2/1) – nur beim Wechsel, damit ein Klick
      // auf das schon gewählte Regelwerk nichts verstellt, was der Rennleiter von Hand gesetzt
      // hat. Schon erfasste Werte eines Laufs, den es danach nicht mehr gibt, bleiben wie beim
      // Ändern der Laufzahl im Stand; „Einstellungen → Wertung“ weist auf sie hin.
      const soll = regelwerkOf(regelwerk).wertungslaeufe
      if (!soll || regelwerk === state.regelwerk) return next
      // „Nach Regel“ bleibt stehen, wenn es dasselbe ergibt – sonst die Zahl.
      const auto = streichlaeufeVon(soll.laeufe, 'auto', soll.nachRegel) === soll.streichlaeufe
      return { ...next, laufCount: soll.laeufe, streichlaeufe: auto ? 'auto' : streichlaeufeWert(soll.streichlaeufe) }
    }

    // Was an der Liste für Tor 5 hängt, zieht in `reducer` mit (state/tor5.ts) – bei jedem
    // der drei Wege, auf denen sie wechselt.
    case 'SET_AUFBAU':
      return { ...state, aufbau: aufbauOf(action.aufbau, state.eigeneAufbauten).id }

    case 'SET_EIGENE_AUFBAUTEN':
      return {
        ...state,
        eigeneAufbauten: action.aufbauten,
        aufbau: aufbauOf(action.aufbau ?? state.aufbau, action.aufbauten).id,
      }

    case 'SET_TOR5_MIT_PARCOURS':
      return action.on === state.tor5MitParcours ? state : { ...state, tor5MitParcours: action.on }

    case 'SET_ZUSATZ_LISTE': {
      const { [action.liste]: _alt, ...rest } = normalisiereZusatzListen(state.zusatzListen)
      // Nur die Abweichung von der Vorgabe des Regelwerks steht im Stand.
      const vorgabe = vorgabeListenVon(regelwerkOf(state.regelwerk), aufbauOf(state.aufbau, state.eigeneAufbauten).disziplin).includes(action.liste)
      const zusatzListen = action.an === vorgabe ? rest : { ...rest, [action.liste]: action.an }
      return JSON.stringify(zusatzListen) === JSON.stringify(state.zusatzListen) ? state : { ...state, zusatzListen }
    }

    case 'SET_VERSUCHE_NACHEINANDER':
      // Ohne den Schalter im Regelwerk gibt es nichts zu stellen.
      return regelwerkOf(state.regelwerk).versucheNacheinander === undefined || action.on === state.versucheNacheinander ? state : { ...state, versucheNacheinander: action.on }
  }
}
