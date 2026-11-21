<script setup lang="ts">
import { t, tn } from '../i18n'
import { adresse } from '../lib/router'

/**
 * Hinweis über einem Stapel der WKR-Bögen bzw. Laufzettel (Nutzer 21.11.2026, WKR_ANNAHMEN Z1/Z4): So viele Bögen
 * werden nur digital erfasst und deshalb nicht gedruckt – mit den Listen und dem Rückfall-Schalter „Trotzdem
 * drucken“. Nie gedruckt (no-print); die Zahl kommt aus components/wkrDruck.ts.
 */
defineProps<{ anzahl: number; listen: readonly string[] }>()
const trotzdem = defineModel<boolean>('trotzdem', { required: true })
</script>

<template>
  <div v-if="anzahl > 0" class="panel no-print wkr-digital" data-hinweis="nur-digital" role="status">
    <p :class="['boat-banner', trotzdem ? 'warn' : 'ok']">
      {{ trotzdem ? tn('lists.wkr.digital.gedruckt', anzahl) : tn('lists.wkr.digital.hinweis', anzahl) }}
      {{ t('lists.wkr.digital.listen', { listen: listen.join(', ') }) }}
      {{ t('lists.wkr.digital.wo') }} <a :href="adresse('betrieb', { reiter: 'wkr' })">{{ t('nav.betrieb') }} → {{ t('betrieb.reiter.wkr') }}</a>.
    </p>
    <label class="check">
      <input v-model="trotzdem" type="checkbox" data-feld="digital-drucken" />
      {{ t('lists.wkr.digital.trotzdem') }}
    </label>
  </div>
</template>
