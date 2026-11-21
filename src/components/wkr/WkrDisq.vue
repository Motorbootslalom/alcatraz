<script setup lang="ts">
import { ref } from 'vue'
import AppDialog from '../AppDialog.vue'
import { useWkrText } from './texte'

/**
 * Disq.-Buchstaben dieser Position mit Kurztext (W3.3, Plan §5.1, H1). Eine Disqualifikation wiegt schwer: Der
 * **erste** Tipp merkt den Buchstaben nur vor („noch einmal tippen“), erst der **zweite** setzt ihn; ein gesetzter
 * Buchstabe geht mit einem Tipp wieder heraus. „X“ (nicht gestartet, F5 – nur Steg-Ablegen und Vorsteg; die Maske
 * bietet es nur dort an) fragt danach noch einmal groß nach.
 */
const props = defineProps<{
  codes: { code: string; text: string }[]
  gesetzt: string[]
  startNr: string
  /** Takt nach dem Abschicken (G5): Ein Tipp jetzt ist ein Tropfen – er merkt auch nichts vor (Prüfbefund W3). */
  gesperrt?: boolean
  /**
   * Überschrift über der offenen Liste („Disq.“) – wie „Fehler“ über den Codes, damit klar ist, welche Liste gerade
   * offen ist (Befund 10, 21.11.2026). Der Vorsteg braucht keine: Dort gibt es nur diese Liste.
   */
  titel?: string
}>()
// `xNein`: die große Rückfrage zu X mit „Abbrechen“ geschlossen (W3.4: Schritt der Probe am Vorsteg).
const emit = defineEmits<{ setze: [code: string]; xNein: [] }>()
const { w } = useWkrText()

const vorgemerkt = ref<string | null>(null)
const frageX = ref(false)

function tippe(code: string): void {
  if (props.gesperrt) return
  if (props.gesetzt.includes(code)) {
    vorgemerkt.value = null
    emit('setze', code)
    return
  }
  if (vorgemerkt.value !== code) {
    vorgemerkt.value = code
    return
  }
  vorgemerkt.value = null
  if (code === 'X') frageX.value = true
  else emit('setze', code)
}
function xNein(): void {
  frageX.value = false
  emit('xNein')
}
function xJa(): void {
  frageX.value = false
  emit('setze', 'X')
}
</script>

<template>
  <div class="wkr-disq" data-teil="disq">
    <h2 v-if="titel" class="wkr-katalog-titel" data-teil="disq-titel">{{ titel }}</h2>
    <button
      v-for="c in codes"
      :key="c.code"
      type="button"
      class="wkr-knopf wkr-disq-knopf"
      :class="{ 'wkr-disq-knopf--gesetzt': gesetzt.includes(c.code), 'wkr-disq-knopf--vor': vorgemerkt === c.code }"
      data-ziel="gross"
      data-action="disq-code"
      :data-code="c.code"
      :data-stand="gesetzt.includes(c.code) ? 'gesetzt' : vorgemerkt === c.code ? 'vorgemerkt' : 'frei'"
      :aria-pressed="gesetzt.includes(c.code)"
      @click="tippe(c.code)"
    >
      <span class="wkr-code-nr">{{ c.code }}</span>
      <span class="wkr-code-mitte">
        <span class="wkr-code-text">{{ c.text }}</span>
        <span class="wkr-disq-zustand">
          <template v-if="gesetzt.includes(c.code)">✓ {{ w('wkr.geraet.disq.gesetzt') }}</template>
          <template v-else-if="vorgemerkt === c.code">{{ w('wkr.geraet.disq.nochmal') }}</template>
        </span>
      </span>
    </button>
    <AppDialog v-if="frageX" class="wkr-dialog" :titel="w('wkr.geraet.x.frage', { nr: startNr })" data-dialog="wkr-x" @abbrechen="xNein">
      <p>{{ w('wkr.geraet.x.text') }}</p>
      <template #knoepfe>
        <button type="button" class="wkr-knopf wkr-knopf--gefahr" data-ziel="gross" data-action="x-ja" @click="xJa">{{ w('wkr.geraet.x.ja') }}</button>
        <button type="button" class="wkr-knopf" data-ziel="gross" data-action="x-nein" autofocus @click="xNein">{{ w('wkr.geraet.abbrechen') }}</button>
      </template>
    </AppDialog>
  </div>
</template>
