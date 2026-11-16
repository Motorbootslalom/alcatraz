<script setup lang="ts">
// Logos links und rechts im Kopf einer gedruckten Liste (Einstellung: LogosPanel.vue; Entscheidung des Nutzers
// vom 16.11.2026: zwei frei belegbare Plätze, unter DM und UIM gleich, anfangs leer). Ohne Logo rendert die
// Komponente NUR den Slot – das DOM ist dann genau wie vorher (Seitenteilung, Tests). Höhe und Breite fest in mm
// aus den gespeicherten Pixelmaßen: Das Layout hängt nie vom (asynchronen) Laden des Bildes ab, object-fit
// hält das Seitenverhältnis, wenn CSS die Breite deckelt. <img>, kein CSS-Hintergrund (den lassen Browser
// beim Druck weg); kein loading="lazy" (sonst fehlen Logos späterer Seiten im Druck). alt="": Schmuck.
// Formen (styles/logos.css): `rahmen` neben einem umrandeten Kopf (Listen), `leiste` in der Titelleiste
// der WKR-Bögen, `streifen` als eigene Zeile über dem Laufzettel.
// Auf den WKR-Bögen (`leiste`) höchstens LOGO_HOEHE_BOGEN_MAX_MM (Entscheidung des Nutzers vom 16.11.2026).
import { useListenLogos } from '../lib/listenLogos'
import { LOGO_HOEHE_BOGEN_MAX_MM } from '../lib/logo'

const props = withDefaults(defineProps<{ art?: 'rahmen' | 'leiste' | 'streifen' }>(), { art: 'rahmen' })
const logos = useListenLogos(props.art === 'leiste' ? LOGO_HOEHE_BOGEN_MAX_MM : undefined)
</script>

<template>
  <div v-if="logos" :class="['kopf-logos', `kopf-logos--${art}`]">
    <img
      v-if="logos.links"
      class="listen-logo listen-logo--links"
      data-logo="links"
      alt=""
      decoding="sync"
      :src="logos.links.url"
      :style="{ width: `${logos.links.breiteMm}mm`, height: `${logos.links.hoeheMm}mm` }"
    />
    <div class="kopf-logos-mitte"><slot /></div>
    <img
      v-if="logos.rechts"
      class="listen-logo listen-logo--rechts"
      data-logo="rechts"
      alt=""
      decoding="sync"
      :src="logos.rechts.url"
      :style="{ width: `${logos.rechts.breiteMm}mm`, height: `${logos.rechts.hoeheMm}mm` }"
    />
  </div>
  <slot v-else />
</template>
