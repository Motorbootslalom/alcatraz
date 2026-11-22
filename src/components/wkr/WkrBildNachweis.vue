<script setup lang="ts">
import { PARCOURS_HERKUNFT as herkunft } from '../../lib/parcoursQuelle'
import { useWkrText } from './texte'

/**
 * Namensnennung unter einer Parcours-Zeichnung auf dem Gerät (Prüfbefund 22.11.2026): Die Maske „Bild“ (WkrBild) und
 * die Zeichnung unter den Knöpfen bzw. in der Seite (WkrParcoursBild) zeigen die Zeichnungen (CC BY-NC-SA 4.0)
 * bearbeitet – gedreht, gedimmt, mit Kreisen darüber. Das Gerät hat keinen Store und keinen Weg zu FremdeBestandteile;
 * diese Zeile ist dort die Angabe nach Abschnitt 3(a): Urheber, Hinweis auf die Bearbeitung, Quelle mit Stand,
 * Lizenz mit Link (wie components/ParcoursNachweis.vue). In der Sprache der Liste (useWkrText), ohne Netz – nur Text
 * und ein Link, der erst beim Antippen öffnet. Die Quelle steht als Text, damit nicht zwei Link-Knöpfe Platz nehmen.
 */
const quelle = herkunft.repo.replace(/^https?:\/\//, '')
const { w } = useWkrText()
</script>

<template>
  <p class="wkr-bild-nachweis" data-teil="bild-nachweis">
    <span>{{ w('wkr.geraet.nachweis', { urheber: herkunft.urheber, quelle, commit: herkunft.commit.slice(0, 7) }) }}</span>
    <a class="wkr-knopf wkr-bild-nachweis-link" data-ziel="klein" :href="herkunft.lizenzUrl" target="_blank" rel="noopener license">{{
      w('wkr.geraet.nachweis.lizenz', { lizenz: herkunft.lizenz })
    }}</a>
  </p>
</template>
