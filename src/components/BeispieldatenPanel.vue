<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import { startNrPraefixe } from '../config/catalog'
import type { Zeitnahme } from '../lib/beispielwerte'
import { classColor } from '../domain/classes'
import { beispielHerkuenfte, generateStarters } from '../domain/generate'
import { useEvent } from '../lib/event'
import { verlustText } from '../lib/eingabenVerlust'
import { laufSchluessel, OHNE_LAUF, starterfeldFest } from '../lib/eingaben'
import { attemptSchluessel } from '../lib/parallelSchluessel'
import { useKonfig } from '../lib/konfig'
import { sprungziel } from '../lib/router'
import StarterSperre from './StarterSperre.vue'
import { rundenName, vergleicheRunden, VORLAUF, vorlaufGebunden } from '../planung/parallelRunden'
import { festeRunden } from '../lib/parallelBogen'
import type { ParallelRunde } from '../types'
import { t, tn } from '../i18n'
import type { ClassId, Starter } from '../types'

/**
 * Beispieldaten am Ende der Ansicht „Veranstaltung“: ein erfundenes Starterfeld und dazu
 * Beispielwerte für Erfassung und Wertungslisten. Der Block steht dort – und nicht unter
 * „Einstellungen“ –, damit Neue gleich sehen, dass sich alles gefahrlos ausprobieren lässt.
 *
 * Zugeklappt, solange mit echten Startern gearbeitet wird: Der Block soll dann nicht stören.
 * Aufgeklappt, sobald das Starterfeld aus Beispieldaten stammt (`beispielStarter` im Stand):
 * Wer ausprobiert, will als Nächstes Beispielwerte ergänzen.
 */
const { state, dispatch } = useStore()
const { regelwerk, classLabel, parallel } = useEvent()
const konfig = useKonfig()

// Von Hand auf- oder zuklappen geht weiter; ein frisch erzeugtes Beispiel-Starterfeld öffnet den Block.
// Ebenso der Verweis aus dem Hinweis auf das feste Starterfeld (`#/veranstaltung?werte`): Er
// führt zu „Alle erfassten Werte löschen“ in diesem Block.
const block = ref<HTMLElement | null>(null)
const gerufen = sprungziel() === 'werte'
const offen = ref(state.value.beispielStarter || gerufen)
onMounted(async () => {
  if (!gerufen) return
  await nextTick()
  block.value?.scrollIntoView?.({ block: 'start' })
})
watch(
  () => state.value.beispielStarter,
  (beispiel) => {
    if (beispiel) offen.value = true
  },
)

// Nur für die Klassen des Regelwerks.
const CLASSES = computed(() => regelwerk.value.klassen.map((id) => ({ id, color: classColor(id) })))

// --- Beispiel-Starterfeld ----------------------------------------------------
// Die Zahl je Klasse bleibt wie jede andere Wahl in diesem Block über das Neuladen hinweg stehen
// (lib/merken.ts): Wer 65 Starter erzeugt hat, sieht nach dem Neuladen 65 und nicht die Vorgabe.
// Nicht gewählte Klassen haben die Vorgabe 6.
const VORGABE_JE_KLASSE = 6
const istAnzahl = (w: unknown) => typeof w === 'number' && Number.isInteger(w) && w >= 0 && w <= 99
const counts = merke<Partial<Record<ClassId, number>>>('beispiel.anzahlen', {}, {
  ueberNeuladen: true,
  gueltig: (w) => typeof w === 'object' && w !== null && !Array.isArray(w) && Object.values(w).every(istAnzahl),
})
const countOf = (id: ClassId) => counts.value[id] ?? VORGABE_JE_KLASSE

function setCount(id: ClassId, e: Event) {
  counts.value = { ...counts.value, [id]: Math.max(0, Math.min(99, parseInt((e.target as HTMLInputElement).value, 10) || 0)) }
}

const total = computed(() => CLASSES.value.reduce((sum, c) => sum + countOf(c.id), 0))

