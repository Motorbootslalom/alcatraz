<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../state/store'
import { starterfeldFest } from '../lib/eingaben'
import { adresse } from '../lib/router'
import { t } from '../i18n'

// Sobald Ergebnisse erfasst sind, steht das Starterfeld fest (lib/eingaben.ts
// `starterfeldFest`; der Reducer hält sich daran). Dieser Hinweis steht überall dort, wo ein
// Knopf deshalb nicht mehr geht: Er sagt, warum – und wie sich die Sperre lösen lässt.
const { state } = useStore()
const fest = computed(() => starterfeldFest(state.value))
</script>

<template>
  <p v-if="fest" class="boat-banner warn" data-hinweis="starter-gesperrt" role="status">
    {{ t('lock.text') }} {{ t('lock.fix') }}
    <a :href="adresse('veranstaltung', { ziel: 'werte' })">{{ t('lock.clear') }}</a> {{ t('lock.or') }}
    <a :href="adresse('einstellungen', { ziel: 'dateien' })">{{ t('lock.reset') }}</a
    >.
  </p>
</template>
