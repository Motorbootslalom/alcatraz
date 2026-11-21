<script setup lang="ts">
import WkrDisq from './WkrDisq.vue'
import { useWkrText } from './texte'

/**
 * Maske Vorsteg (W3.3, Plan §5.3, §4.5): Am Vorsteg gibt es keine Fehlerpunkte, nur Disq. und Bemerkung. Der
 * Riesenknopf „In Ordnung ✓“ ist der Hauptknopf im Fuß (WkrFuss, Art `vorsteg`, nie ein zweiter ähnlicher Knopf);
 * hier stehen X und die Disq.-Buchstaben, ohne den Umweg über [DISQ]. Gilt für alle Versuche (W1
 * vorstegAlleVersuche); Starts „noch nicht gezeigt“ (`vorab`) dürfen schon erfasst werden.
 */
defineProps<{ codes: { code: string; text: string }[]; gesetzt: string[]; startNr: string; gesperrt?: boolean }>()
const emit = defineEmits<{ setze: [code: string]; xNein: [] }>()
const { w } = useWkrText()
</script>

<template>
  <div class="wkr-vorsteg" data-teil="vorsteg">
    <p class="wkr-hinweis">{{ w('wkr.geraet.vorsteg.hinweis') }}</p>
    <WkrDisq :codes="codes" :gesetzt="gesetzt" :start-nr="startNr" :gesperrt="gesperrt" @setze="(c) => emit('setze', c)" @x-nein="emit('xNein')" />
  </div>
</template>
