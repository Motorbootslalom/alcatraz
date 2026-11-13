<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { t } from '../i18n'
import QrCode from './QrCode.vue'

/**
 * Ein Laufzettel: A4 quer, in der Mitte auf A5 gefaltet (Falz = gestrichelte Linie). Die
 * rechte Hälfte ist nach dem Falten die Vorderseite: am Falz stehen senkrecht Klasse und Lauf
 * (wie ein Buchrücken), daneben je Liste eine Zeile mit einem Kästchen je Druckseite und darunter die Arbeitsschritte
 * der Auswertung. Oben rechts steht der QR-Code (lib/qr.ts): Er führt in der Erfassung zu
 * Klasse und Lauf. Die linke Hälfte bleibt frei. Vorbild: LaufzettelPage.vue im
 * Fehlerpunkte-Prototyp.
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
  /** Inhalt des QR-Codes. */
  qr: string
  schritteTitel?: string
  schritte: string[]
}>()

// Lange Angaben auf dem Rücken (viele Klassen einer Clubmeisterschaft) stehen kleiner.
const ruecken = computed(() => {
  const zeichen = props.klassenText.length + props.laufText.length + (props.parcours?.length ?? 0)
  return zeichen > 42 ? 'lz-ruecken--eng' : zeichen > 26 ? 'lz-ruecken--schmal' : undefined
})

// Je Liste eine Zeile mit den Kästchen ihrer Seiten nebeneinander (bei mehreren Seiten mit
// der Seitenzahl darin). Passt das nicht in den Platz über den Arbeitsschritten – gemessen,
// denn Namen der Listen und Schritte sind frei wählbar –, wird dichter gesetzt. Abgeschnitten
// wird nie stillschweigend: Was dann noch nicht passt, sagt der Zettel selbst, auch im Druck.
const obenEl = ref<HTMLElement>()
const eng = ref(false)
const zuViel = ref(false)

const passt = () => !obenEl.value || obenEl.value.scrollHeight <= obenEl.value.clientHeight + 1

async function fit() {
  eng.value = false
  zuViel.value = false
  await nextTick()
  // Ohne Layout (Test-DOM) gibt es nichts zu messen.
  if (!obenEl.value || obenEl.value.clientHeight === 0 || passt()) return
  eng.value = true
  await nextTick()
  zuViel.value = !passt()
}
onMounted(fit)
// Die Zeilen ändern sich, sobald die Seitenzahlen der Bögen gemessen sind.
watch(() => [JSON.stringify(props.zeilen), props.schritte.join('\n'), props.titel], fit)
</script>

<template>
  <div class="laufzettel">
    <div class="lz-blatt">
      <div class="lz-haelfte lz-rueck" />
      <div class="lz-haelfte lz-vorn">
        <div :class="['lz-ruecken', ruecken]">
          <span class="lz-klasse">{{ klassenText }}</span>
          <span class="lz-lauf">{{ laufText }}</span>
          <span v-if="parcours" class="lz-parcours">{{ parcours }}</span>
        </div>
        <div class="lz-inhalt">
          <p v-if="zuViel" class="lz-zuviel">{{ t('runsheet.overflow') }}</p>
          <!-- QR rechts oben; Titel und die ersten Zeilen laufen links daran vorbei. -->
          <div ref="obenEl" :class="['lz-oben', { 'lz-oben--eng': eng }]">
            <QrCode class="lz-qr" :inhalt="qr" />
            <p class="lz-titel">{{ titel }}</p>
            <ul class="lz-liste lz-seiten">
              <li v-for="z in zeilen" :key="z.key">
                <span class="lz-name">{{ z.label }}</span>
                <span class="lz-gruppen">
                  <span v-for="g in z.gruppen" :key="g.key" class="lz-gruppe">
                    <span v-if="g.label" class="lz-gruppe-name">{{ g.label }}</span>
                    <span v-for="n in g.seiten" :key="n" class="lz-kasten">{{ g.seiten > 1 ? n : '' }}</span>
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
