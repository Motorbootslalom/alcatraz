<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { gridNavKeyDown, timeEnter } from '../../lib/gridnav'
import { formatTimeDisplay, parseTime, sanitizeTimeInput } from '../../lib/time'

/**
 * Zeit-Eingabezelle, wie TimeCell.vue im Fehlerpunkte-Prototyp:
 *   • Live steht die Roh-Eingabe da (z. B. „1,2345“ für 1:23,45 oder „83,45“).
 *   • Enter übernimmt und springt in derselben Spalte eine Zeile tiefer.
 *   • Nach dem Verlassen zeigt die Zelle „mm:ss,00 (ss,00)“.
 * Gespeichert wird die Roh-Eingabe – so bleibt sie beim Ändern erhalten, und der Parser
 * deutet sie wieder genauso.
 */
const props = defineProps<{ value: string; label: string; auffaellig?: boolean }>()
const emit = defineEmits<{ change: [raw: string] }>()

const editing = ref(false)
const draft = ref(props.value)
const feld = ref<HTMLInputElement | null>(null)

// Änderung von außen (anderes Fenster, Beispielwerte) übernehmen, solange nicht gerade getippt wird.
watch(
  () => props.value,
  (v) => {
    if (!editing.value) draft.value = v
  },
)

const display = computed(() => {
  if (editing.value) return draft.value
  const parsed = parseTime(props.value)
  return parsed ? formatTimeDisplay(parsed.centis) : props.value
})

function onFocus() {
  draft.value = props.value
  editing.value = true
  // Inhalt markieren: Tippen überschreibt.
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => feld.value?.select())
}

function onInput(e: Event) {
  const input = e.target as HTMLInputElement
  draft.value = sanitizeTimeInput(input.value)
  // Unerlaubte Zeichen verschwinden sofort, auch wenn sich der Entwurf dadurch nicht ändert.
  if (input.value !== draft.value) input.value = draft.value
}

function uebernehmen() {
  if (!editing.value) return
  editing.value = false
  if (draft.value !== props.value) emit('change', draft.value)
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
