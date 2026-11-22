<script setup lang="ts">
import { computed } from 'vue'
import { zeitDeutung, zeitTeile, zeitUhr, ZEIT_ZEICHEN_MAX } from '../../wkr/maske'
import { useWkrText } from './texte'

/**
 * Ziffernblock der WKR-Maske (W5.3 Grundform, W5.4 Zeit; Plan docs/plan-wkr-w5.md §6.2/§7.2, 22.11.2026): eigene Tasten
 * 0–9 und ⌫ – nie die Systemtastatur (sie verdeckte die halbe Maske, Befund W3). Die Anzeige steht groß darüber;
 * leer zeigt sie „–“.
 *
 * - **Startnummer** (Knoten-Prüfliste, W5.3): dazu die Buchstaben, die vor Startnummern stehen („E“, unter UIM „D“).
 * - **Zeit** (`zeit`, W5.4, F9 „nur abgelesen eintippen, kein Stoppen am Gerät“, ZT2): dazu „,“ (englisch „.“); die
 *   Anzeige zeigt die Uhr „1:23,45“ und darunter die Deutung „= 1 min 23,45 s“ – gelesen wie die Erfassung am Rechner
 *   (wkr/maske.ts zeitDeutung = lib/time.ts parseTime), damit der WKR sieht, was der Bedienrechner verstehen wird.
 *   Unlesbar → rot „so nicht lesbar“ (`data-lesbar="nein"`); den Hauptknopf sperrt die Maske (fertig/zeitenOffen).
 *   Getippt wird wie am Rechner: „83,45“ oder „1,2345“ – das Getippte steht klein daneben.
 *
 * `v-model` ist der getippte Text; `max` begrenzt die Länge (Startnummern: 5 wie WkrAusweichen, Zeit ZEIT_ZEICHEN_MAX).
 */
const props = withDefaults(
  defineProps<{
    modelValue: string
    /** Buchstaben vor den Startnummern (aus den bekannten Nummern), je einer eine Taste. */
    buchstaben?: string[]
    max?: number
    /** Überschrift über der Anzeige („Nr.“, „Zeit 1“). */
    titel?: string
    gesperrt?: boolean
    /** Zeit-Eingabe (W5.4): Komma-Taste, Uhr und Deutung. */
    zeit?: boolean
  }>(),
  { buchstaben: () => [], max: 5, titel: '', gesperrt: false, zeit: false },
)
const emit = defineEmits<{ 'update:modelValue': [wert: string] }>()
const text = useWkrText()
const { w } = text

/** Das Dezimalzeichen der Liste: englisch „.“, sonst „,“ – gespeichert wird immer mit Komma (ZT2). */
const komma = computed<',' | '.'>(() => (text.sprache.value === 'en' ? '.' : ','))
const grenze = computed(() => (props.zeit ? Math.max(props.max, ZEIT_ZEICHEN_MAX) : props.max))
const tasten = computed(() => ['1', '2', '3', '4', '5', '6', '7', '8', '9', ...(props.zeit ? [','] : props.buchstaben), '0', '⌫'])
const hatKomma = computed(() => props.modelValue.includes(','))

const centis = computed(() => (props.zeit && props.modelValue !== '' ? zeitDeutung(props.modelValue) : null))
const lesbar = computed(() => !props.zeit || props.modelValue === '' || centis.value !== null)
/** Große Anzeige: bei Zeit die Uhr; unlesbar bzw. Startnummer das Getippte (mit dem Komma der Sprache). */
const anzeige = computed(() => {
  if (props.modelValue === '') return '–'
  if (centis.value !== null) return zeitUhr(centis.value, komma.value)
  return props.modelValue.replace(',', komma.value)
})
const deutung = computed(() => {
  if (!props.zeit || props.modelValue === '') return ''
  if (centis.value === null) return w('wkr.geraet.zeit.unlesbar')
  const { min, sek } = zeitTeile(centis.value, komma.value)
  return min > 0 ? w('wkr.geraet.zeit.deutung', { min, sek }) : w('wkr.geraet.zeit.deutungSek', { sek })
})

function taste(k: string): void {
  if (props.gesperrt) return
  if (k === '⌫') emit('update:modelValue', props.modelValue.slice(0, -1))
  else if (k === ',' && hatKomma.value) return
  else if (props.modelValue.length < grenze.value) emit('update:modelValue', props.modelValue + k)
}
const aus = (k: string) =>
  props.gesperrt || (k === '⌫' ? props.modelValue === '' : k === ',' ? hatKomma.value || props.modelValue.length >= grenze.value : props.modelValue.length >= grenze.value)
</script>

<template>
  <div class="wkr-ziffern" data-teil="ziffern" :data-zeit="zeit || undefined">
    <p class="wkr-ziffern-anzeige" :class="{ 'wkr-ziffern-anzeige--unlesbar': !lesbar }" data-teil="ziffern-anzeige" :data-lesbar="lesbar ? 'ja' : 'nein'" aria-live="polite">
      <span v-if="titel" class="wkr-ziffern-titel">{{ titel }}</span>
      {{ anzeige }}
    </p>
    <p v-if="zeit && modelValue !== ''" class="wkr-ziffern-deutung" :class="{ 'wkr-ziffern-deutung--unlesbar': !lesbar }" data-teil="ziffern-deutung">
      {{ deutung }}
      <span class="wkr-ziffern-getippt" data-teil="ziffern-getippt">{{ w('wkr.geraet.zeit.getippt', { text: modelValue.replace(',', komma) }) }}</span>
    </p>
    <div class="wkr-ziffern-tasten">
      <button
        v-for="k in tasten"
        :key="k"
        type="button"
        class="wkr-knopf"
        data-ziel="gross"
        :data-taste="k"
        :disabled="aus(k)"
        :aria-label="k === '⌫' ? w('wkr.geraet.ziffern.loeschen') : k === ',' ? w('wkr.geraet.zeit.komma') : undefined"
        @click="taste(k)"
      >
        {{ k === ',' ? komma : k }}
      </button>
    </div>
  </div>
</template>
