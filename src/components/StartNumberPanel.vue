<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../state/store'
import { useEvent } from '../lib/event'
import { t, tn } from '../i18n'
import { startNrRegeln } from '../config/catalog'
import { startNrAbweichungen } from '../domain/startnrBereiche'
import type { RunningNumberConfig, RunningNumberSource, StartNrMode } from '../types'

/**
 * Art der Startnummern (klassenbasiert oder klassisch – nie beides) und die
 * automatische Vergabe. Von Hand ändern lassen sich die Nummern jederzeit im
 * Bearbeiten-Modus der Klassen.
 */
const { state, dispatch } = useStore()
const { parallel, regelwerk } = useEvent()
// Der Buchstabe der Nummern der Klasse E (E01 oder D01): seit 24.11.2026 unter jedem Regelwerk mit
// Klasse E („D Präfix kannst du einbauen und zur Auswahl stellen“), vorher nur unter UIM. Dort heißt
// die Klasse „Dolphin“, unter DM „E“ – danach richtet sich die Beschriftung.
const mitKlasseE = computed(() => regelwerk.value.klassen.includes('E'))
const dolphin = computed(() => regelwerk.value.klassenNamen.E !== undefined)
const PRAEFIXE = ['E', 'D'] as const
const emit = defineEmits<{ assigned: [] }>()
const MODES: StartNrMode[] = ['klasse', 'klassisch']
const SOURCES: RunningNumberSource[] = ['manoever', 'parallel']
const rn = computed(() => state.value.runningNumbers)

/**
 * Wer keine Nummer aus dem Bereich seiner Westengröße trägt (Startnummern-Bereiche, 19.11.2026):
 * ausgewichen, übergelaufen, ohne Größe oder mit der Nummer einer fehlenden Weste. Nur klassenbasiert.
 */
const abweichungen = computed(() =>
  state.value.startNrMode !== 'klasse' ? [] : regelwerk.value.klassen.flatMap((k) => startNrAbweichungen(state.value.starters, k, startNrRegeln(state.value, k))),
)

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
    <div v-if="abweichungen.length > 0" class="note" data-teil="startnr-abweichungen">
      {{ tn('numbers.abweichung', abweichungen.length) }}
      <ul>
        <li v-for="a in abweichungen" :key="a.starter.id" :data-starter="a.starter.id">
          <b>{{ a.starter.startNr || '–' }}</b> {{ a.starter.vorname }} {{ a.starter.nachname }}<template v-if="a.starter.groesse"> ({{ a.starter.groesse }})</template>: {{ t(`numbers.abweichung.${a.art}`) }}
        </li>
      </ul>
    </div>

    <div v-if="mitKlasseE && state.startNrMode === 'klasse'" class="field" style="width: auto" data-feld="dolphin-praefix">
      <label>{{ dolphin ? t('numbers.dolphinPrefix') : t('numbers.ePrefix') }}</label>
      <div class="segmented" role="group" :aria-label="dolphin ? t('numbers.dolphinPrefix') : t('numbers.ePrefix')">
        <button
          v-for="p in PRAEFIXE"
          :key="p"
          type="button"
          :data-praefix="p"
          :class="state.dolphinPraefix === p ? 'active' : ''"
          :aria-pressed="state.dolphinPraefix === p"
          @click="dispatch({ type: 'SET_DOLPHIN_PRAEFIX', praefix: p })"
        >
          {{ p }}01
        </button>
      </div>
      <p class="note">{{ t('numbers.dolphinPrefix.hint') }}</p>
    </div>

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
