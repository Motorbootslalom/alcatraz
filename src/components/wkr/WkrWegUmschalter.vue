<script setup lang="ts">
import type { Weg } from '../../wkr/bojen'
import { useWkrText } from './texte'

/**
 * Umschalter Hinweg/Rückweg der Bojen-Maske (W4.2, Plan docs/plan-wkr-w4.md §5.1/§5.2, P8, 21.11.2026): zwei große
 * Reiter (≥ 64 px, `data-ziel="gross"`) mit der Zahl der Einträge je Seite – so sieht der WKR auch, was auf der
 * verdeckten Seite steht. Er wechselt NIE von selbst (auch nicht nach Tor 5): Die Seite wählt nur der Tipp; WkrMaske
 * merkt sie je Start (gedaechtnis.ts `wege`), ein neuer Start beginnt auf „Hinweg“.
 */
defineProps<{ weg: Weg; zahlen: Record<Weg, number> }>()
const emit = defineEmits<{ waehle: [weg: Weg] }>()
const { w } = useWkrText()
const WEGE: Weg[] = ['hin', 'rueck']
</script>

<template>
  <nav class="wkr-bojen-weg" role="tablist" :aria-label="w('wkr.geraet.bojen.weg')" data-teil="weg-umschalter">
    <button
      v-for="x in WEGE"
      :key="x"
      type="button"
      role="tab"
      class="wkr-knopf wkr-bojen-weg-knopf"
      data-ziel="gross"
      data-action="weg"
      :data-weg="x"
      :data-anzahl="zahlen[x]"
      :aria-selected="weg === x"
      @click="emit('waehle', x)"
    >
      {{ w(x === 'hin' ? 'wkr.geraet.bojen.hinweg' : 'wkr.geraet.bojen.rueckweg') }} · {{ zahlen[x] }}
    </button>
  </nav>
</template>
