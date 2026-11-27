import { computed } from 'vue'
import { useStore } from '../state/store'
import { besetzungsKlassen, besetzungText, coPilotKlassen, coPilotKlassenBesetzt } from './besetzung'
import { neueSaat } from './saat'
import { tn } from '../i18n'

/**
 * Knöpfe „Beispiel-Boote“ und „Beispiel-Co-Piloten“ (Wunsch des Nutzers vom 19.11.2026), Zählung und
 * Rückfrage. Seit 21.11.2026 nur noch unter „Beispieldaten“ (BeispieldatenPanel.vue) neben der
 * Beispiel-Besetzung der WKR – nicht mehr im Block „Besetzung“: Beispielwerte entstehen an EINER Stelle
 * (Wunsch des Nutzers). Eigene Datei, weil Zählung und Rückfrage so vom Panel getrennt testbar bleiben.
 * Was schon eingetragen ist, wird nie still ersetzt – wie bei den übrigen Beispieldaten erst nach
 * Rückfrage. Gefüllt werden dieselben Klassen, die der Reducer füllt (lib/besetzung.ts
 * besetzungsKlassen/coPilotKlassen).
 */
export function useBeispielBoote() {
  const { state, dispatch } = useStore()
  const bootKlassen = computed(() => besetzungsKlassen(state.value))
  const coKlassen = computed(() => coPilotKlassen(state.value))
  const booteDa = computed(() => bootKlassen.value.filter((k) => besetzungText(state.value.boote, k) !== '').length)
  // Seit 26.11.2026 (R11-07) zählt auch eine Klasse, in der nur ein Ersatz oder ein Gewicht steht: Das Beispiel ersetzt beide.
  const coPilotenDa = computed(() => coPilotKlassenBesetzt(state.value.coPiloten, coKlassen.value))

  function beispielBoote() {
    if (booteDa.value > 0 && !confirm(tn('crew.sample.boatsConfirm', booteDa.value))) return
    dispatch({ type: 'FILL_BEISPIEL_BOOTE', saat: neueSaat() })
  }

  function beispielCoPiloten() {
    if (coPilotenDa.value > 0 && !confirm(tn('crew.sample.coPilotsConfirm', coPilotenDa.value))) return
    dispatch({ type: 'FILL_BEISPIEL_CO_PILOTEN', saat: neueSaat() })
  }

  return { bootKlassen, coKlassen, beispielBoote, beispielCoPiloten }
}
