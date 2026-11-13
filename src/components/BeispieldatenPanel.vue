<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import type { Zeitnahme } from '../lib/beispielwerte'
import { classColor } from '../domain/classes'
import { generateStarters } from '../domain/generate'
import { useEvent } from '../lib/event'
import { verlustText } from '../lib/eingabenVerlust'
import { t, tn } from '../i18n'
import type { ClassId, Starter } from '../types'

/**
 * Beispieldaten am Ende der Ansicht „Veranstaltung“: ein erfundenes Starterfeld und dazu
 * Beispielwerte für Erfassung und Ergebnislisten. Der Block steht dort – und nicht unter
 * „Einstellungen“ –, damit Neue gleich sehen, dass sich alles gefahrlos ausprobieren lässt.
 *
 * Zugeklappt, solange mit echten Startern gearbeitet wird: Der Block soll dann nicht stören.
 * Aufgeklappt, sobald das Starterfeld aus Beispieldaten stammt (`beispielStarter` im Stand):
 * Wer ausprobiert, will als Nächstes Beispielwerte ergänzen.
 */
const { state, dispatch } = useStore()
const { regelwerk, classLabel } = useEvent()

// Von Hand auf- oder zuklappen geht weiter; ein frisch erzeugtes Beispiel-Starterfeld öffnet den Block.
const offen = ref(state.value.beispielStarter)
watch(
  () => state.value.beispielStarter,
  (beispiel) => {
    if (beispiel) offen.value = true
  },
)

// Nur für die Klassen des Regelwerks.
const CLASSES = computed(() => regelwerk.value.klassen.map((id) => ({ id, color: classColor(id) })))

// --- Beispiel-Starterfeld ----------------------------------------------------
const counts = reactive<Partial<Record<ClassId, number>>>({})
const countOf = (id: ClassId) => counts[id] ?? 6

function setCount(id: ClassId, e: Event) {
  counts[id] = Math.max(0, Math.min(99, parseInt((e.target as HTMLInputElement).value, 10) || 0))
}

const total = computed(() => CLASSES.value.reduce((sum, c) => sum + countOf(c.id), 0))

function generate() {
  const existing = state.value.starters.length
  if (existing > 0 && !confirm(t('demo.confirm', { n: existing }) + verlustText(state.value, state.value.starters))) return
  // Erfundene Starter entstehen hier und nicht im Reducer – der bleibt frei von Zufall.
  const origin = state.value.originMode === 'none' ? 'verein' : state.value.originMode
  let starters: Starter[] = []
  for (const c of CLASSES.value) {
    if (countOf(c.id) > 0) {
      starters = starters.concat(generateStarters(c.id, countOf(c.id), state.value.eventJahr, origin, starters))
    }
  }
  dispatch({ type: 'CLEAR_ALL_STARTERS' })
  dispatch({ type: 'ADD_STARTERS', starters, beispiel: true })
}

// --- Beispielwerte -----------------------------------------------------------
const ZEITNAHMEN: Zeitnahme[] = ['stoppuhr', 'lichtschranke']
// Die Schlüssel stammen aus der Zeit, als der Block unter „Einstellungen“ stand; sie bleiben,
// damit eine in diesem Fenster getroffene Wahl nicht verloren geht.
const zeitnahme = merke<Zeitnahme>('einstellungen.zeitnahme', 'stoppuhr')
const beispielBis = merke('einstellungen.beispielBis', 0)
const laufWahl = computed(() => Array.from({ length: Math.max(1, state.value.laufCount) }, (_, i) => i + 1))
/** Bis zu welchem Lauf gefüllt wird; die Vorgabe sind alle Läufe. */
const bisLauf = computed(() => (laufWahl.value.includes(beispielBis.value) ? beispielBis.value : laufWahl.value.length))
const werteZahl = computed(() =>
  Object.values(state.value.eingaben).reduce((n, zeilen) => n + Object.values(zeilen).reduce((m, werte) => m + Object.keys(werte).filter((k) => !k.startsWith('erfasst@')).length, 0), 0),
)

function beispielwerte() {
  if (werteZahl.value > 0 && !confirm(t('demo.values.confirm'))) return
  // Der Zufall entsteht hier und reist als Saat in der Action – der Reducer bleibt deterministisch.
  const saat = Math.floor(Math.random() * 0x100000000)
  dispatch({ type: 'FILL_BEISPIELWERTE', zeitnahme: zeitnahme.value, saat, laeufe: laufWahl.value.filter((l) => l <= bisLauf.value) })
}

function werteLoeschen() {
  if (confirm(t('demo.values.clearConfirm'))) dispatch({ type: 'CLEAR_EINGABEN' })
}
</script>

<template>
  <details class="panel" data-block="beispieldaten" :open="offen" @toggle="offen = ($event.target as HTMLDetailsElement).open">
    <summary>{{ t('demo.title') }}</summary>
    <p class="hint">{{ t('demo.intro') }}</p>
    <div class="subhead">{{ t('demo.perClass') }}</div>
    <div class="setup-grid">
      <label v-for="c in CLASSES" :key="c.id" class="class-count">
        <span class="dot" :style="{ background: c.color }" />
        <span class="meta"><span class="name">{{ classLabel(c.id) }}</span></span>
        <input type="number" min="0" max="99" :value="countOf(c.id)" @input="setCount(c.id, $event)" />
      </label>
    </div>
    <div class="row" style="justify-content: flex-end">
      <button class="btn" data-action="beispielstarter" :disabled="total === 0" @click="generate">{{ t('demo.generate') }}</button>
    </div>

    <!-- Beispielwerte für Erfassung und Ergebnislisten: Zufall nach den Häufigkeiten früherer Wettkämpfe. -->
    <div class="subhead">{{ t('demo.values.title') }}</div>
    <p class="hint">{{ t('demo.values.intro') }}</p>
    <div class="row" style="align-items: flex-end; gap: 20px">
      <div class="field">
        <label>{{ t('demo.values.timing') }}</label>
        <div class="segmented">
          <button v-for="z in ZEITNAHMEN" :key="z" type="button" :class="zeitnahme === z ? 'active' : ''" :aria-pressed="zeitnahme === z" :data-zeitnahme="z" @click="zeitnahme = z">
            {{ t(`demo.values.timing.${z}`) }}
          </button>
        </div>
      </div>
      <div class="field">
        <label for="beispiel-laeufe">{{ t('demo.values.runs') }}</label>
        <select id="beispiel-laeufe" class="input" data-feld="beispiel-laeufe" :value="bisLauf" @change="beispielBis = Number(($event.target as HTMLSelectElement).value)">
          <option v-for="l in laufWahl" :key="l" :value="l">{{ t('demo.values.runsUpTo', { n: l }) }}</option>
        </select>
      </div>
      <span style="flex: 1" />
      <button class="btn" data-action="beispielwerte" :disabled="state.starters.length === 0" @click="beispielwerte">{{ t('demo.values.fill') }}</button>
    </div>
    <div class="row" style="align-items: center">
      <span class="note" data-hinweis="werte" role="status" style="flex: 1; margin: 0">{{ tn('demo.values.count', werteZahl) }}</span>
      <button class="btn danger sm" data-action="werte-loeschen" :disabled="Object.keys(state.eingaben).length === 0" @click="werteLoeschen">{{ t('demo.values.clear') }}</button>
    </div>
  </details>
</template>
