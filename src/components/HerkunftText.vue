<script setup lang="ts">
import { computed } from 'vue'
import { flaggenBild } from '../flaggen/bilder'
import type { HerkunftAnzeige } from '../lib/origin'

/**
 * Eine Herkunft, wie sie auf Listen und im Starter-Reiter steht: Text, Kürzel und – für
 * Bundesländer und Staaten – die Flagge. Was davon gezeigt wird, entscheidet allein
 * `herkunftAnzeige` (lib/origin.ts); hier wird es nur gezeichnet, für alle Listen gleich.
 *
 * Die Flagge ist ein Bild fester Größe unterhalb der Zeilenhöhe (styles/app.css `.flagge`):
 * Sie darf keine Zeile höher machen, sonst stimmte die Seitenteilung der Listen nicht mehr.
 */
// Nur was gezeichnet wird – so passt auch die Herkunft der Anzeigetafel (types/betrieb.ts `SichtHerkunft`).
const props = defineProps<{ anzeige: Pick<HerkunftAnzeige, 'flagge' | 'alt' | 'text' | 'druck' | 'klartext'> }>()
const bild = computed(() => (props.anzeige.flagge ? flaggenBild(props.anzeige.flagge) : undefined))
// Flagge und erstes Wort gehören zusammen: Wo die Spalte umbricht (Starter-Reiter am Handy),
// soll die Flagge nicht allein auf einer Zeile stehen. Zusammengehalten wird nur dort
// (styles/app.css `.herkunft-kopf`) – auf den Listen bleibt der Umbruch, wie er gemessen ist.
const kopf = computed(() => props.anzeige.text.match(/^\S+/)?.[0] ?? '')
</script>

<template>
  <span class="herkunft" :data-flagge="bild ? anzeige.flagge?.code : undefined">
    <!-- Steht der Name daneben, ist die Flagge Schmuck (alt leer) – sonst trägt sie ihn als Textalternative. -->
    <template v-if="bild"
      ><span class="herkunft-kopf"
        ><img :class="['flagge', { 'flagge--allein': !anzeige.text && !anzeige.druck }]" :src="bild.src" :width="bild.breite" :height="bild.hoehe" :alt="anzeige.alt" :title="anzeige.alt || undefined" decoding="sync" />{{ kopf }}</span
      >{{ anzeige.text.slice(kopf.length) }}</template
    ><template v-else>{{ anzeige.klartext }}</template
    ><span v-if="bild && anzeige.druck" class="herkunft-druck" aria-hidden="true">{{ anzeige.druck }}</span>
  </span>
</template>
