<script setup lang="ts">
import { computed } from 'vue'
import type { OeffentlicheSicht, SichtBereich, SichtStart } from '../../types'
import { t } from '../../i18n'
import { startZeile, tBereich } from './texte'

/**
 * Starts, die wieder eingereiht werden (B-4, BETRIEB_EINREIHEN nimmt genau diese):
 * - `zurueckgestellt` (B-3): kurzfristig verhindert, fahren vorerst nicht, bleiben sichtbar;
 * - `nachzuholen`: überholt, ohne dran gewesen zu sein – Nachmeldung, entferntes X, verpasster Lauf
 *   (BETRIEB_ANNAHMEN.nachzueglerNachzuholen); sie kommen nie von selbst als Nächstes.
 * Je Start „Jetzt zeigen“ (gezielt, B-5), „Als Nächster“ und „Ans Ende des Laufs“. Drei Knöpfe statt eines
 * Menüs: Am Steg ist das ein Griff, und keiner davon ist unumkehrbar. Liest nur die öffentliche Sicht,
 * Bedienung in der Sprache der Oberfläche. Im Parallelslalom („Ans Ende der Runde“) holt das Einreihen die wartenden
 * Attempts desselben Paares mit (BETRIEB_ANNAHMEN.parallelPaarAlsEinheit, im Reducer).
 */
const props = defineProps<{
  sicht: OeffentlicheSicht
  /** Nur für die Wörter (Lauf bzw. Runde). */
  bereich?: Pick<SichtBereich, 'art'>
  eintraege: readonly SichtStart[]
  art: 'zurueckgestellt' | 'nachzuholen'
  gesperrt?: boolean
}>()
const emit = defineEmits<{ zeigen: [key: string]; einreihen: [key: string, wo: 'naechster' | 'ende'] }>()

const zeilen = computed(() => props.eintraege.map((e) => startZeile(props.sicht, e)))
</script>

<template>
  <div v-if="zeilen.length > 0" class="betrieb-liste" :data-teil="art">
    <h4>{{ t(`betrieb.${art}`) }} ({{ zeilen.length }})</h4>
    <p class="note">{{ t(`betrieb.${art}.hint`) }}</p>
    <ul>
      <li v-for="z in zeilen" :key="z.key" :data-start="z.key">
        <span class="betrieb-start">
          <b>{{ z.startNr }}</b>
          <span v-if="z.name">{{ z.name }}</span>
          <span class="note">{{ z.was }}</span>
        </span>
        <span class="betrieb-zeilen-knoepfe">
          <button type="button" class="btn sm" :data-action="`${art}-zeigen`" :disabled="gesperrt" @click="emit('zeigen', z.key)">{{ t('betrieb.jetztZeigen') }}</button>
          <button type="button" class="btn sm" data-action="einreihen-naechster" :disabled="gesperrt" @click="emit('einreihen', z.key, 'naechster')">{{ t('betrieb.einreihen.naechster') }}</button>
          <button type="button" class="btn sm" data-action="einreihen-ende" :disabled="gesperrt" :title="tBereich(bereich, 'betrieb.einreihen.ende.title')" @click="emit('einreihen', z.key, 'ende')">
            {{ tBereich(bereich, 'betrieb.einreihen.ende') }}
          </button>
        </span>
      </li>
    </ul>
  </div>
</template>
