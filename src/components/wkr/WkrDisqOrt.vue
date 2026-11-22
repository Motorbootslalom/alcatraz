<script setup lang="ts">
import { computed, ref } from 'vue'
import { BOJEN_FOLGE_VORGABE, bojenAbschnitteAlle, type BojenFolge, type Entwurf, type MaskenAufbau, type MaskenBoje, type MaskenHalt } from '../../wkr/maske'
import WkrDisq from './WkrDisq.vue'
import { useWkrText } from './texte'

/**
 * Disq. auf Bojen-Listen (Antwort W4-12 vom 21.11.2026, WKR_ANNAHMEN BZ4, noch zu bestätigen): „Boje/Tor usw. ist
 * wichtig, damit geprüft werden kann, wo der Disq.-Fehler genau passiert ist. Daher sollte das immer nachgefragt
 * werden.“ DISQ im Fuß (und „Disq. an Boje …“ über den Bojen) führt deshalb zuerst hierher:
 *
 * 1. **Wo?** – die Bojen der Klasse in der Folge der Maske (je Halt eine Zeile, Hinweg vor Rückweg, der Rückweg unter
 *    `gedreht` umgekehrt wie sein Reiter – wkr/maske.ts bojenAbschnitteAlle, 22.11.2026; zwei Knopfspalten nach dem
 *    Blick), nur Bojen, deren Zelle Buchstaben annimmt; darunter „Keine Boje / ganzer
 *    Parcours“ für Disq. ohne Ort (Ausrüstung, nicht vorbeigekommen …) – nur wenn die Liste ein Disq.-Feld hat.
 * 2. **Welcher Buchstabe?** – WkrDisq mit den Buchstaben DIESER Zelle (zweiter Tipp setzt, H1); bei einer Boje schließt
 *    die Wahl und zeigt die Bojen wieder (`fertig`): Der Knopf trägt dann Punkte UND Buchstabe („✔ 5“ / „Disq. G“).
 *    Bei „keine Boje“ bleibt die Liste offen wie bisher (mehrere Buchstaben im Disq.-Feld möglich).
 *
 * Ein gesetzter Buchstabe an einer Boje steht in Schritt 1 am Knopf; in Schritt 2 nimmt ein Tipp auf ihn ihn heraus
 * (die Punkte bleiben). Katalog-Listen (Tor 5 ohne Bojen, MüB) kennen diese Wahl nicht – dort bleibt WkrDisq direkt.
 */
const props = withDefaults(
  defineProps<{
    aufbau: MaskenAufbau
    entwurf: Entwurf
    /** Buchstaben des Disq.-Felds der Liste („keine Boje“); leer = die Liste hat keins. */
    codes: { code: string; text: string }[]
    startNr: string
    gesperrt?: boolean
    /** Reihenfolge der Bojen dieser Liste wie in der Maske. */
    folge?: BojenFolge
  }>(),
  { folge: BOJEN_FOLGE_VORGABE },
)
const emit = defineEmits<{ setze: [code: string]; bojeDisq: [boje: MaskenBoje, code: string | null]; fertig: [] }>()
const { w } = useWkrText()

type Ort = { art: 'keine' } | { art: 'boje'; boje: MaskenBoje; name: string }
const ort = ref<Ort | null>(null)

const zweiWege = computed(() => new Set(props.aufbau.abschnitte.flatMap((a) => (a.art === 'halt' ? [a.halt.weg] : []))).size > 1)
/** Halte mit mindestens einer Boje, die Buchstaben annimmt – in der Folge der Maske. */
const halte = computed(() =>
  bojenAbschnitteAlle(props.aufbau, props.folge).flatMap((a) => (a.art === 'halt' && a.halt.bojen.some((b) => b.disq.length > 0) ? [a.halt] : [])),
)
/** Zeilentitel: Tor und – wo es Hin- und Rückweg gibt – der Weg, damit „Tor 1“ zweimal unterscheidbar ist. */
function zeile(h: MaskenHalt): string {
  return [h.titel, h.durchfahrt ? w('wkr.geraet.bojen.durchfahrtKurz') : '', zweiWege.value ? w(h.weg === 'hin' ? 'wkr.geraet.bojen.hin' : 'wkr.geraet.bojen.rueck') : '']
    .filter(Boolean)
    .join(' · ')
}
function bojenName(h: MaskenHalt, b: MaskenBoje): string {
  return [zeile(h), b.unter].filter(Boolean).join(' ')
}
function platz(b: MaskenBoje): string {
  return b.spalte === null ? '1 / -1' : String(b.spalte + 1)
}
const disqVon = (b: MaskenBoje) => props.entwurf.bojenDisq[b.feld] ?? null
const punkteVon = (b: MaskenBoje) => (props.entwurf.bojen[b.feld] ?? 0) * b.punkte

