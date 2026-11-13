<script setup lang="ts">
import { computed } from 'vue'
import { qrPfad } from '../lib/qr'

/**
 * Ein QR-Code als eingebettetes SVG: Vektor, im Druck in jeder Auflösung scharf, und ohne
 * Bilddatei oder Netz. Die Farben stehen fest im SVG – schwarz auf weiß, auch im dunklen
 * Farbschema: Ein Scanner liest nur dunkle Kästchen auf hellem Grund. Die Größe bestimmt das
 * Stylesheet der Stelle, an der er steht.
 *
 * Der Inhalt steht als Titel dabei: Die Maus auf dem Code zeigt die Kennung, die sich auch
 * von Hand in das Scan-Feld der Erfassung tippen lässt.
 */
const props = defineProps<{ inhalt: string }>()
const code = computed(() => qrPfad(props.inhalt))
</script>

<template>
  <svg class="qr-code" :viewBox="`0 0 ${code.groesse} ${code.groesse}`" shape-rendering="crispEdges" role="img" :aria-label="inhalt" :data-qr="inhalt">
    <title>{{ inhalt }}</title>
    <rect :width="code.groesse" :height="code.groesse" fill="#fff" />
    <path :d="code.pfad" fill="#000" />
  </svg>
</template>
