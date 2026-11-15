<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUpdated, shallowRef } from 'vue'
import { pageHeightMm } from '../lib/paging'
import { listenSeiten, MESS_TOLERANZ_KOPF_PX, MESS_TOLERANZ_ZEILE_PX, SEITENZAHL_MM, zeilenPlatzPx, type SeitenTeil } from '../lib/seiten'
import { bogenTexte } from '../config/sprache'
import type { Locale } from '../i18n'
import { DRUCKSEITE, useLeereRueckseite } from '../lib/doppelseitig'
import LeereRueckseite from './LeereRueckseite.vue'

/**
 * Eine Liste als Dokument: Sie teilt sich selbst in Druckseiten und schreibt ihre Seitenzahl
 * selbst aufs Blatt – nur wenn sie mehr als eine Seite hat, und gezählt je Dokument. So steht
 * auf dem zweiten Parcours wieder „Seite 1 / 2“ und nie eine Zahl über den ganzen Druck.
 *
 * Der Inhalt einer Seite kommt aus dem Slot (Kopf, Spaltenköpfe und die Zeilen der `teile`).
 * Wie bei den Bögen (bogen/BogenBlatt.vue) wird gemessen: an der ersten Seite, wie hoch Kopf
 * und Spaltenköpfe sind, und an jeder Zeile ihre Höhe – daraus folgt, was auf ein Blatt passt
 * (lib/seiten.ts). Voraussetzung: Die Liste ist am Bildschirm so gesetzt wie im Druck (gleiche
 * Schrift, gleiche Breite), und die Höhe einer Zeile hängt nicht davon ab, auf welcher Seite
 * sie steht. Ohne Layout gilt `vorgabe` (Zeilen je Seite).
 *
 * Unter dem Inhalt steht die Seitenzahl. Eine Liste, die dort mehr zeigt (Wertungslisten:
 * Stichentscheid, Seitenzahl, letzte Änderung), füllt den Slot `fuss` und nennt mit `fussMm`
 * dessen feste Höhe – der Fuß steht auf jeder Seite, und sein Platz zählt bei der Teilung mit.
 *
 * Attribute (Klasse, `data-…`) landen auf jeder Seite.
 *
 * Doppelseitig gedruckt (lib/doppelseitig.ts) folgt einem Dokument mit ungerader Seitenzahl
 * eine leere Rückseite – außer dem letzten des Drucks. Sie ist keine Seite des Dokuments: Die
 * Zählung („1 / 3“ … „3 / 3“) bleibt, wie sie ist.
 */
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  /** Zeilen je Block; Blöcke bleiben möglichst ungetrennt (lib/seiten.ts). */
  laengen: readonly number[]
  format: 'portrait' | 'landscape'
  /** Zeilen je Seite, solange nichts gemessen ist. */
  vorgabe: number
  /** Sprache der Liste: Die Seitenzahl steht im Wortlaut der Wettkampfrichter-Bögen („Seite 1 / 2“). */
  sprache: Locale
  /** Höhe des Slots `fuss` in mm; fehlt = die Zeile der Seitenzahl. */
  fussMm?: number
  /**
   * Die Zeile jedes Blocks (ab 0), die der Slot im Kopf einer Seite wiederholt, wenn die Seite
   * mit der Fortsetzung des Blocks beginnt (UIM-Mannschaftswertung: die Spaltenköpfe des
   * Herkunftsblocks). Ihre gemessene Höhe geht dort vom Platz der Seite ab (lib/seiten.ts).
   */
  wiederholteZeile?: number
  /**
   * Zeile `zeile` des Blocks bleibt auf der Seite der Zeile davor: Eine Zelle fasst beide
   * zusammen (Results des Parallelslaloms, „Qualified“ über mehrere Zeilen; lib/seiten.ts).
   */
  gebunden?: (block: number, zeile: number) => boolean
}>()
defineSlots<{
  default(props: { teile: SeitenTeil[]; seite: number; anzahl: number }): unknown
  /** Statt der Seitenzahl; `seitenzahl` ist ihr Text – leer, wenn die Liste nur eine Seite hat. */
  fuss?(props: { teile: SeitenTeil[]; seite: number; anzahl: number; seitenzahl: string }): unknown
}>()
const fussMm = computed(() => props.fussMm ?? SEITENZAHL_MM)
const seitenzahl = (i: number) => (seiten.value.length > 1 ? bogenTexte(props.sprache).seite(i + 1, seiten.value.length) : '')

