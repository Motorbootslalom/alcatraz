import { computed, type ComputedRef } from 'vue'
import { useStore } from '../state/store'
import { configFor, type Konfig } from '../config/konfig'
import { listenSprache } from './listensprache'

/**
 * Die Konfiguration der Wettkampfrichter-Listen zum Stand der Veranstaltung: Regelwerk
 * und eigene Aufbauten kommen aus dem Store. Weil `configFor` rein ist, genügt ein
 * `computed` – ein Wechsel des Regelwerks oder ein neuer eigener Aufbau wirkt von selbst
 * überall, ohne dass eine Ansicht etwas neu laden müsste.
 *
 * Die Sprache der Listen kommt aus lib/listensprache.ts (vorerst die der Oberfläche; sie
 * wirkt nur, wo das Regelwerk Englisch anbietet). Das Bezeichnungs-Schema steht noch nicht
 * im Stand, es gilt das erste.
 */
export function useKonfig(): ComputedRef<Konfig> {
  const { state } = useStore()
  return computed(() => configFor({ regelwerk: state.value.regelwerk, sprache: listenSprache.value, eigeneAufbauten: state.value.eigeneAufbauten }))
}
