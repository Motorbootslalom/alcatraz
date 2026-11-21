<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SchlangenEintrag } from '../../geraete/erfassen'
import { useWkrText } from './texte'

/**
 * Ausweichen (W3.3, Plan §5.4, G7): die zwei Nächsten der Schlange als Knöpfe und „Nr.“ mit einem eigenen
 * Ziffernfeld (große Tasten, keine Systemtastatur, die die halbe Maske verdeckte). Gesucht wird nur in Schlange,
 * „danach“ und „Zuletzt“ – das entscheidet WkrMaske; eine Nummer außerhalb wird nicht angeboten (der Bedienrechner
 * machte ohnehin Rückfrage `start`).
 */
const props = defineProps<{
  naechste: Pick<SchlangenEintrag, 'key' | 'startNr'>[]
  /** Nach einer Suche ohne Treffer: die gesuchte Nummer. */
  nichtGefunden: string | null
  /**
   * Buchstaben vor den Startnummern, die die Maske kennt (Schlange, danach, Zuletzt): „E“ (E01), unter UIM auch „D“
   * (Dolphin-Präfix, AppState.dolphinPraefix) – je einer eine Taste (K8, Prüfbefund W3 21.11.2026).
   */
  buchstaben: string[]
}>()
const emit = defineEmits<{ waehle: [key: string]; suche: [nr: string]; schliesse: [] }>()
const { w } = useWkrText()

const offen = ref(false)
const eingabe = ref('')
const tasten = computed(() => ['1', '2', '3', '4', '5', '6', '7', '8', '9', ...props.buchstaben, '0', '⌫'])

function taste(k: string): void {
  if (k === '⌫') eingabe.value = eingabe.value.slice(0, -1)
  else if (eingabe.value.length < 5) eingabe.value += k
}
function suche(): void {
  if (!eingabe.value) return
  // Startnummern mit Buchstaben (E01, D03) – die Tasten dafür stehen im Feld (aus den bekannten Nummern).
  emit('suche', eingabe.value)
}
function zu(): void {
  offen.value = false
  eingabe.value = ''
  emit('schliesse')
}
defineExpose({ zu })
</script>

<template>
  <div class="wkr-ausweichen" data-teil="ausweichen">
    <div v-if="naechste.length > 0" class="wkr-reihe">
      <button v-for="n in naechste" :key="n.key" type="button" class="wkr-knopf" data-ziel="klein" data-action="ausweichen" :data-start="n.key" @click="emit('waehle', n.key)">
        {{ n.startNr }}
      </button>
    </div>
    <!-- Befund 3 (Feldtest 21.11.2026): „Nr.“ war zu klein und unklar – jetzt ein Satz über die volle Breite. -->
    <button type="button" class="wkr-knopf wkr-knopf--breit" data-ziel="klein" data-action="suche" :aria-expanded="offen" @click="offen ? zu() : (offen = true)">
      {{ w(offen ? 'wkr.geraet.sucheZu' : 'wkr.geraet.suche') }}
    </button>
    <div v-if="offen" class="wkr-ziffern" data-teil="ziffernfeld">
      <p class="wkr-ziffern-anzeige" data-teil="eingabe" aria-live="polite">{{ eingabe || '–' }}</p>
      <p v-if="nichtGefunden" class="wkr-band wkr-band--warn" role="alert" data-teil="nicht-gefunden">{{ w('wkr.geraet.nichtGefunden', { nr: nichtGefunden }) }}</p>
      <div class="wkr-ziffern-tasten">
        <button v-for="k in tasten" :key="k" type="button" class="wkr-knopf" data-ziel="gross" :data-taste="k" @click="taste(k)">{{ k }}</button>
      </div>
      <div class="wkr-reihe">
        <button type="button" class="wkr-knopf" data-ziel="klein" data-action="suche-zu" @click="zu">{{ w('wkr.geraet.abbrechen') }}</button>
        <button type="button" class="wkr-knopf wkr-knopf--haupt" data-ziel="gross" data-action="suche-ok" :disabled="!eingabe" @click="suche">{{ w('wkr.geraet.sucheOk') }}</button>
      </div>
    </div>
  </div>
</template>
