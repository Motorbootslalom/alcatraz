<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../state/store'
import { useEvent } from '../lib/event'
import { t } from '../i18n'
import type { RunningNumberConfig, RunningNumberSource, StartNrMode } from '../types'

/**
 * Art der Startnummern (klassenbasiert oder klassisch – nie beides) und die
 * automatische Vergabe. Von Hand ändern lassen sich die Nummern jederzeit im
 * Bearbeiten-Modus der Klassen.
 */
const { state, dispatch } = useStore()
const { parallel } = useEvent()
const emit = defineEmits<{ assigned: [] }>()
const MODES: StartNrMode[] = ['klasse', 'klassisch']
const SOURCES: RunningNumberSource[] = ['manoever', 'parallel']
const rn = computed(() => state.value.runningNumbers)

const set = (patch: Partial<RunningNumberConfig>) => dispatch({ type: 'SET_RUNNING_NUMBERS', patch })

function onStart(e: Event) {
  set({ start: Math.max(1, parseInt((e.target as HTMLInputElement).value, 10) || 1) })
}

function assign() {
  const hasNumbers = state.value.starters.some((p) => p.startNr.trim() !== '')
  if (!hasNumbers || confirm(t(`numbers.confirm.${state.value.startNrMode}`))) {
    dispatch({ type: 'ASSIGN_START_NUMBERS' })
    emit('assigned')
  }
}
</script>

<template>
  <div class="panel">
    <div class="export-head">
      <h2>{{ t('numbers.title') }}</h2>
      <div class="segmented">
        <button
          v-for="m in MODES"
          :key="m"
          type="button"
          :class="state.startNrMode === m ? 'active' : ''"
          :aria-pressed="state.startNrMode === m"
          @click="dispatch({ type: 'SET_START_NR_MODE', mode: m })"
        >
          {{ t(`numbers.mode.${m}`) }}
        </button>
      </div>
      <span style="flex: 1" />
      <button class="btn sm primary" :disabled="state.starters.length === 0" @click="assign">
        # {{ t('numbers.assign') }}
      </button>
    </div>
    <p class="hint">{{ t(`numbers.hint.${state.startNrMode}`) }}</p>

    <div v-if="state.startNrMode === 'klassisch'" class="running-fields">
      <div v-if="parallel" class="field" style="width: auto">
        <label>{{ t('running.source') }}</label>
        <div class="segmented">
          <button
            v-for="s in SOURCES"
            :key="s"
            type="button"
            :class="rn.source === s ? 'active' : ''"
            @click="set({ source: s })"
          >
            {{ t(`running.source.${s}`) }}
          </button>
        </div>
      </div>
      <div class="field" style="width: 120px">
        <label for="rn-start">{{ t('running.start') }}</label>
        <input id="rn-start" class="input" type="number" min="1" :value="rn.start" @input="onStart" />
      </div>
      <div class="field" style="flex: 1; min-width: 220px">
        <label for="rn-skip">{{ t('running.skip') }}</label>
        <input
          id="rn-skip"
          class="input"
          :value="rn.skipText"
          :placeholder="t('running.skipPlaceholder')"
          @input="set({ skipText: ($event.target as HTMLInputElement).value })"
        />
      </div>
    </div>
  </div>
</template>
