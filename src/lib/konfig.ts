import { computed, type ComputedRef } from 'vue'
import { useStore } from '../state/store'
import { configFor, type Konfig } from '../config/konfig'
import { useListenSprache } from './listensprache'

/**
 * Die Konfiguration der Wettkampfrichter-Listen zum Stand der Veranstaltung: Regelwerk,
 * eigene Aufbauten, Bezeichnung der Bojen-Seiten und Sprache der Listen kommen aus dem
 * Store. Weil `configFor` rein ist, genügt ein `computed` – ein Wechsel des Regelwerks oder
 * ein neuer eigener Aufbau wirkt von selbst überall, ohne dass eine Ansicht etwas neu laden
 * müsste.
 *
 * Die Sprache kommt aus lib/listensprache.ts (sie wirkt nur, wo das Regelwerk Englisch
 * anbietet). `einsprachig`: für alles, was nicht der Bogen selbst ist – Ergebnislisten und
 * die Tabelle der Erfassung. Dort stünden zweisprachige Spaltenköpfe („Tor 1 / Gate 1“) in
 * Spalten, die gerade zwei Ziffern breit sind; es gilt die eine Sprache der übrigen Listen.
 *
 * Die Bezeichnung der Bojen-Seiten gilt immer: Die Erfassung tippt vom Bogen ab und muss
 * dieselben Köpfe zeigen. Die Ergebnislisten nennen die Bojen unabhängig davon R und L
 * (lib/ergebnis.ts).
 */
export function useKonfig(optionen: { einsprachig?: boolean } = {}): ComputedRef<Konfig> {
  const { state } = useStore()
  const { bogenSprache, listenLocale } = useListenSprache()
  return computed(() =>
    configFor({
      regelwerk: state.value.regelwerk,
      sprache: optionen.einsprachig ? listenLocale.value : bogenSprache.value,
      beschriftung: state.value.beschriftung,
      eigeneAufbauten: state.value.eigeneAufbauten,
    }),
  )
}
