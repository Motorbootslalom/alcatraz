<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { verborgeneZellen } from '../lib/eingaben'
import { t, tn } from '../i18n'

/**
 * Warnt, wenn im Stand erfasste Werte liegen, die keine Liste mehr zeigt (lib/eingaben.ts
 * `verborgeneZellen`): nach einem Wechsel des Aufbaus oder der Klasse, oder wenn die Zahl der
 * Läufe verringert wurde. Solche Werte können weiter in die Wertung eingehen, ohne dass man
 * sie in der Erfassung sieht – deshalb steht der Hinweis überall, wo erfasst, gewertet oder
 * eingestellt wird, und bietet an, sie zu entfernen.
 */
const { state, dispatch } = useStore()
const konfig = useKonfig({ einsprachig: true })

const zellen = computed(() => verborgeneZellen(state.value, konfig.value))
const starter = computed(() => new Set(zellen.value.map((z) => z.starter)).size)

function entfernen() {
  if (!confirm(t('entries.hidden.confirm', { n: zellen.value.length }))) return
  dispatch({ type: 'SET_EINGABEN', zellen: zellen.value.map((z) => ({ ...z, wert: '' })) })
}
</script>

<template>
  <p v-if="zellen.length > 0" class="boat-banner warn no-print" role="alert" data-hinweis="verborgene-eingaben">
    {{ tn('entries.hidden', zellen.length, { n: starter, cells: zellen.length }) }}
    <button type="button" class="btn" data-action="verborgene-entfernen" @click="entfernen">{{ t('entries.hidden.remove') }}</button>
  </p>
</template>
