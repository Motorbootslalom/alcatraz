<script setup lang="ts">
import { PARCOURS_HERKUNFT as herkunft } from '../lib/parcoursQuelle'
import { t } from '../i18n'

/**
 * Namensnennung unter einer Parcours-Zeichnung: Urheber, Quelle mit Stand, der Hinweis auf
 * die Bearbeitung und die Lizenz (CC BY-SA 4.0 Abschnitt 3(a)). Die Zeichnungen stehen unter
 * einer anderen Lizenz als das Programm; src/assets/parcours/LICENSE.md liegt aber nur im
 * Repository – in der gebauten App ist diese Zeile die Angabe, die den Empfänger erreicht.
 *
 * Die Angaben kommen aus QUELLE.json, das `npm run parcours:sync` schreibt.
 */
const quelle = herkunft.repo.replace(/^https?:\/\//, '')
</script>

<template>
  <p class="note parcours-nachweis">
    {{ t('parcours.credit', { author: herkunft.urheber }) }}
    {{ t('parcours.creditSource') }}
    <a :href="herkunft.repo" target="_blank" rel="noopener">{{ quelle }}</a>
    ({{ t('parcours.creditRevision', { commit: herkunft.commit.slice(0, 7) }) }}) · {{ t('parcours.creditLicense') }}
    <a :href="herkunft.lizenzUrl" target="_blank" rel="noopener license">{{ herkunft.lizenz }}</a>
  </p>
</template>