// Herkünfte: unbegrenzt (gewürfelt aus allen) oder eine Zahl – dann verteilen sich die Starter
// reihum auf so viele Vereine bzw. Bundesländer oder Nationen, je nach Art der Herkunft. So lässt
// sich die Mannschaftswertung prüfen (Entscheidung des Nutzers vom 15.11.2026). 0 = unbegrenzt.
const herkuenfte = merke('beispiel.herkuenfte', 0, { ueberNeuladen: true, gueltig: (w) => typeof w === 'number' && Number.isInteger(w) && w >= 0 && w <= 99 })
function setHerkuenfte(e: Event) {
  herkuenfte.value = Math.max(0, Math.min(99, parseInt((e.target as HTMLInputElement).value, 10) || 0))
}

// Sobald Ergebnisse erfasst sind, steht das Starterfeld fest (components/StarterSperre.vue).
const fest = computed(() => starterfeldFest(state.value))

function generate() {
  if (fest.value) return
  const existing = state.value.starters.length
  if (existing > 0 && !confirm(t('demo.confirm', { n: existing }) + verlustText(state.value, state.value.starters))) return
  // Erfundene Starter entstehen hier und nicht im Reducer – der bleibt frei von Zufall.
  // Unter UIM (Regelwerk mit Parallelslalom) immer Nationen, nie Vereine (Entscheidung des Nutzers
  // vom 15.11.2026): Die Herkunft der Veranstaltung wird dazu auf „Land“ gestellt.
  if (parallel.value && state.value.originMode !== 'land') dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'land' })
  const origin = parallel.value ? 'land' : state.value.originMode === 'none' ? 'verein' : state.value.originMode
  const feste = herkuenfte.value > 0 ? beispielHerkuenfte(origin, herkuenfte.value) : undefined
  let starters: Starter[] = []
  for (const c of CLASSES.value) {
    if (countOf(c.id) > 0) {
      // Das Geschlecht nur, wo eine Liste danach fragt (Regel 960, Pkt. 3.7): unter der DM nicht.
      starters = starters.concat(generateStarters(c.id, countOf(c.id), state.value.eventJahr, origin, starters, startNrPraefixe(state.value), feste, parallel.value))
    }
  }
  dispatch({ type: 'CLEAR_ALL_STARTERS' })
  dispatch({ type: 'ADD_STARTERS', starters, beispiel: true })
}

// --- Beispielwerte -----------------------------------------------------------
const ZEITNAHMEN: Zeitnahme[] = ['stoppuhr', 'lichtschranke']
// Die Schlüssel stammen aus der Zeit, als der Block unter „Einstellungen“ stand; sie bleiben,
// damit eine in diesem Fenster getroffene Wahl nicht verloren geht.
const zeitnahme = merke<Zeitnahme>('einstellungen.zeitnahme', 'stoppuhr', { ueberNeuladen: true, gueltig: (w) => ZEITNAHMEN.includes(w as Zeitnahme) })
const beispielBis = merke('einstellungen.beispielBis', 0, { ueberNeuladen: true })
const laufWahl = computed(() => Array.from({ length: Math.max(1, state.value.laufCount) }, (_, i) => i + 1))
/** Bis zu welchem Lauf gefüllt wird; die Vorgabe sind alle Läufe. */
const bisLauf = computed(() => (laufWahl.value.includes(beispielBis.value) ? beispielBis.value : laufWahl.value.length))
// Gezählt werden erfasste Werte, ohne die Haken „erfasst“: Ein Haken ist kein Wert der Wertung.
// Die Rückfrage vor dem Löschen einer Runde (lib/parallelStage.ts `rundenWerteZahl`) zählt die
// Haken dagegen mit und sagt das – dort geht es darum, was verloren geht.
const werteZahl = computed(() =>
  Object.values(state.value.eingaben).reduce((n, zeilen) => n + Object.values(zeilen).reduce((m, werte) => m + Object.keys(werte).filter((k) => !k.startsWith('erfasst@')).length, 0), 0),
)

