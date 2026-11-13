<script setup lang="ts">
import { computed } from 'vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import { assignStartNumbers } from '../state/reducer'
import { CLASSES, CLASS_IDS } from '../domain/classes'
import { uid } from '../domain/ids'
import { planEvent } from '../planung/plan'
import { useEvent } from '../lib/event'
import { t } from '../i18n'
import BoatPanel from '../components/BoatPanel.vue'
import ParcoursCard from '../components/ParcoursCard.vue'
import ParallelView from './ParallelView.vue'
import type { ClassId } from '../types'

/** Vorlagen für die Aufteilung der Klassen auf Parcours. */
const PRESETS = [
  { key: 'all', groups: [['E', '1', '2', '3', '4', '5', '6', '7']] },
  { key: 'split', groups: [['E', '1', '2', '3'], ['4', '5', '6', '7']] },
] as const satisfies readonly { key: string; groups: ClassId[][] }[]

/** Signatur einer Aufteilung – zum Abgleich mit einer Vorlage. */
function signature(groups: readonly (readonly ClassId[])[]): string {
  return groups.map((g) => [...g].sort((a, b) => CLASS_IDS.indexOf(a) - CLASS_IDS.indexOf(b)).join('')).join('|')
}

const { state, dispatch } = useStore()
const { classLabel, parallel } = useEvent()

// Der Parallelslalom ist ein Unterpunkt der Verzahnung – und nur da, wenn das
// Regelwerk ihn kennt (UIM). Nach den Regeln der DM gibt es nur das Manövrieren.
const DISCIPLINES = ['manoever', 'parallel'] as const
const chosen = merke<(typeof DISCIPLINES)[number]>('verzahnung.disziplin', 'manoever')
const discipline = computed(() => (parallel.value ? chosen.value : 'manoever'))

const unassigned = computed(() => {
  const assigned = new Set(state.value.parcoursList.flatMap((p) => p.classIds))
  return CLASSES.filter((c) => !assigned.has(c.id) && state.value.starters.some((p) => p.klasse === c.id))
})

const currentSig = computed(() => signature(state.value.parcoursList.map((p) => p.classIds)))

// Die gezeigte Verzahnung hält den Bootbestand ein.
const eventPlan = computed(() => planEvent(state.value))
const planById = computed(() => new Map(eventPlan.value.plans.map((p) => [p.parcoursId, p])))

// Die Verzahnung bestimmt Startnummern und damit alle Listen. Ist sie
// festgeschrieben, bleibt alles, was sie verändern würde, gesperrt.
const locked = computed(() => state.value.verzahnungLocked)

function lock() {
  // Die gezeigten Spuren werden zur festen Anordnung – spätere Nachmeldungen verschieben keine Klasse mehr.
  const tracks = Object.fromEntries(eventPlan.value.plans.map((p) => [p.parcoursId, p.tracks]))
  dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true, tracks })
}

// Klassische Startnummern laufen in der Reihenfolge der Verzahnung durch. Ändert sich diese,
// passen sie nicht mehr – neu vergeben wird aber nie von selbst: Nummern können schon
// gedruckt oder ausgegeben sein. Deshalb hier nur der Knopf und ein Hinweis, wenn sie abweichen.
const klassisch = computed(() => state.value.startNrMode === 'klassisch')
const nummernVeraltet = computed(() => {
  if (!klassisch.value || state.value.starters.length === 0) return false
  const neu = new Map(assignStartNumbers(state.value).map((s) => [s.id, s.startNr]))
  return state.value.starters.some((s) => s.startNr !== neu.get(s.id))
})

function renumber() {
  const hasNumbers = state.value.starters.some((p) => p.startNr.trim() !== '')
  if (!hasNumbers || confirm(t('numbers.confirm.klassisch'))) dispatch({ type: 'ASSIGN_START_NUMBERS' })
}

function unlock() {
  if (confirm(t('vz.unlockConfirm'))) dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: false })
}

function applyPreset(groups: readonly (readonly ClassId[])[]) {
  if (currentSig.value === signature(groups)) return
  // Vorhandene Kennungen der Reihe nach wiederverwenden: Parcours 1 bleibt Parcours 1, und
  // was an der Kennung hängt (die WKR-Einteilung), bleibt daran.
  const vorhanden = state.value.parcoursList
  dispatch({
    type: 'SET_PARCOURS_PRESET',
    parcours: groups.map((classIds, i) => ({ id: vorhanden[i]?.id ?? uid('par'), classIds: [...classIds] })),
  })
}
</script>

<template>
  <div v-if="parallel" class="subnav">
    <div class="segmented" role="group" :aria-label="t('nav.verzahnung')">
      <button
        v-for="d in DISCIPLINES"
        :key="d"
        type="button"
        :class="discipline === d ? 'active' : ''"
        :aria-pressed="discipline === d"
        @click="chosen = d"
      >
        {{ t(`running.source.${d}`) }}
      </button>
    </div>
  </div>

  <div :class="['panel', 'lock-bar', locked ? 'locked' : '']" role="status">
    <span class="lock-text">
      <b>{{ locked ? t('vz.locked') : t('vz.open') }}</b>
      {{ locked ? t('vz.lockedNote') : t('vz.openNote') }}
    </span>
    <button v-if="locked" class="btn" @click="unlock">{{ t('vz.unlock') }}</button>
    <button v-else class="btn primary" :disabled="state.starters.length === 0" @click="lock">{{ t('vz.lock') }}</button>
  </div>

  <div v-if="klassisch" :class="['panel', 'lock-bar', nummernVeraltet ? 'stale' : '']" data-leiste="nummern" role="status">
    <span class="lock-text">
      <b>{{ nummernVeraltet ? t('vz.numbers.stale') : t('vz.numbers.ok') }}</b>
      {{ t('vz.numbers.note') }}
    </span>
    <button :class="['btn', nummernVeraltet ? 'primary' : '']" data-action="renumber" :disabled="state.starters.length === 0" @click="renumber">
      # {{ t('vz.numbers.assign') }}
    </button>
  </div>

  <fieldset class="lockable" :disabled="locked">
  <ParallelView v-if="discipline === 'parallel'" />

  <template v-else>
  <div class="panel">
    <h2>{{ t('vz.title') }}</h2>
    <p class="hint">{{ t('vz.hint') }}</p>
    <div class="preset-row">
      <span class="preset-label">{{ t('vz.presets') }}</span>
      <div class="segmented">
        <button
          v-for="pr in PRESETS"
          :key="pr.key"
          type="button"
          :class="currentSig === signature(pr.groups) ? 'active' : ''"
          :title="currentSig === signature(pr.groups) ? t('vz.presetActive') : t('vz.presetApply')"
          @click="applyPreset(pr.groups)"
        >
          {{ t(`vz.preset.${pr.key}`) }}
        </button>
      </div>
    </div>
    <p v-if="unassigned.length > 0" class="note" style="color: var(--danger)" role="status">
      {{ t('vz.unassigned', { classes: unassigned.map((c) => classLabel(c.id)).join(', ') }) }}
    </p>
  </div>

  <BoatPanel :plan="eventPlan" />

  <template v-for="p in state.parcoursList" :key="p.id">
    <ParcoursCard v-if="planById.get(p.id)" :parcours="p" :plan="planById.get(p.id)!" :locked="locked" />
  </template>

  <button class="btn" @click="dispatch({ type: 'ADD_PARCOURS', id: uid('par') })">{{ t('vz.addParcours') }}</button>
  </template>
  </fieldset>
</template>
