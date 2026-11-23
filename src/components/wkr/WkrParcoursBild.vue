<script setup lang="ts">
import { computed } from 'vue'
import { parcoursBildUrl } from '../../lib/parcoursQuelle'
import type { MaskenBild } from '../../wkr/sicht'
import { useWkrText } from './texte'

/**
 * Parcours-Zeichnung unter den Knöpfen (Nutzer 21.11.2026, W4-13, WKR_ANNAHMEN GF9): „Wichtig ist auch, dass die
 * Parcours-Zeichnung mit angezeigt wird, wenn man hochwischt.“ Dieselbe Zeichnung wie auf dem Bogen der Klasse
 * (Sicht `bild`: Datei, Dimmen/Ausblenden, Drehung) – gebündelt (src/assets/parcours über lib/parcoursQuelle.ts),
 * kein Netz. Steht unter den Knöpfen, damit sie die Bedienung nie verdrängt; ±90° gedreht wird sie hochkant gezeigt
 * (Handy). Ohne Blob-URLs (Test-DOM) bleibt nur die Überschrift.
 */
const props = defineProps<{ bild: MaskenBild; klasse: string }>()
const { w } = useWkrText()

const src = computed(() => {
  try {
    return parcoursBildUrl(props.bild.datei, { dim: props.bild.dim, aus: props.bild.aus })
  } catch {
    return undefined
  }
})
// Die Zeichnung steht, wie der WKR sie vom Bogen kennt; nur 180° wird übernommen – ±90° (hochkant auf dem A4-Bogen)
// bliebe auf dem schmalen Handy winzig, dort zeigt sie liegend die volle Breite.
const drehung = computed(() => (props.bild.drehung === 180 ? 'rotate(180deg)' : undefined))
</script>

<template>
  <figure class="wkr-parcours-bild" data-teil="parcours-bild" :data-datei="bild.datei">
    <figcaption>{{ w('wkr.geraet.parcoursBild', { klasse }) }}</figcaption>
    <img v-if="src" :src="src" :alt="w('wkr.geraet.parcoursBild', { klasse })" :style="drehung ? { transform: drehung } : undefined" />
    <!-- Namensnennung steht unter „Mehr“ (Nutzer 23.11.2026: „Das reicht, dass es bei den Einstellungen steht“). -->
  </figure>
</template>