// Was gefüllt (und was gelöscht) wird, ist eine Auswahl (Entscheidung des Nutzers vom 15.11.2026):
// das Manövrieren – bis zum gewählten Lauf – oder eine einzelne Runde des Parallelslaloms. Eine
// Runde ist erst wählbar, wenn ihr Startplan festgeschrieben ist: Ohne Plan gibt es keine Liste,
// auf der die Werte stünden. Unter einem Regelwerk ohne Parallelslalom gibt es nichts zu wählen.
const MANOEVER = 'manoever'
type Was = typeof MANOEVER | ParallelRunde
const feste = computed(() => (parallel.value ? festeRunden(state.value.parallelPlaene) : []))
/** Vorlauf, Halbfinale und Finals stehen immer zur Wahl (gesperrt ohne Plan), Wiederholungen, sobald es sie gibt – in der Folge, in der gefahren wird. */
const rundenWahl = computed<ParallelRunde[]>(() => (parallel.value ? [...new Set<ParallelRunde>([VORLAUF, 'semi', 'final', ...feste.value])].sort(vergleicheRunden) : []))
const wasWahl = merke<Was>('beispiel.was', MANOEVER, { ueberNeuladen: true, gueltig: (w) => typeof w === 'string' })
/** Das Gewählte – eine Runde ohne festgeschriebenen Plan zählt wie „Manövrieren“. */
const was = computed<Was>(() => (wasWahl.value !== MANOEVER && feste.value.includes(wasWahl.value) ? wasWahl.value : MANOEVER))
/** Im Finale fahren beide Finals: das um Platz 1 und 2 und das kleine um Platz 3 und 4. */
const rundenText = (r: ParallelRunde) => (r === 'final' ? `${rundenName(r, t)} (${t('demo.values.finals')})` : rundenName(r, t))

const laeufeGewaehlt = computed(() => laufWahl.value.filter((l) => l <= bisLauf.value))
/** Die Lauf-Schlüssel des Gewählten – daran hängt, was „ersetzen“ und „löschen“ trifft (wie im Reducer). */
const schluesselGewaehlt = computed(() => {
  const w = was.value
  if (w !== MANOEVER) return [attemptSchluessel(w, 1), attemptSchluessel(w, 2)]
  const disziplin = konfig.value.getAufbau(state.value.aufbau).disziplin
  return laeufeGewaehlt.value.flatMap((l) => [laufSchluessel(disziplin, l), ...(l === 1 ? [laufSchluessel(disziplin, OHNE_LAUF)] : [])])
})
const werteGewaehlt = computed(() => schluesselGewaehlt.value.filter((k) => state.value.eingaben[k] !== undefined).length)
/** Die Runden nach dem Vorlauf werden je Klasse festgeschrieben: Dort werden nur Attempts ohne Werte gefüllt. */
const nurLeere = computed(() => was.value !== MANOEVER && was.value !== VORLAUF)

function beispielwerte() {
  if (!nurLeere.value && werteGewaehlt.value > 0 && !confirm(t('demo.values.confirm'))) return
  // Der Zufall entsteht hier und reist als Saat in der Action – der Reducer bleibt deterministisch.
  const saat = Math.floor(Math.random() * 0x100000000)
  const w = was.value
  if (w === MANOEVER) dispatch({ type: 'FILL_BEISPIELWERTE', zeitnahme: zeitnahme.value, saat, laeufe: laeufeGewaehlt.value })
  else dispatch({ type: 'FILL_BEISPIELWERTE', zeitnahme: zeitnahme.value, saat, runden: [w], nurRunden: true, ...(nurLeere.value ? { nurLeere: true } : {}) })
}

function gewaehltesLoeschen() {
  if (!confirm(t('demo.values.clearSelectedConfirm'))) return
  const w = was.value
  dispatch(w === MANOEVER ? { type: 'CLEAR_EINGABEN_TEIL', laeufe: laeufeGewaehlt.value } : { type: 'CLEAR_EINGABEN_TEIL', runden: [w] })
}