function waehleBoje(h: MaskenHalt, b: MaskenBoje): void {
  if (props.gesperrt || b.disq.length === 0) return
  ort.value = { art: 'boje', boje: b, name: bojenName(h, b) }
}
function setzeAnBoje(code: string): void {
  const o = ort.value
  if (!o || o.art !== 'boje') return
  emit('bojeDisq', o.boje, code)
  ort.value = null
  emit('fertig')
}
</script>

<template>
  <div class="wkr-disq-ort" data-teil="disq-ort" :data-schritt="ort ? ort.art : 'wo'">
    <template v-if="!ort">
      <h2 class="wkr-katalog-titel" data-teil="disq-ort-titel">{{ w('wkr.geraet.bojen.disqOrt') }}</h2>
      <p class="wkr-disq-ort-text">{{ w('wkr.geraet.bojen.disqOrtText', { nr: startNr }) }}</p>
      <section v-for="h in halte" :key="`${h.halt}|${h.weg}`" class="wkr-bojen-zeile" data-teil="disq-ort-halt" :data-halt="h.halt" :data-weg="h.weg">
        <h3 class="wkr-bojen-titel">{{ zeile(h) }}</h3>
        <div class="wkr-bojen-knoepfe">
          <button
            v-for="b in h.bojen"
            :key="b.feld"
            type="button"
            class="wkr-knopf wkr-bojen-knopf"
            :class="{ 'wkr-bojen-knopf--disq': !!disqVon(b) }"
            data-ziel="gross"
            data-action="disq-ort"
            :data-feld="b.feld"
            :data-disq="disqVon(b) ?? undefined"
            :disabled="b.disq.length === 0"
            :style="{ gridColumn: platz(b) }"
            @click="waehleBoje(h, b)"
          >
            <span class="wkr-bojen-unter">{{ b.unter || w('wkr.geraet.bojen.beruehrt') }}</span>
            <span class="wkr-bojen-stand">
              <span v-if="punkteVon(b) > 0" class="wkr-bojen-zahl">{{ w('wkr.geraet.bojen.gesetzt', { punkte: punkteVon(b) }) }}</span>
              <span v-if="disqVon(b)" class="wkr-bojen-zahl">{{ w('wkr.geraet.bojen.disqGesetzt', { code: disqVon(b)! }) }}</span>
            </span>
          </button>
        </div>
      </section>
      <button
        v-if="codes.length > 0"
        type="button"
        class="wkr-knopf wkr-knopf--breit"
        data-ziel="gross"
        data-action="disq-ort-keine"
        :data-anzahl="entwurf.disq.length"
        @click="ort = { art: 'keine' }"
      >
        {{ w('wkr.geraet.bojen.disqKeineBoje') }}<template v-if="entwurf.disq.length > 0"> · {{ entwurf.disq.join(', ') }}</template>
      </button>
    </template>
    <template v-else>
      <button type="button" class="wkr-knopf wkr-knopf--breit" data-ziel="klein" data-action="disq-ort-zurueck" @click="ort = null">
        {{ w('wkr.geraet.bojen.disqOrtZurueck') }}
      </button>
      <WkrDisq
        v-if="ort.art === 'keine'"
        :titel="w('wkr.geraet.bojen.disqKeineBoje')"
        :codes="codes"
        :gesetzt="entwurf.disq"
        :start-nr="startNr"
        :gesperrt="gesperrt"
        @setze="(c) => emit('setze', c)"
      />
      <template v-else>
        <p class="wkr-disq-ort-text" data-teil="disq-ort-hint">{{ w('wkr.geraet.bojen.disqHint', { nr: startNr }) }}</p>
        <WkrDisq
          :titel="w('wkr.geraet.bojen.disqTitel', { boje: ort.name })"
          :codes="ort.boje.disq"
          :gesetzt="disqVon(ort.boje) ? [disqVon(ort.boje)!] : []"
          :start-nr="startNr"
          :gesperrt="gesperrt"
          @setze="setzeAnBoje"
        />
      </template>
    </template>
  </div>
</template>
