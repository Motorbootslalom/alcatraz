<script setup lang="ts">
import type { ClassId } from '../../types'
import { useWkrText } from './texte'

/**
 * „Klasse vorziehen“ in der Übung (Nutzer 22.11.2026, R7-45: „man muss auch in der Übung andere Klassen vorziehen
 * können, damit man diese Klasse sehen kann“; WKR_ANNAHMEN Y4, bestätigt 23.11.2026, R9-13). Je Klasse der Liste ein Knopf mit
 * dem Namen wie in der Maske (Klasse E unter UIM „Dolphin“); die Wahl wirkt einmal auf den nächsten Start
 * (geraete/uebung.ts zieheKlasseVor). Eingebaut in WkrMehr (Masken mit Schlange) und WkrPruefliste (Knoten am Tisch,
 * dort springt der Vorschlag). Texte in der Sprache der Liste (useWkrText); Knöpfe umbrechend (360 px, N3).
 */
defineProps<{ klassen: { id: ClassId; titel: string }[] }>()
const emit = defineEmits<{ wahl: [klasse: ClassId] }>()
const { w } = useWkrText()
</script>

<template>
  <fieldset class="wkr-feldgruppe" data-teil="uebung-vorziehen">
    <legend>{{ w('wkr.geraet.uebung.vorziehen') }}</legend>
    <p class="wkr-hinweis">{{ w('wkr.geraet.uebung.vorziehenHint') }}</p>
    <div class="wkr-reihe">
      <button
        v-for="k in klassen"
        :key="k.id"
        type="button"
        class="wkr-knopf"
        data-ziel="klein"
        data-action="uebung-vorziehen"
        :data-klasse="k.id"
        @click="emit('wahl', k.id)"
      >
        {{ k.titel }}
      </button>
    </div>
  </fieldset>
</template>
