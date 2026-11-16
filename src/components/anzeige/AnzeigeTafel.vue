<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { BereichId, OeffentlicheSicht } from '../../types'
import { tIn } from '../../i18n'
import { vFit } from '../../lib/fit'
import { logoUrl } from '../../lib/listenLogos'
import AnzeigeBereich from './AnzeigeBereich.vue'

/**
 * Die Anzeigetafel: Kopfzeile mit den Logos links und rechts, darunter je Bereich (Parcours) der Starter
 * im Boot. Nach dem Tafel-Prototyp (BoardView.vue, 16.11.2026). Liest NUR die öffentliche Sicht – am
 * Bedienrechner (src/AnzeigeApp.vue) dieselbe wie später auf entfernten Anzeigen (E6); nie den Stand.
 *
 * Hier wird nie eine Seite neu geladen: Vue tauscht nur, was sich geändert hat, der schwarze Grund
 * bleibt – kein weißer Blitz. Alle Schriften hängen an der Höhe eines Bereichs (styles/anzeige.css).
 */
const props = defineProps<{
  sicht: OeffentlicheSicht
  /** Nur diese Bereiche (`#/anzeige/<bereich>`); ohne Angabe die Auswahl der gemeinsamen Tafel (`sicht.auswahl`). */
  bereiche?: readonly BereichId[]
}>()

const gezeigt = computed(() => (props.bereiche ?? props.sicht.auswahl).flatMap((id) => props.sicht.bereiche.filter((b) => b.id === id)))
const anzahl = computed(() => Math.max(1, gezeigt.value.length))

// Logos nur, wenn die Sicht sie trägt (Einstellung an, mindestens eines gesetzt, Tafel am Bedienrechner).
// Als Blob-Adresse wie auf den Listen (lib/listenLogos.ts): Ein SVG bleibt data-URL.
const logos = computed(() => {
  const l = props.sicht.logos
  return l ? { links: l.links ? logoUrl(l.links.src) : null, rechts: l.rechts ? logoUrl(l.rechts.src) : null } : null
})
const hatKopf = computed(() => props.sicht.kopf.trim() !== '' || !!logos.value?.links || !!logos.value?.rechts)

/**
 * Neben- oder untereinander, und darin Nummer und Angaben neben- oder untereinander – entschieden nach dem
 * Seitenverhältnis, nicht nach der Zahl der Parcours (Prototyp): Die Startnummer ist so groß, wie der
 * Bereich hoch ist. In einem breiten, flachen Bereich stehen Nummer und Angaben gut nebeneinander; in einem
 * fast quadratischen bliebe für Name und Herkunft nur ein schmaler Streifen – dort untereinander.
 * Bereiche stehen nur auf sehr breiten Bildschirmen (LED-Band) nebeneinander: dann, wenn jeder für sich
 * noch breit genug für Nummer und Angaben nebeneinander bleibt. Sonst wäre die Schrift untereinander größer.
 */
const NEBENEINANDER_AB = 2.4

const fenster = ref({ w: window.innerWidth, h: window.innerHeight })
const beiGroesse = () => (fenster.value = { w: window.innerWidth, h: window.innerHeight })
onMounted(() => window.addEventListener('resize', beiGroesse))
onBeforeUnmount(() => window.removeEventListener('resize', beiGroesse))

const nebeneinander = computed(() => {
  const n = anzahl.value
  const hoehe = fenster.value.h * (1 - kopfAnteil(n, false))
  return n > 1 && hoehe > 0 && fenster.value.w / n / hoehe >= NEBENEINANDER_AB
})
/** Die Kopfzeile bekommt einen festen Anteil der Höhe; ohne sie bleibt alles den Startern. */
function kopfAnteil(n: number, neben: boolean): number {
  if (!hatKopf.value) return 0
  return n > 1 && !neben ? 0.11 : 0.15
}
const kopf = computed(() => kopfAnteil(anzahl.value, nebeneinander.value))
const gestapelt = computed(() => {
  const n = anzahl.value
  const hoehe = (fenster.value.h * (1 - kopf.value)) / (nebeneinander.value ? 1 : n)
  const breite = nebeneinander.value ? fenster.value.w / n : fenster.value.w
  return hoehe > 0 && breite / hoehe < NEBENEINANDER_AB
})

/**
 * Die Anordnung als Text, an jeden Bereich gereicht: Ändert sie sich mit der Fenstergröße (Vollbild, LED-Band),
 * zeichnet der Bereich neu, und lib/fit.ts misst in `updated` mit der neuen Anordnung. Die `resize`-Handler der
 * Zeilen liefen sonst vor dem Umschalten und mäßen die alte – ein langer Name bliebe abgeschnitten.
 */
const anordnung = computed(() => `${nebeneinander.value ? 'neben' : 'unter'}|${gestapelt.value ? 'gestapelt' : 'flach'}|${anzahl.value}|${kopf.value}`)

const cssVars = computed(() => ({
  // Übereinander stehende Bereiche teilen sich die Höhe; nebeneinander hat jeder die ganze.
  '--anzeige-bereiche': String(nebeneinander.value ? 1 : anzahl.value),
  '--anzeige-kopf-h': `${kopf.value * 100}vh`,
  '--anzeige-skala': String(props.sicht.skala || 1),
}))
</script>

<template>
  <div class="anzeige" :style="cssVars" :lang="sicht.sprache">
    <header v-if="hatKopf" class="anzeige-kopf">
      <!-- Schmuck: alt leer. Ein fehlendes Logo lässt seinen Platz frei. -->
      <img v-if="logos?.links" class="anzeige-logo" data-logo="links" :src="logos.links" alt="" />
      <div v-fit class="anzeige-zeile anzeige-titel" data-kopf>{{ sicht.kopf }}</div>
      <img v-if="logos?.rechts" class="anzeige-logo" data-logo="rechts" :src="logos.rechts" alt="" />
    </header>

    <div class="anzeige-flaeche" :class="{ nebeneinander }">
      <template v-for="(b, i) in gezeigt" :key="b.id">
        <div v-if="i > 0" class="anzeige-trenner" />
        <AnzeigeBereich :bereich="b" :sicht="sicht" :gestapelt="gestapelt" :anordnung="anordnung" />
      </template>
      <section v-if="gezeigt.length === 0" class="anzeige-bereich">
        <div class="anzeige-leer" data-leer>{{ tIn(sicht.sprache, 'anzeige.keineStarter') }}</div>
      </section>
    </div>
  </div>
</template>
