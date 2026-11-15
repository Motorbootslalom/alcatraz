<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../state/store'
import { hatFlaggen } from '../domain/flaggen'
import { ORIGIN_STYLES, wirksamerStil } from '../lib/origin'
import { t } from '../i18n'
import type { ErgebnisHerkunft, OriginStyle } from '../types'

/**
 * Auswahl, wie die Herkunft auf einer Liste steht: ausgeschrieben, als Kürzel, mit Flagge –
 * dieselbe Auswahl für Starterlisten, Wertungslisten (dort zusätzlich „nicht zeigen“) und
 * Pokalauswertung. Flaggen gibt es nur für Bundesland und Land: Für Vereine sind die
 * Flaggen-Darstellungen nicht wählbar, und gezeigt wird, was dann tatsächlich gilt.
 */
const props = defineProps<{
  wert: ErgebnisHerkunft
  /** Auch „nicht zeigen“ anbieten (Wertungslisten). */
  mitAus?: boolean
  id?: string
}>()
const emit = defineEmits<{ wahl: [wert: ErgebnisHerkunft] }>()

const { state } = useStore()
const flaggen = computed(() => hatFlaggen(state.value.originMode))
const gezeigt = computed(() => (props.wert === 'aus' ? 'aus' : wirksamerStil(props.wert, state.value.originMode)))
const mitFlagge = (stil: OriginStyle) => stil.startsWith('flagge')
</script>

<template>
  <select :id="id" class="input" :value="gezeigt" @change="emit('wahl', ($event.target as HTMLSelectElement).value as ErgebnisHerkunft)">
    <option v-if="mitAus" value="aus">{{ t('origin.style.aus') }}</option>
    <option v-for="stil in ORIGIN_STYLES" :key="stil" :value="stil" :disabled="mitFlagge(stil) && !flaggen">{{ t(`origin.style.${stil}`) }}</option>
  </select>
</template>
