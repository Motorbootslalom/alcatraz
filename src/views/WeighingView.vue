<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../state/store'
import { classColor } from '../domain/classes'
import { ausgleichKg, gewichtsGruppen, parseGewicht } from '../domain/gewicht'
import { sollgewichtOf } from '../config/catalog'
import { useEvent } from '../lib/event'
import { originLabelKey } from '../lib/origin'
import { t } from '../i18n'
import type { Starter } from '../types'

/**
 * Verwiegung: die Gewichte aus den ausgefüllten Gewichtslisten übernehmen. Die
 * Reihenfolge ist dieselbe wie auf dem Ausdruck (je Herkunft: Klasse, Name,
 * Vorname), damit sich die Liste von oben nach unten abtippen lässt.
 */
const { state, dispatch } = useStore()
const { classLabel } = useEvent()

const groups = computed(() => gewichtsGruppen(state.value.starters, state.value.originMode))
const chosen = ref('')
const shown = computed(() => {
  const hit = groups.value.filter((g) => g.origin === chosen.value)
  return chosen.value && hit.length > 0 ? hit : groups.value
})

const weighed = (list: Starter[]) => list.filter((p) => p.gewicht !== undefined).length
const total = computed(() => state.value.starters.length)
const done = computed(() => weighed(state.value.starters))

const soll = (p: Starter) => sollgewichtOf(state.value.regelwerk, state.value.sollgewicht, p.klasse)

function ausgleich(p: Starter): string {
  const kg = ausgleichKg(p.gewicht, soll(p))
  return kg === undefined ? '' : kg === null ? '–' : `${kg} kg`
}

function setWeight(p: Starter, e: Event) {
  const input = e.target as HTMLInputElement
  const gewicht = parseGewicht(input.value)
  dispatch({ type: 'SET_WEIGHT', id: p.id, gewicht: gewicht ?? null })
  // Unlesbares nicht stehen lassen – das Feld zeigt, was gespeichert ist.
  input.value = gewicht === undefined ? '' : String(gewicht).replace('.', ',')
}

/** Mit Enter ins nächste Gewichtsfeld – wie beim Abtippen einer Liste üblich. */
function next(e: Event) {
  const inputs = [...document.querySelectorAll<HTMLInputElement>('.weight-input')]
  inputs[inputs.indexOf(e.target as HTMLInputElement) + 1]?.focus()
}
</script>

<template>
  <div class="panel">
    <div class="export-head">
      <h2>{{ t('weigh.title') }}</h2>
      <span style="flex: 1" />
      <span class="pstat"><b>{{ t('weigh.progress', { done, total }) }}</b></span>
    </div>
    <p class="hint">{{ t('weigh.hint') }}</p>
    <div v-if="groups.length > 1" class="field" style="max-width: 360px">
      <label for="weigh-origin">{{ t(originLabelKey(state.originMode)) }}</label>
      <select id="weigh-origin" v-model="chosen" class="input">
        <option value="">{{ t('weigh.all') }}</option>
        <option v-for="g in groups" :key="g.origin" :value="g.origin">
          {{ g.origin || t('weigh.noOrigin') }} ({{ weighed(g.starters) }}/{{ g.starters.length }})
        </option>
      </select>
    </div>
  </div>

  <div v-if="total === 0" class="panel empty">{{ t('lists.empty') }}</div>

  <section v-for="g in shown" :key="g.origin" class="panel">
    <div class="export-head">
      <h2>{{ g.origin || t('weigh.noOrigin') }}</h2>
      <span style="flex: 1" />
      <span class="note" style="margin: 0">{{ t('weigh.progress', { done: weighed(g.starters), total: g.starters.length }) }}</span>
    </div>
    <table class="starters weigh-table">
      <thead>
        <tr>
          <th style="width: 120px">{{ t('lists.class') }}</th>
          <th>{{ t('common.lastName') }}</th>
          <th>{{ t('common.firstName') }}</th>
          <th class="right" style="width: 130px">{{ t('weigh.standard') }}</th>
          <th style="width: 130px">{{ t('weigh.weight') }}</th>
          <th style="width: 120px">{{ t('weigh.ballast') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in g.starters" :key="p.id">
          <td>
            <span class="class-badge sm" :style="{ background: classColor(p.klasse) }">{{ p.klasse }}</span>
            {{ classLabel(p.klasse) }}
          </td>
          <td>{{ p.nachname }}</td>
          <td>{{ p.vorname }}</td>
          <td class="right">{{ soll(p) }} kg</td>
          <td>
            <input
              class="cell-input weight-input"
              inputmode="decimal"
              :value="p.gewicht === undefined ? '' : String(p.gewicht).replace('.', ',')"
              :aria-label="t('weigh.weightFor', { name: `${p.vorname} ${p.nachname}` })"
              @change="setWeight(p, $event)"
              @keydown.enter="next"
            />
          </td>
          <td :class="ausgleichKg(p.gewicht, soll(p)) ? 'ballast' : ''">{{ ausgleich(p) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
