<script setup lang="ts">
import type { VerbindungsLage } from '../../geraete/transport/typen'
import { t } from '../../i18n'

/**
 * Wie die Verbindung des Gerätebetriebs steht (E6): ein Punkt und der Text daneben – der Punkt ist nur Beigabe, die
 * Lage steht immer als Wort da. Am Bedienrechner (Betrieb → Geräte, Kopf des Reiters) und auf dem Gerät (GeraetApp).
 */
defineProps<{ lage: VerbindungsLage }>()
</script>

<template>
  <span class="geraete-lage" :data-lage="lage"><span class="geraete-punkt" aria-hidden="true" />{{ t(`geraete.lage.${lage}`) }}</span>
</template>
