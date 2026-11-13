<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { backNeedsFlip, hasDescription, type BogenSeite } from '../../lib/bogen'
import { t } from '../../i18n'
import { nachweisZeile } from '../../lib/parcoursNachweis'
import BogenBild from './BogenBild.vue'
import BogenLegende from './BogenLegende.vue'

/**
 * Rückseite eines Blatts mit der Beschreibung (Legende und Parcoursbild) – das
 * „Anne-Feature“ des Fehlerpunkte-Prototyps (SheetBackPage.vue). Sie folgt im Druck auf
 * jede Vorderseite, auch leer, damit beim doppelseitigen Druck Vorder- und Rückseiten
 * zusammenbleiben. Der Inhalt steht nur in der Blatthälfte, die beim Nach-oben-Klappen am
 * Klemmbrett sichtbar ist; Hochformat wird dafür um 180° gedreht.
 */
const props = defineProps<{ seite: BogenSeite; kennzeichen?: string }>()

const def = computed(() => props.seite.def)
// Hochformat-Bild (±90°) neben der Legende, sonst darunter.
const nebeneinander = computed(() => Math.abs(props.seite.bild?.drehung ?? 0) === 90)
const flip = computed(() => backNeedsFlip(props.seite.orientation))
const nachweis = computed(() => (props.seite.bild && hasDescription(def.value) ? nachweisZeile() : undefined))
const bildAlt = computed(() => `${props.seite.titel} – ${props.seite.klassenText}`)

// Passt die Beschreibung nicht in die sichtbare Hälfte? Dann ein Hinweis (nur am
// Bildschirm) – abgeschnitten wird sie im Druck in jedem Fall.
const haelfte = ref<HTMLElement | null>(null)
const zuHoch = ref(false)
function messen() {
  const el = haelfte.value
  if (el && el.clientHeight > 0) zuHoch.value = el.scrollHeight > el.clientHeight + 1
}
let beobachter: ResizeObserver | undefined
onMounted(() => {
  messen()
  if (typeof ResizeObserver !== 'undefined' && haelfte.value) {
    beobachter = new ResizeObserver(messen)
    for (const kind of haelfte.value.children) beobachter.observe(kind)
  }
})
onBeforeUnmount(() => beobachter?.disconnect())
</script>

<template>
  <div
    :class="['bogen', `bogen--${seite.orientation === 'landscape' ? 'quer' : 'hoch'}`, 'bogen--rueck']"
    :data-liste="seite.typeId"
    :data-muster="kennzeichen ? '' : undefined"
  >
    <p v-if="zuHoch" class="bogen-zuviel">{{ t('sheet.backOverflow') }}</p>
    <div :class="['bogen-rueck-seite', { 'bogen-rueck-seite--flip': flip }]">
      <div v-if="hasDescription(def)" ref="haelfte" :class="['bogen-rueck-haelfte', nebeneinander ? 'bogen-rueck-haelfte--neben' : 'bogen-rueck-haelfte--stapel']">
        <BogenLegende :def="def" />
        <div v-if="seite.bild" class="bogen-bild"><BogenBild :bild="seite.bild" :alt="bildAlt" /></div>
      </div>
      <!-- Namensnennung der Zeichnung: unter der sichtbaren Hälfte, damit sie dort nichts verdrängt. -->
      <p v-if="nachweis" class="bogen-nachweis bogen-nachweis--rueck">{{ nachweis }}</p>
    </div>
    <div v-if="kennzeichen" class="bogen-kennzeichen" aria-hidden="true"><span>{{ kennzeichen }}</span></div>
  </div>
</template>
