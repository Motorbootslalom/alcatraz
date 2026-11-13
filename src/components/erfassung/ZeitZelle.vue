<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { gridNavKeyDown, timeEnter } from '../../lib/gridnav'
import { dezimalZeichen, zeitAnzeige, zeitRoh } from '../../lib/ergebnisText'
import { parseTime, sanitizeTimeInput } from '../../lib/time'

/**
 * Zeit-Eingabezelle, wie TimeCell.vue im Fehlerpunkte-Prototyp:
 *   • Live steht die Roh-Eingabe da (z. B. „1,2345“ für 1:23,45 oder „83,45“).
 *   • Enter übernimmt und springt in derselben Spalte eine Zeile tiefer.
 *   • Nach dem Verlassen zeigt die Zelle „mm:ss,00 (ss,00)“.
 * Gespeichert wird die Roh-Eingabe – so bleibt sie beim Ändern erhalten, und der Parser
 * deutet sie wieder genauso. Im Stand steht sie immer mit Komma; angezeigt und getippt wird
 * mit dem Dezimalzeichen der Sprache.
 *
 * Gespeichert wird bei jedem Tastendruck, wie in allen anderen Feldern: Wer das Fenster
 * mitten in einer Zeit schließt oder neu lädt, verliert nichts.
 */
const props = defineProps<{ value: string; label: string; auffaellig?: boolean }>()
const emit = defineEmits<{ change: [raw: string] }>()

const editing = ref(false)
const draft = ref(zeitRoh(props.value))
const feld = ref<HTMLInputElement | null>(null)
/** Seit dem Fokus wurde getippt (kein reaktiver Zustand, nur für das Markieren). */
let getippt = false

// Änderung von außen (anderes Fenster, Beispielwerte) übernehmen, solange nicht gerade getippt wird.
watch(
  () => props.value,
  (v) => {
    if (!editing.value) draft.value = zeitRoh(v)
  },
)

const display = computed(() => {
  if (editing.value) return draft.value
  const parsed = parseTime(props.value)
  return parsed ? zeitAnzeige(parsed.centis) : zeitRoh(props.value)
})

/** Der Entwurf, wie er im Stand steht: immer mit Komma. */
const roh = () => draft.value.replace('.', ',')

function onFocus() {
  draft.value = zeitRoh(props.value)
  editing.value = true
  getippt = false
  // Inhalt markieren: Tippen überschreibt. Kam der erste Tastendruck schneller als das nächste
  // Bild, bleibt die Markierung aus – sonst überschriebe die zweite Ziffer die erste.
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      if (!getippt) feld.value?.select()
    })
  }
}

function onInput(e: Event) {
  getippt = true
  const input = e.target as HTMLInputElement
  draft.value = sanitizeTimeInput(input.value, dezimalZeichen())
  // Unerlaubte Zeichen verschwinden sofort, auch wenn sich der Entwurf dadurch nicht ändert.
  if (input.value !== draft.value) input.value = draft.value
  if (roh() !== props.value) emit('change', roh())
}

function uebernehmen() {
  if (!editing.value) return
  editing.value = false
  if (roh() !== props.value) emit('change', roh())
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    uebernehmen()
    if (feld.value) timeEnter(feld.value)
    return
  }
  // Pfeiltasten: erst übernehmen, dann die übliche Navigation in der Tabelle.
  if (e.key.startsWith('Arrow')) gridNavKeyDown(e)
}
</script>

<template>
  <input
    ref="feld"
    :class="['erf-feld', 'erf-feld--zeit', { 'erf-feld--auffaellig': auffaellig }]"
    inputmode="decimal"
    autocomplete="off"
    :aria-label="label"
    :aria-invalid="auffaellig ? 'true' : undefined"
    :value="display"
    @focus="onFocus"
    @input="onInput"
    @blur="uebernehmen"
    @keydown="onKeydown"
  />
</template>
