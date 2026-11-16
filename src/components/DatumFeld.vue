<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { formatDateIn, locale, t } from '../i18n'
import { liesDatum } from '../lib/datum'

/**
 * Datumsfeld ohne die Datumswahl des Browsers (Entscheidung des Nutzers vom 15.11.2026): Ein
 * `<input type="date">` zeigt je nach Systemsprache mm/dd/yyyy – „das darf es nie geben“. Ein
 * Textfeld mit festem Muster: deutsch TT.MM.JJJJ, englisch JJJJ-MM-TT. Gelesen wird beim Tippen
 * und Einfügen auch 2019-12-01, 1.12.2019 und 01/12/2019 (Schrägstrich immer Tag zuerst;
 * lib/datum.ts). `modelValue` ist JJJJ-MM-TT oder leer – so, wie es gespeichert wird.
 *
 * Bestätigt (verlassen oder Enter), steht das Datum im Muster der Oberfläche da. Ein Datum, das
 * es nicht gibt (31.02.), oder ein unbekanntes Muster meldet `fehler` mit dem Text dazu; ein
 * leerer `fehler` hebt die Meldung auf. Wo die Meldung steht, entscheidet die Ansicht.
 *
 * `sofort` (Formular): Jedes vollständige Datum geht schon beim Tippen hinaus, ein unfertiges als
 * leer – so prüft die Ansicht den Jahrgang, während getippt wird, und nichts Altes bleibt
 * stehen. Ohne `sofort` (Zelle einer Tabelle) erst beim Bestätigen; das Feld zeigt danach
 * wieder, was gilt – auch wenn die Ansicht das Datum abgewiesen hat (Jahrgang passt nicht).
 */
const props = withDefaults(defineProps<{ modelValue: string; sofort?: boolean }>(), { sofort: false })
const emit = defineEmits<{ 'update:modelValue': [iso: string]; fehler: [text: string] }>()

const anzeige = (iso: string) => (iso ? formatDateIn(locale.value, iso) : '')
const text = ref(anzeige(props.modelValue))
const fehlerhaft = ref(false)
/** Der zuletzt bestätigte Text: Enter und das folgende `change` bestätigen nicht zweimal. */
let bestaetigt = text.value

const muster = computed(() => t('date.pattern'))

/** Was der Text gerade bedeutet: das Datum, sonst leer (unfertig oder ungültig). */
function gilt(): string {
  const r = liesDatum(text.value)
  return r.art === 'ok' ? r.iso : ''
}

function zeigeStand() {
  text.value = anzeige(props.modelValue)
  bestaetigt = text.value
  fehlerhaft.value = false
}

// Von außen geändert (gespeichert, verworfen, ein anderer Starter): Das Feld zeigt den Stand –
// außer der getippte Text bedeutet schon dasselbe (dann springt beim Tippen nichts um).
watch(
  () => props.modelValue,
  (iso) => {
    if (gilt() !== iso) zeigeStand()
  },
)
// Andere Sprache der Oberfläche: Das Muster wechselt mit, solange nichts Unfertiges dasteht.
watch(locale, () => {
  const art = liesDatum(text.value).art
  if ((art === 'ok' || art === 'leer') && gilt() === props.modelValue) zeigeStand()
})

function meldung(art: 'ungueltig' | 'unbekannt', eingabe: string): string {
  // Mit Schrägstrich meint, wer „12/31/2019“ tippt, wohl Monat/Tag – das gilt hier nie; die Meldung sagt es.
  if (art === 'ungueltig') return t(eingabe.includes('/') ? 'date.invalidSlash' : 'date.invalid', { text: eingabe })
  return t('date.unknown', { text: eingabe, pattern: muster.value, example: anzeige('2019-12-01') })
}

function tippen(e: Event) {
  text.value = (e.target as HTMLInputElement).value
  if (!props.sofort) return
  const r = liesDatum(text.value)
  const iso = r.art === 'ok' ? r.iso : ''
  if (iso !== props.modelValue) emit('update:modelValue', iso)
  if (fehlerhaft.value && (r.art === 'ok' || r.art === 'leer')) {
    fehlerhaft.value = false
    emit('fehler', '')
  }
}

function bestaetige() {
  if (text.value === bestaetigt) return
  bestaetigt = text.value
  const r = liesDatum(text.value)
  if (r.art === 'ok' || r.art === 'leer') {
    const iso = r.art === 'ok' ? r.iso : ''
    fehlerhaft.value = false
    emit('fehler', '')
    text.value = anzeige(iso)
    bestaetigt = text.value
    if (iso !== props.modelValue) emit('update:modelValue', iso)
  } else {
    fehlerhaft.value = true
    emit('fehler', meldung(r.art, text.value.trim()))
  }
  if (props.sofort) return
  // Zelle: Was nicht übernommen wurde (ungültig, oder von der Ansicht abgewiesen), bleibt nicht stehen.
  void nextTick(() => {
    if (text.value !== anzeige(props.modelValue)) zeigeStand()
  })
}
</script>

<template>
  <input
    type="text"
    :value="text"
    :placeholder="muster"
    :title="t('date.title', { pattern: muster })"
    :aria-invalid="fehlerhaft || undefined"
    autocomplete="off"
    spellcheck="false"
    data-datum
    @input="tippen"
    @change="bestaetige"
    @keydown.enter="bestaetige"
  />
</template>
