import { computed, type ComputedRef } from 'vue'
import { useStore } from '../state/store'
import { locale } from '../i18n'
import { configFor, type Konfig } from '../config/konfig'
import type { AppState, Sprache } from '../types'
import { useListenSprache, wkrSpracheAller, wkrSpracheFuer } from './listensprache'

/**
 * Die Konfiguration zum Stand der Veranstaltung: Regelwerk, eigene Aufbauten und Bezeichnung
 * der Bojen-Seiten kommen aus dem Store. Weil `configFor` rein ist, genügt ein `computed` –
 * ein Wechsel des Regelwerks oder ein neuer eigener Aufbau wirkt von selbst überall, ohne
 * dass eine Ansicht etwas neu laden müsste.
 *
 * Die Sprache ist die des Regelwerks (lib/listensprache.ts): für Wertungslisten, Laufzettel,
 * den Aushang der Codes und die Namen der Listen in den Einstellungen und der WKR-Einteilung.
 * Nur die Wettkampfrichter-Bögen selbst haben ihre Sprache je Parcours und Liste – siehe
 * {@link useBogenKonfig}.
 *
 * `oberflaeche`: für die Erfassung. Sie ist Bedienung, gedruckt wird dort nichts – ihre
 * Spaltenköpfe stehen wie alles um sie herum in der Sprache der Oberfläche (soweit das
 * Regelwerk sie hat; sonst deutsch). Die Bögen, von denen abgetippt wird, können je Parcours
 * und Liste eine andere Sprache haben; die Spalten sind in jeder dieselben.
 *
 * Die Bezeichnung der Bojen-Seiten gilt immer: Die Erfassung tippt vom Bogen ab und muss
 * dieselben Köpfe zeigen. Die Wertungslisten nennen die Bojen unabhängig davon R und L
 * (lib/ergebnis.ts).
 */
export function useKonfig(optionen: { oberflaeche?: boolean } = {}): ComputedRef<Konfig> {
  const { state } = useStore()
  const { listenLocale } = useListenSprache()
  return computed(() =>
    configFor({
      regelwerk: state.value.regelwerk,
      sprache: optionen.oberflaeche ? locale.value : listenLocale.value,
      beschriftung: state.value.beschriftung,
      eigeneAufbauten: state.value.eigeneAufbauten,
    }),
  )
}

/**
 * Die Konfiguration, mit der der Bogen einer Liste auf einem Parcours (im Parallelslalom: auf
 * einem Racecourse) gezeichnet wird: wie {@link useKonfig}, aber in der Sprache, die dort für
 * diese Liste gewählt ist (deutsch, englisch, zweisprachig). Aufbau, Spalten und Kennungen sind
 * in jeder Sprache dieselben – nur die Texte wechseln. `configFor` merkt sich jede Fassung;
 * mehr als drei entstehen nicht. Reaktiv, wenn in einem `computed` oder in der Vorlage aufgerufen.
 */
export function useBogenKonfig(): (typeId: string, parcoursId: string | undefined) => Konfig {
  const { state } = useStore()
  return (typeId, parcoursId) => konfigIn(state.value, wkrSpracheFuer(state.value, parcoursId, typeId))
}

/**
 * Wie {@link useBogenKonfig}, für eine Auswahl, die eine Liste über mehrere Parcours
 * zusammenfasst: in der Sprache ihrer Bögen, wenn alle Parcours dieselbe haben, sonst in der
 * des Regelwerks (lib/listensprache.ts `wkrSpracheAller`).
 */
export function useAuswahlKonfig(): (typeId: string, parcoursIds: readonly string[]) => Konfig {
  const { state } = useStore()
  return (typeId, parcoursIds) => konfigIn(state.value, wkrSpracheAller(state.value, parcoursIds, typeId))
}

const konfigIn = (stand: Pick<AppState, 'regelwerk' | 'beschriftung' | 'eigeneAufbauten'>, sprache: Sprache) =>
  configFor({ regelwerk: stand.regelwerk, sprache, beschriftung: stand.beschriftung, eigeneAufbauten: stand.eigeneAufbauten })
