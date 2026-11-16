<script setup lang="ts">
import { computed } from 'vue'
import type { OeffentlicheSicht, SichtStart } from '../../types'
import { t } from '../../i18n'

/**
 * Starts vor dem Zeiger, die noch nicht dran waren – Nachmeldung, entferntes X, verpasster Lauf
 * (BETRIEB_ANNAHMEN.nachzueglerNachzuholen). Sie kommen nie von selbst als Nächstes; hier zeigt die
 * Start-Freigabe einen gezielt („Jetzt zeigen“). Ab E2 auch „als Nächster“ / „ans Ende des Laufs“.
 * Liest nur die öffentliche Sicht, Bedienung in der Sprache der Oberfläche.
 */
const props = defineProps<{
  sicht: OeffentlicheSicht
  eintraege: readonly SichtStart[]
  gesperrt?: boolean
}>()
const emit = defineEmits<{ zeigen: [key: string] }>()

const zeilen = computed(() =>
  props.eintraege.map((e) => {
    const p = props.sicht.starter[e.starter]
    const klasse = p ? props.sicht.klassen[p.klasse] : undefined
    return { key: e.key, startNr: p?.startNr || '–', name: p?.name ?? '', was: [klasse ? t('common.class', { id: klasse.name }) : '', t('betrieb.lauf', { n: e.lauf })].filter(Boolean).join(' · ') }
  }),
)
</script>

<template>
  <div v-if="zeilen.length > 0" class="betrieb-nachzuholen" data-teil="nachzuholen">
    <h4>{{ t('betrieb.nachzuholen') }} ({{ zeilen.length }})</h4>
    <p class="note">{{ t('betrieb.nachzuholen.hint') }}</p>
    <ul>
      <li v-for="z in zeilen" :key="z.key" :data-start="z.key">
        <span class="betrieb-start">
          <b>{{ z.startNr }}</b>
          <span v-if="z.name">{{ z.name }}</span>
          <span class="note">{{ z.was }}</span>
        </span>
        <button type="button" class="btn sm" data-action="nachzuholen-zeigen" :disabled="gesperrt" @click="emit('zeigen', z.key)">{{ t('betrieb.nachzuholen.zeigen') }}</button>
      </li>
    </ul>
  </div>
</template>
