<script setup lang="ts">
import { computed } from 'vue'
import { parcoursBildUrl } from '../../lib/parcoursQuelle'
import type { BogenBild } from '../../lib/bogen'

/**
 * Parcoursbild eines Bogens – unter der Tabelle oder auf der Rückseite. Vorbild:
 * CourseImage.vue im Fehlerpunkte-Prototyp. Anders als dort wird nichts geladen: Der Browser
 * blendet die eingebundene Zeichnung der Klasse selbst ab (lib/parcoursQuelle.ts), auch für
 * die mitgelieferten Positionen. Als `<img>` mit Blob-URL, damit IDs und Stilregeln der
 * Zeichnung im Bild bleiben.
 */
const props = defineProps<{ bild: BogenBild; alt: string }>()

const src = computed(() => {
  try {
    return parcoursBildUrl(props.bild.datei, props.bild.vorgabe)
  } catch {
    // Ohne Blob-URLs (sehr alter Browser, Test-DOM) bleibt der Rahmen leer.
    return undefined
  }
})
const gedreht = computed(() => Math.abs(props.bild.drehung) === 90)
</script>

<template>
  <!-- Um ±90° gedreht und formatfüllend: Inline-SVG mit preserveAspectRatio füllt die
       (beliebig hohe) Box proportional. -->
  <svg v-if="gedreht" class="bogen-bild-svg" viewBox="0 0 100 237" preserveAspectRatio="xMidYMid meet" role="img" :aria-label="alt">
    <image
      v-if="src"
      :href="src"
      width="237"
      height="100"
      :transform="bild.drehung === -90 ? 'translate(0 237) rotate(-90)' : 'translate(100 0) rotate(90)'"
      preserveAspectRatio="xMidYMid meet"
    />
  </svg>
  <img v-else-if="src" :src="src" :alt="alt" :style="bild.drehung === 180 ? { transform: 'rotate(180deg)' } : undefined" />
</template>
