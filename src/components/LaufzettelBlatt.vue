<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { locale, texteIn, type Locale } from '../i18n'
import type { LaufzettelLayout } from '../types'
import QrCode from './QrCode.vue'

/**
 * Ein Laufzettel: A4 quer, in der Mitte auf A5 gefaltet (Falz = gestrichelte Linie). Die
 * rechte Hälfte ist nach dem Falten die Vorderseite: am Falz stehen senkrecht Klasse und Lauf
 * (wie ein Buchrücken), daneben die Kästchen der Druckseiten und darunter die Arbeitsschritte
 * der Auswertung. Oben rechts steht der QR-Code (lib/qr.ts): Er führt in der Erfassung zu
 * Klasse und Lauf. Die linke Hälfte bleibt frei. Vorbild: LaufzettelPage.vue im
 * Fehlerpunkte-Prototyp.
 *
 * Zwei Formen (`layout`, Einstellung der Veranstaltung):
 * - `seite`: eine Zeile je Druckseite, das Kästchen vorn – „Tor 1 / 3 / 5 – Seite 1“, darunter
 *   „… – Seite 2“ (wie im Prototyp). Alle Kästchen stehen in einer Flucht.
 * - `liste`: eine Zeile je Liste, die Kästchen ihrer Seiten nebeneinander, die Seitenzahl
 *   daneben. Braucht weniger Platz.
 *
 * Am Bildschirm ist nur die Vorderseite zu sehen (die leere Hälfte wäre in schmalen Fenstern
 * alles, was man sähe); gedruckt wird das ganze Blatt.
 */
const props = defineProps<{
  /** Rücken: Klasse(n), Lauf und – bei mehreren Parcours – der Parcours. */
  klassenText: string
  laufText: string
  parcours?: string
  titel: string
  /** Je Liste eine Zeile; je Bogen der Liste eine Gruppe von Kästchen, eines je Druckseite. */
  zeilen: { key: string; label: string; gruppen: { key: string; label?: string; seiten: number }[] }[]
  /** Form des Zettels; fehlt = eine Zeile je Seite. */
  layout?: LaufzettelLayout
  /** Inhalt des QR-Codes. */
  qr: string
  schritteTitel?: string
  schritte: string[]
  /** Sprache des Zettels (lib/listensprache.ts); fehlt = die der Oberfläche. */
  sprache?: Locale
}>()
const emit = defineEmits<{
  /** Der Zettel passt auch dicht gesetzt nicht auf sein Blatt (oder wieder doch). */
  zuviel: [zuviel: boolean]
}>()
const { t } = texteIn(() => props.sprache ?? locale.value)

// Lange Angaben auf dem Rücken (viele Klassen einer Clubmeisterschaft) stehen kleiner.
const ruecken = computed(() => {
  const zeichen = props.klassenText.length + props.laufText.length + (props.parcours?.length ?? 0)
  return zeichen > 42 ? 'lz-ruecken--eng' : zeichen > 26 ? 'lz-ruecken--schmal' : undefined
})

const jeSeite = computed(() => props.layout !== 'liste')

/** Form „eine Zeile je Seite“: jede Druckseite jedes Bogens, in der Reihenfolge der Listen. */
const seitenZeilen = computed(() =>
  props.zeilen.flatMap((z) =>
    z.gruppen.flatMap((g) =>
      Array.from({ length: g.seiten }, (_, i) => ({
        key: `${g.key}:${i + 1}`,
        label: z.label,
        klassen: g.label,
        // Bei einem einseitigen Bogen genügt der Name der Liste.
        seite: g.seiten > 1 ? t('runsheet.pageN', { n: i + 1 }) : undefined,
      })),
    ),
  ),
)

