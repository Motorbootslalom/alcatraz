<script setup lang="ts">
import { computed } from 'vue'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'
import type { Weg } from '../../wkr/bojen'
import { eintraegeAuf, wegVon, type Entwurf, type MaskenAbschnitt, type MaskenAufbau, type MaskenBoje } from '../../wkr/maske'
import WkrKnoepfe from './WkrKnoepfe.vue'
import WkrWegUmschalter from './WkrWegUmschalter.vue'
import { useWkrText } from './texte'

/**
 * Mitte der Bojen-Maske (W4.2, Plan docs/plan-wkr-w4.md §5, 21.11.2026): die Abschnitte der gewählten Seite (ohne
 * Umschalter alle, mit Kopfzeile HINWEG/RÜCKWEG) in Fahrtfolge (P6) – je Halt eine Zeile, Katalog-Abschnitte
 * (Einfahrt Tor 5, MüB) an ihrem Platz über WkrKnoepfe.
 *
 * - Zwei Knopfspalten nach `boje.spalte` (P7: wie die Unterspalten auf dem Bogen, also wie der WKR die Bojen sieht);
 *   eine Einzelboje (Start/Ziel, Tor-5-Boje) steht in der Spalte ihrer Seite, die andere bleibt frei; Speedboje und
 *   Parallel-Bojen 1–5 (`spalte: null`) volle Breite.
 * - Schalter: Tipp setzt („✔ 5“, schwarz hinterlegt), zweiter Tipp nimmt weg (Prellschutz in WkrMaske). Zähler (Tor 5):
 *   „0×“, jeder Tipp +1, „2× = 10“, ab WKR_ANNAHMEN.bojenZaehlerMax nimmt der Knopf nichts mehr an und sagt es in einer
 *   zweiten Zeile („höchstens 9×“). Nie nur Farbe.
 * - Tor 1, 2. Durchfahrt (`durchfahrt: 2`): eigene Zeile mit dem Satz „2. Durchfahrt (Speedrunde)“ über den Knöpfen.
 * - Kein [−][+]: zurück nur über „− letzte zurück“ im Fuß.
 */
const props = defineProps<{
  aufbau: MaskenAufbau
  entwurf: Entwurf
  /** Gewählte Seite des Umschalters (nur mit `aufbau.umschalter`). */
  weg: Weg
}>()
const emit = defineEmits<{ boje: [boje: MaskenBoje]; tippe: [feld: string, code: string]; weg: [weg: Weg] }>()
const { w } = useWkrText()

const zahlen = computed(() => ({ hin: eintraegeAuf(props.entwurf, props.aufbau, 'hin'), rueck: eintraegeAuf(props.entwurf, props.aufbau, 'rueck') }))
/** Die Abschnitte, die zu sehen sind – mit Umschalter nur die der gewählten Seite. */
const gezeigt = computed(() => props.aufbau.abschnitte.filter((a) => !props.aufbau.umschalter || wegVon(a) === props.weg))
/** Ohne Umschalter: Kopfzeile vor dem ersten Abschnitt jedes Wegs (nur wenn beide Wege vorkommen). */
const zweiWege = computed(() => new Set(props.aufbau.abschnitte.map(wegVon)).size > 1)
function kopfVor(i: number): Weg | null {
  if (props.aufbau.umschalter || !zweiWege.value) return null
  const a = gezeigt.value[i]
  const davor = gezeigt.value[i - 1]
  return !davor || wegVon(davor) !== wegVon(a) ? wegVon(a) : null
}
const schluessel = (a: MaskenAbschnitt) => (a.art === 'halt' ? `h|${a.halt.halt}|${a.halt.weg}` : `k|${a.teil.feld}`)

const anzahl = (b: MaskenBoje) => props.entwurf.bojen[b.feld] ?? 0
/**
 * Was der Knopf unter der Beschriftung sagt – Stand als Zeichen und Zahl, nie nur Farbe. Am Höchstwert „höchstens 9×“
 * als eigene Zeile (WKR_ANNAHMEN.zaehlerStandZweiZeilen, Prüfbefund 21.11.2026): „9× = 45 · höchstens 9×“ passte bei
 * 360 px nicht in den halben Knopf.
 */
function stand(b: MaskenBoje): { zahl: string; max: string | null } {
  const n = anzahl(b)
  if (!b.zaehler) return { zahl: n > 0 ? w('wkr.geraet.bojen.gesetzt', { punkte: n * b.punkte }) : '', max: null }
  if (n === 0) return { zahl: w('wkr.geraet.bojen.zaehlerLeer'), max: null }
  const zahl = w('wkr.geraet.bojen.zaehler', { n, punkte: n * b.punkte })
  return { zahl, max: n >= WKR_ANNAHMEN.bojenZaehlerMax ? w('wkr.geraet.bojen.max', { n: WKR_ANNAHMEN.bojenZaehlerMax }) : null }
}
/** Platz im Raster: Spalte 1 bzw. 2, volle Breite ohne Seite. */
const platz = (b: MaskenBoje) => (b.spalte === null ? '1 / -1' : String(b.spalte + 1))
</script>

<template>
  <div class="wkr-bojen" data-teil="bojen" :data-weg="aufbau.umschalter ? weg : undefined">
    <WkrWegUmschalter v-if="aufbau.umschalter" :weg="weg" :zahlen="zahlen" @waehle="(x) => emit('weg', x)" />
    <template v-for="(a, i) in gezeigt" :key="schluessel(a)">
      <h2 v-if="kopfVor(i)" class="wkr-bojen-kopf" data-teil="weg-kopf" :data-weg="kopfVor(i)">
        {{ w(kopfVor(i) === 'hin' ? 'wkr.geraet.bojen.hinweg' : 'wkr.geraet.bojen.rueckweg') }}
      </h2>
      <section
        v-if="a.art === 'halt'"
        class="wkr-bojen-zeile"
        data-teil="halt"
        :data-halt="a.halt.halt"
        :data-weg="a.halt.weg"
        :data-durchfahrt="a.halt.durchfahrt"
      >
        <p v-if="a.halt.durchfahrt" class="wkr-bojen-durchfahrt" data-teil="durchfahrt">{{ w('wkr.geraet.bojen.durchfahrt') }}</p>
        <h3 class="wkr-bojen-titel" data-teil="halt-titel">{{ a.halt.titel }}</h3>
        <div class="wkr-bojen-knoepfe">
          <button
            v-for="b in a.halt.bojen"
            :key="b.feld"
            type="button"
            class="wkr-knopf wkr-bojen-knopf"
            :class="{ 'wkr-bojen-knopf--gesetzt': anzahl(b) > 0 }"
            data-ziel="gross"
            data-action="boje"
            :data-feld="b.feld"
            :data-art="b.zaehler ? 'zaehler' : 'schalter'"
            :data-anzahl="anzahl(b)"
            :aria-pressed="b.zaehler ? undefined : anzahl(b) > 0"
            :style="{ gridColumn: platz(b) }"
            @click="emit('boje', b)"
          >
            <span class="wkr-bojen-unter">{{ b.unter || w('wkr.geraet.bojen.beruehrt') }}</span>
            <span class="wkr-bojen-stand" data-teil="boje-stand">
              <span class="wkr-bojen-zahl">{{ stand(b).zahl }}</span>
              <span v-if="stand(b).max" class="wkr-bojen-max" data-teil="boje-max">{{ stand(b).max }}</span>
            </span>
          </button>
        </div>
      </section>
      <WkrKnoepfe v-else :teile="[a.teil]" :entwurf="entwurf" @tippe="(feld, code) => emit('tippe', feld, code)" />
    </template>
  </div>
</template>