// Ein Plan des Vorlaufs, der bei freigegebener Verzahnung noch steht, entfällt nur über diesen
// Knopf – auch wenn das letzte einzelne Feld schon geleert ist (planung/parallelRunden.ts).
const planHaengt = computed(() => !state.value.verzahnungLocked && vorlaufGebunden(state.value))

function werteLoeschen() {
  if (confirm(t('demo.values.clearConfirm'))) dispatch({ type: 'CLEAR_EINGABEN' })
}
</script>

<template>
  <details ref="block" class="panel" data-block="beispieldaten" :open="offen" @toggle="offen = ($event.target as HTMLDetailsElement).open">
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
    <div class="row" style="justify-content: flex-end; align-items: flex-end; gap: 20px">
      <!-- 0 = unbegrenzt: Die Herkunft jedes Starters wird aus allen gewürfelt. -->
      <div class="field" style="width: 220px">
        <label for="beispiel-herkuenfte">{{ t('demo.origins') }}</label>
        <input id="beispiel-herkuenfte" class="input" type="number" min="0" max="99" data-feld="beispiel-herkuenfte" :value="herkuenfte || ''" :placeholder="t('demo.origins.unlimited')" :title="t('demo.origins.hint')" @change="setHerkuenfte" />
      </div>
      <button class="btn" data-action="beispielstarter" :disabled="total === 0 || fest" @click="generate">{{ t('demo.generate') }}</button>
    </div>
    <StarterSperre />

    <!-- Beispielwerte für Erfassung und Wertungslisten: Zufall nach den Häufigkeiten früherer Wettkämpfe. -->
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
      <!-- Was gefüllt wird: das Manövrieren oder eine Runde des Parallelslaloms (erst mit festgeschriebenem Plan). -->
      <div v-if="parallel" class="field">
        <label for="beispiel-was">{{ t('demo.values.what') }}</label>
        <select id="beispiel-was" class="input" data-feld="beispiel-was" :value="was" @change="wasWahl = ($event.target as HTMLSelectElement).value as Was">
          <option :value="MANOEVER">{{ t('running.source.manoever') }}</option>
          <optgroup :label="t('parallel.title')">
            <option v-for="r in rundenWahl" :key="r" :value="r" :disabled="!feste.includes(r)">{{ rundenText(r) }}</option>
          </optgroup>
        </select>
      </div>
      <div v-if="was === MANOEVER" class="field">
        <label for="beispiel-laeufe">{{ t('demo.values.runs') }}</label>
        <select id="beispiel-laeufe" class="input" data-feld="beispiel-laeufe" :value="bisLauf" @change="beispielBis = Number(($event.target as HTMLSelectElement).value)">
          <option v-for="l in laufWahl" :key="l" :value="l">{{ t('demo.values.runsUpTo', { n: l }) }}</option>
        </select>
      </div>
      <span style="flex: 1" />
      <button class="btn danger sm" data-action="werte-loeschen-gewaehlt" :disabled="werteGewaehlt === 0" @click="gewaehltesLoeschen">{{ t('demo.values.clearSelected') }}</button>
      <button class="btn" data-action="beispielwerte" :disabled="state.starters.length === 0" @click="beispielwerte">{{ t('demo.values.fill') }}</button>
    </div>
    <p v-if="parallel" class="note" data-hinweis="beispiel-auswahl">{{ t(nurLeere ? 'demo.values.roundNote' : 'demo.values.heatNote') }}</p>
    <div class="row" style="align-items: center">
      <span class="note" data-hinweis="werte" role="status" style="flex: 1; margin: 0">{{ tn('demo.values.count', werteZahl) }}</span>
      <button class="btn danger sm" data-action="werte-loeschen" :disabled="Object.keys(state.eingaben).length === 0 && !planHaengt" @click="werteLoeschen">{{ t('demo.values.clear') }}</button>
    </div>
  </details>
</template>
