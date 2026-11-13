<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../state/store'
import { useEvent } from '../lib/event'
import { laeufeLautRegelwerk, streichlaeufeVon } from '../lib/ergebnis'
import { t } from '../i18n'

// Sieht das Regelwerk eine bestimmte Zahl von Läufen und Streichläufen vor (UIM: zwei
// Versuche, der bessere zählt) und ist die Veranstaltung anders eingestellt, steht es hier.
// Nur ein Hinweis: Wie viele Läufe gestrichen werden, entscheidet der Rennleiter. Derselbe
// Hinweis steht dort, wo man es einstellt (Veranstaltung, Wertung), und bei den Ergebnislisten.
const { state } = useStore()
const { regelwerk } = useEvent()
const soll = computed(() => laeufeLautRegelwerk(regelwerk.value, state.value))
</script>

<template>
  <p v-if="soll" class="boat-banner warn" data-hinweis="regel-laeufe" role="status" style="margin: 10px 0 0">
    {{
      t('scoring.rulebook', {
        rulebook: regelwerk.label,
        runs: soll.laeufe,
        drop: soll.streichlaeufe,
        nowRuns: state.laufCount,
        nowDrop: streichlaeufeVon(state.laufCount, state.streichlaeufe),
      })
    }}
  </p>
</template>