// Passt die Liste nicht in den Platz über den Arbeitsschritten – gemessen, denn Namen der
// Listen und Schritte sind frei wählbar –, wird stufenweise dichter gesetzt: erst kleiner,
// dann (eine Zeile je Seite) in zwei und in drei Spalten. Abgeschnitten wird nie
// stillschweigend: Was dann noch nicht passt, sagt der Zettel selbst, auch im Druck.
const STUFEN = computed(() => (jeSeite.value ? ['', 'lz-oben--eng', 'lz-oben--eng lz-oben--spalten2', 'lz-oben--eng lz-oben--spalten3'] : ['', 'lz-oben--eng']))
const obenEl = ref<HTMLElement>()
const stufe = ref(0)
const zuViel = ref(false)

const passt = () => !obenEl.value || obenEl.value.scrollHeight <= obenEl.value.clientHeight + 1

// Die Zeilen ändern sich mehrmals kurz nacheinander (jede gemessene Seitenzahl): Nur die
// jüngste Messung zählt – liefen zwei durcheinander, stellte eine die Stufe der anderen weiter.
let messung = 0

async function fit() {
  const diese = ++messung
  stufe.value = 0
  zuViel.value = false
  await nextTick()
  // Ohne Layout (Test-DOM) gibt es nichts zu messen.
  if (diese !== messung || !obenEl.value || obenEl.value.clientHeight === 0) return
  while (!passt() && stufe.value < STUFEN.value.length - 1) {
    stufe.value++
    await nextTick()
    if (diese !== messung) return
  }
  zuViel.value = !passt()
}
onMounted(fit)
// Die Zeilen ändern sich, sobald die Seitenzahlen der Bögen gemessen sind.
watch(() => [JSON.stringify(props.zeilen), props.schritte.join('\n'), props.titel, props.layout], fit)
watch(zuViel, (z) => emit('zuviel', z))
</script>

<template>
  <div class="laufzettel" :data-layout="jeSeite ? 'seite' : 'liste'">
    <div class="lz-blatt">
      <div class="lz-haelfte lz-rueck" />
      <div class="lz-haelfte lz-vorn">
        <div :class="['lz-ruecken', ruecken]">
          <span class="lz-klasse">{{ klassenText }}</span>
          <span class="lz-lauf">{{ laufText }}</span>
          <span v-if="parcours" class="lz-parcours">{{ parcours }}</span>
        </div>
        <div class="lz-inhalt">
          <p v-if="zuViel" class="lz-zuviel">{{ t(jeSeite ? 'runsheet.overflowPages' : 'runsheet.overflow') }}</p>
          <!-- QR rechts oben; Titel und die ersten Zeilen laufen links daran vorbei. -->
          <div ref="obenEl" :class="['lz-oben', STUFEN[stufe]]">
            <QrCode class="lz-qr" :inhalt="qr" />
            <p class="lz-titel">{{ titel }}</p>
            <ul v-if="jeSeite" class="lz-liste lz-je-seite">
              <li v-for="z in seitenZeilen" :key="z.key">
                <span class="lz-kasten" />
                <span class="lz-text">
                  {{ z.label }}<span v-if="z.klassen" class="lz-gruppe-name"> · {{ z.klassen }}</span><template v-if="z.seite"> – {{ z.seite }}</template>
                </span>
              </li>
            </ul>
            <ul v-else class="lz-liste lz-seiten">
              <li v-for="z in zeilen" :key="z.key">
                <span class="lz-name">{{ z.label }}</span>
                <span class="lz-gruppen">
                  <span v-for="g in z.gruppen" :key="g.key" class="lz-gruppe">
                    <span v-if="g.label" class="lz-gruppe-name">{{ g.label }}</span>
                    <!-- Die Seitenzahl steht neben dem Kästchen: Darin stünde sie unter dem Haken. -->
                    <span v-for="n in g.seiten" :key="n" class="lz-seite">
                      <span class="lz-kasten" /><span v-if="g.seiten > 1" class="lz-nr">{{ n }}</span>
                    </span>
                  </span>
                </span>
              </li>
            </ul>
          </div>
          <div v-if="schritte.length > 0" class="lz-schritte">
            <p v-if="schritteTitel" class="lz-schritte-titel">{{ schritteTitel }}</p>
            <ul class="lz-liste">
              <li v-for="(s, i) in schritte" :key="i"><span class="lz-kasten" />{{ s }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