/** Gemessen: Höhe von Kopf und Spaltenköpfen und die Höhe jeder Zeile, in der Reihenfolge der Liste. */
const mass = shallowRef<{ fixedPx: number; hoehen: number[] } | null>(null)
const seiten = computed(() => {
  const m = mass.value
  const zeilen = props.laengen.reduce((n, l) => n + Math.max(0, l), 0)
  // Passt die Messung nicht (mehr) zur Liste, gilt bis zur nächsten die Vorgabe.
  const w = props.wiederholteZeile
  if (!m || m.hoehen.length !== zeilen) return listenSeiten(props.laengen, props.vorgabe, undefined, w === undefined ? undefined : () => 1, props.gebunden)
  const beginn: number[] = []
  props.laengen.reduce((n, l, i) => ((beginn[i] = n), n + Math.max(0, l)), 0)
  // Mindestens die höchste Zeile muss Platz haben – sonst entstünde keine Seite.
  const platz = Math.max(zeilenPlatzPx(m.fixedPx, pageHeightMm(props.format), fussMm.value), ...m.hoehen)
  return listenSeiten(
    props.laengen,
    platz,
    (block, zeile) => m.hoehen[beginn[block] + zeile],
    w === undefined ? undefined : (block) => (w < props.laengen[block] ? m.hoehen[beginn[block] + w] : 0),
    props.gebunden,
  )
})

// Die Seiten in ihrer Reihenfolge – nicht reaktiv, nur zum Messen.
const inhalte: (HTMLElement | undefined)[] = []
const merke = (i: number, el: unknown) => {
  inhalte[i] = el instanceof HTMLElement ? el : undefined
}

function messen() {
  const erste = inhalte[0]
  if (!erste) return
  const contentPx = erste.getBoundingClientRect().height
  if (!(contentPx > 0)) return // ohne Layout (z. B. Test-DOM) nichts messen
  const hoehen: number[] = []
  let ersteZeilenPx = 0
  inhalte.slice(0, seiten.value.length).forEach((inhalt, i) => {
    for (const zeile of inhalt?.querySelectorAll<HTMLElement>('tbody tr') ?? []) {
      const px = zeile.getBoundingClientRect().height
      hoehen.push(px)
      if (i === 0) ersteZeilenPx += px
    }
  })
  if (hoehen.length === 0) return
  const neu = { fixedPx: contentPx - ersteZeilenPx, hoehen }
  // Nur echte Änderungen übernehmen – Rundungsrauschen soll die Aufteilung nicht hin- und herschalten.
  const alt = mass.value
  const gleich =
    alt &&
    Math.abs(alt.fixedPx - neu.fixedPx) <= MESS_TOLERANZ_KOPF_PX &&
    alt.hoehen.length === hoehen.length &&
    alt.hoehen.every((px, i) => Math.abs(px - hoehen[i]) <= MESS_TOLERANZ_ZEILE_PX)
  if (!gleich) mass.value = neu
}

// Die letzte Seite des Dokuments – daran sieht es, ob im Druck noch eines folgt.
const leereRueckseite = useLeereRueckseite(
  () => seiten.value.length,
  () => inhalte[seiten.value.length - 1]?.parentElement,
)
const druckseite = { [DRUCKSEITE]: '' }

let beobachter: ResizeObserver | undefined
let beobachtet: HTMLElement | undefined
function beobachten() {
  if (typeof ResizeObserver === 'undefined' || beobachtet === inhalte[0]) return
  beobachter?.disconnect()
  beobachtet = inhalte[0]
  if (!beobachtet) return
  // Breite, Schrift oder Sprache ändern die Höhen, ohne dass die Liste neu gezeichnet wird.
  beobachter = new ResizeObserver(messen)
  beobachter.observe(beobachtet)
}
onMounted(() => {
  messen()
  beobachten()
})
// Nach jedem Zeichnen neu messen: andere Zeilen, andere Reihenfolge, andere Spalten. Die Höhen
// hängen nicht an der Teilung – nach der zweiten Messung steht sie.
onUpdated(() => {
  messen()
  beobachten()
})
onBeforeUnmount(() => beobachter?.disconnect())
</script>

<template>
  <section v-for="(teile, i) in seiten" :key="i" v-bind="{ ...$attrs, ...druckseite }" class="listen-seite" :data-seite="i + 1" :data-seiten="seiten.length">
    <div :ref="(el) => merke(i, el)" class="listen-seite-inhalt"><slot :teile="teile" :seite="i" :anzahl="seiten.length" /></div>
    <!-- Auf dem Blatt, nicht im Seitenrand: Dort zählte der Browser über den ganzen Druck. -->
    <div v-if="$slots.fuss" class="listen-fuss" :style="{ height: `${fussMm}mm` }">
      <slot name="fuss" :teile="teile" :seite="i" :anzahl="seiten.length" :seitenzahl="seitenzahl(i)" />
    </div>
    <p v-else-if="seiten.length > 1" class="listen-seitenzahl">{{ seitenzahl(i) }}</p>
  </section>
  <!-- Nur die Klasse des Dokuments: Sie trägt die Seitenart (hoch/quer); `data-…` bleiben den echten Seiten. -->
  <LeereRueckseite v-if="leereRueckseite" :class="$attrs.class" />
</template>
