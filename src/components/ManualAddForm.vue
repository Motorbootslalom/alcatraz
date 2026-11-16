<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../state/store'
import { birthYearRange } from '../domain/classes'
import { SIZES } from '../domain/sizes'
import { makeStartNr, parseClassNumber } from '../domain/startnumbers'
import { startNrPraefixe } from '../config/catalog'
import { uid } from '../domain/ids'
import { useEvent } from '../lib/event'
import { originField, originLabelKey } from '../lib/origin'
import { geburtsjahr, jahrgaengeText, klassenFuerJahr, startendeJahrgaenge } from '../import/klassenPruefung'
import { t } from '../i18n'
import DatumFeld from './DatumFeld.vue'
import type { ClassId, Starter } from '../types'

const props = defineProps<{ classId: ClassId }>()
const emit = defineEmits<{ add: [p: Starter]; done: [] }>()

const { state } = useStore()
const { classLabel, regelwerk } = useEvent()
const range = computed(() => birthYearRange(props.classId, state.value.eventJahr))
const vorname = ref('')
const nachname = ref('')
const herkunft = ref('')
const geb = ref('')
const groesse = ref('')
/** Meldung des Datumsfelds: ein Datum, das es nicht gibt, oder ein unbekanntes Muster. */
const datumFehler = ref('')

/** Klassenbasiert folgt die nächste Nummer der Klasse; klassische bleiben leer, bis sie vergeben werden. */
function nextStartNr(klasse: ClassId): string {
  if (state.value.startNrMode === 'klassisch') return ''
  let max = 0
  const praefixe = startNrPraefixe(state.value)
  for (const p of state.value.starters) if (p.klasse === klasse) max = Math.max(max, parseClassNumber(p.startNr, klasse, praefixe) ?? 0)
  return makeStartNr(klasse, max + 1, praefixe)
}

/**
 * Ein Geburtsjahr, das nicht in die Klasse gehört, wird abgewiesen – wie beim Einfügen aus Excel
 * (import/klassenPruefung.ts): Wer in der falschen Klasse fährt, verfälscht deren Wertung. Ohne
 * Datum lässt sich nichts prüfen – das fällt in der Liste auf.
 *
 * Gehört der Jahrgang in eine andere Klasse des Regelwerks, bietet die Meldung an, den Starter
 * mit allen Angaben dort anzulegen (Entscheidung des Nutzers vom 15.11.2026); passt er in keine,
 * nennt sie die Jahrgänge, die überhaupt starten. Die Jahrgänge folgen aus dem Jahr der
 * Veranstaltung, die Klassen aus dem Regelwerk.
 */
const jahr = computed(() => geburtsjahr(geb.value))
const passtNicht = computed(() => jahr.value !== null && (jahr.value < range.value[0] || jahr.value > range.value[1]))
const andereKlasse = computed<ClassId | undefined>(() =>
  passtNicht.value ? klassenFuerJahr(jahr.value!, state.value.eventJahr, regelwerk.value.klassen).find((k) => k !== props.classId) : undefined,
)
const jahrFehler = computed(() => {
  if (!passtNicht.value) return ''
  const grund = t('starters.birthOutOfRange', { year: jahr.value!, class: classLabel(props.classId), from: range.value[0], to: range.value[1] })
  if (andereKlasse.value) return grund
  return `${grund} ${t('starters.birthNoClass', { years: jahrgaengeText(startendeJahrgaenge(state.value.eventJahr, regelwerk.value.klassen)) })}`
})
const zielBereich = computed(() => (andereKlasse.value ? birthYearRange(andereKlasse.value, state.value.eventJahr) : null))
const name = computed(() => [vorname.value.trim(), nachname.value.trim()].filter(Boolean).join(' '))
const unvollstaendig = computed(() => !vorname.value.trim() || !nachname.value.trim() || !!datumFehler.value)

function anlegen(klasse: ClassId) {
  const feld = originField(state.value.originMode)
  const wert = herkunft.value.trim()
  emit('add', {
    id: uid('st'),
    startNr: nextStartNr(klasse),
    vorname: vorname.value.trim(),
    nachname: nachname.value.trim(),
    verein: feld === 'verein' ? wert : '',
    bundesland: feld === 'bundesland' ? wert : '',
    ...(feld === 'land' && wert ? { land: wert } : {}),
    geburtsdatum: geb.value,
    klasse,
    groesse: groesse.value,
  })
  emit('done')
}

function submit() {
  if (unvollstaendig.value || jahrFehler.value) return
  anlegen(props.classId)
}

/** „In Klasse X anlegen“: dieselben Angaben, die Klasse, in die der Jahrgang gehört. */
function inAndereKlasse() {
  if (unvollstaendig.value || !andereKlasse.value) return
  anlegen(andereKlasse.value)
}
</script>

<template>
  <form class="panel add-form" @submit.prevent="submit">
    <div class="row">
      <div class="field" style="flex: 1; min-width: 120px">
        <label :for="`add-fn-${classId}`">{{ t('common.firstName') }}</label>
        <input :id="`add-fn-${classId}`" v-model="vorname" class="input" />
      </div>
      <div class="field" style="flex: 1; min-width: 120px">
        <label :for="`add-ln-${classId}`">{{ t('common.lastName') }}</label>
        <input :id="`add-ln-${classId}`" v-model="nachname" class="input" />
      </div>
      <div v-if="state.originMode !== 'none'" class="field" style="flex: 2; min-width: 160px">
        <label :for="`add-or-${classId}`">{{ t(originLabelKey(state.originMode)) }}</label>
        <input :id="`add-or-${classId}`" v-model="herkunft" class="input" />
      </div>
      <div class="field" style="width: 190px">
        <label :for="`add-bd-${classId}`">{{ t('starters.birthLabel', { from: range[0], to: range[1] }) }}</label>
        <!-- Eigenes Textfeld mit festem Muster – nie die Datumswahl des Browsers (mm/dd/yyyy). -->
        <DatumFeld :id="`add-bd-${classId}`" v-model="geb" class="input" sofort @fehler="datumFehler = $event" />
      </div>
      <div class="field" style="width: 80px">
        <label :for="`add-sz-${classId}`">{{ t('common.size') }}</label>
        <select :id="`add-sz-${classId}`" v-model="groesse" class="input">
          <option value="">–</option>
          <option v-for="s in SIZES" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>
      <button class="btn primary" type="submit" :disabled="unvollstaendig || !!jahrFehler">
        {{ t('common.add') }}
      </button>
    </div>
    <p v-if="datumFehler" class="boat-banner warn" role="alert" data-hinweis="datum-ungueltig">{{ datumFehler }}</p>
    <div v-else-if="jahrFehler" class="boat-banner warn" role="alert" data-hinweis="jahrgang-falsch">
      {{ jahrFehler }}
      <div v-if="andereKlasse && zielBereich" class="jahrgang-vorschlag">
        <button
          type="button"
          class="btn sm primary"
          data-action="in-klasse-anlegen"
          :data-klasse="andereKlasse"
          :disabled="unvollstaendig"
          :title="t('starters.addInClassTitle', { name: name || '…', class: classLabel(andereKlasse), from: zielBereich[0], to: zielBereich[1] })"
          @click="inAndereKlasse"
        >
          {{ t('starters.addInClass', { class: classLabel(andereKlasse) }) }}
        </button>
      </div>
    </div>
  </form>
</template>
