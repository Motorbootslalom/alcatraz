<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { ClassId, OeffentlicheSicht, PunktId, SichtBereich } from '../../types'
import type { BetriebAenderung } from '../../state/reducer/betrieb'
import { t } from '../../i18n'
import { merke } from '../../lib/merken'
import { punktText, punktVon, startZeile, tBereich } from './texte'

/**
 * „Einsteigen ab …“ (BETRIEB_AB, Vorbild startAt/firstSlotOf des Prototyps): wenn die Start-Freigabe erst
 * mitten im Wettkampf dazukommt oder ein anderer Rechner ohne aktuelle Sicherung übernimmt. Gewählt werden
 * Lauf und – wahlweise – Klasse; die Sicht nennt dazu den ersten noch nicht gezeigten Start (`einstieg`).
 * Was davor nicht gezeigt wurde, gilt als gefahren, aber ohne Anzeige und ohne Zeit.
 *
 * Ohne Rückfrage: Ein früherer Einstieg nimmt einen zu späten zurück (BETRIEB_ANNAHMEN.einsteigenOhneRueckfrage);
 * der gewählte Start ist danach der Nächste, auch wenn inzwischen schon gezeigt wurde.
 * Liest nur die öffentliche Sicht, schickt die Action über `sende`.
 */
const props = defineProps<{
  sicht: OeffentlicheSicht
  bereich: SichtBereich
  sende: (action: BetriebAenderung) => void
  gesperrt?: boolean
}>()

const b = computed(() => props.bereich)
const id = useId()
const offen = merke(`betrieb.einstieg.${props.bereich.id}`, false)

/** Die Punkte, in denen es noch einen nicht gezeigten Start gibt – in der Folge des Programms. */
const punkte = computed(() => b.value.programm.filter((p) => b.value.einstieg.some((e) => e.punkt === p.id && e.klasse === null)))

// Die Wahl gilt, solange es sie gibt; sonst der erste mögliche Punkt bzw. „erster Start des Laufs“.
const punktWahl = ref<PunktId | ''>('')
const klasseWahl = ref<ClassId | ''>('')
const punkt = computed<PunktId | null>(() => (punkte.value.some((p) => p.id === punktWahl.value) ? (punktWahl.value as PunktId) : (punkte.value[0]?.id ?? null)))
const klassen = computed(() => b.value.einstieg.filter((e) => e.punkt === punkt.value && e.klasse !== null).map((e) => e.klasse as ClassId))
const klasse = computed<ClassId | null>(() => (klasseWahl.value && klassen.value.includes(klasseWahl.value) ? klasseWahl.value : null))
const ziel = computed(() => b.value.einstieg.find((e) => e.punkt === punkt.value && e.klasse === klasse.value) ?? null)

/**
 * Der Start, ab dem es weitergeht: Der Einstieg ist selbst ein Start der Sicht (mit Starter), auch wenn er schon
 * „ohne Anzeige“ erledigt ist – ein früherer Einstieg nennt so, mit wem es weitergeht. Steht sein Starter nicht in
 * der Sicht (gelöscht), nur der Lauf.
 */
const zielText = computed(() => {
  const z = ziel.value
  if (!z) return ''
  if (props.sicht.starter[z.starter]) {
    const zeile = startZeile(props.sicht, z)
    return [zeile.startNr, zeile.name, zeile.was].filter(Boolean).join(' · ')
  }
  const p = punktVon(b.value, z.punkt)
  return p ? punktText(p) : ''
})

/** Ein anderer Lauf beginnt wieder bei seinem ersten Start – eine Klasse wählt man danach eigens. */
function waehlePunkt(e: Event) {
  punktWahl.value = (e.target as HTMLSelectElement).value as PunktId
  klasseWahl.value = ''
}

const name = (k: ClassId) => t('common.class', { id: props.sicht.klassen[k]?.name ?? k })

function einsteigen() {
  if (ziel.value) props.sende({ type: 'BETRIEB_AB', bereich: b.value.id, ref: ziel.value.key })
}
</script>

<template>
  <details class="betrieb-abschnitt" data-teil="einsteigen" :open="offen" @toggle="offen = ($event.target as HTMLDetailsElement).open">
    <summary>{{ t('betrieb.einstieg') }}</summary>
    <p class="note" data-teil="einstieg-hinweis">{{ tBereich(bereich, 'betrieb.einstieg.hint') }}</p>
    <p v-if="punkte.length === 0" class="note">{{ t('betrieb.einstieg.keiner') }}</p>
    <template v-else>
      <div class="row betrieb-einstieg">
        <div class="field">
          <label :for="`${id}-punkt`">{{ tBereich(bereich, 'betrieb.einstieg.punkt') }}</label>
          <select :id="`${id}-punkt`" class="input" data-feld="einstieg-punkt" :value="punkt ?? ''" :disabled="gesperrt" @change="waehlePunkt">
            <option v-for="p in punkte" :key="p.id" :value="p.id">{{ punktText(p) }}</option>
          </select>
        </div>
        <div class="field">
          <label :for="`${id}-klasse`">{{ t('betrieb.einstieg.klasse') }}</label>
          <select :id="`${id}-klasse`" class="input" data-feld="einstieg-klasse" :value="klasse ?? ''" :disabled="gesperrt" @change="klasseWahl = ($event.target as HTMLSelectElement).value as ClassId | ''">
            <option value="">{{ tBereich(bereich, 'betrieb.einstieg.alleKlassen') }}</option>
            <option v-for="k in klassen" :key="k" :value="k">{{ name(k) }}</option>
          </select>
        </div>
      </div>
      <p v-if="zielText" class="note" data-teil="einstieg-start">{{ t('betrieb.einstieg.ab', { start: zielText }) }}</p>
      <button type="button" class="btn" data-action="einsteigen" :disabled="gesperrt || !ziel" @click="einsteigen">{{ t('betrieb.einstieg.los') }}</button>
    </template>
  </details>
</template>
