import { computed, type ComputedRef } from 'vue'
import { useStore } from '../state/store'
import { configFor, type Konfig } from '../config/konfig'

/**
 * Die Konfiguration der Wettkampfrichter-Listen zum Stand der Veranstaltung: Regelwerk
 * und eigene Aufbauten kommen aus dem Store. Weil `configFor` rein ist, genügt ein
 * `computed` – ein Wechsel des Regelwerks oder ein neuer eigener Aufbau wirkt von selbst
 * überall, ohne dass eine Ansicht etwas neu laden müsste.
 *
 * Sprache und Bezeichnungs-Schema der Listen stehen noch nicht im Stand; bis die Listen
 * selbst kommen, gelten die Vorgaben (deutsch, erstes Schema).
 */
export function useKonfig(): ComputedRef<Konfig> {
  const { state } = useStore()
  return computed(() => configFor({ regelwerk: state.value.regelwerk, eigeneAufbauten: state.value.eigeneAufbauten }))
}
