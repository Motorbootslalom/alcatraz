<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../state/store'
import { useEvent } from '../lib/event'
import { DISZIPLIN_TEXT, disziplinGefahren, nichtGewertet, WERTUNGS_DISZIPLINEN } from '../lib/disziplinen'
import { t } from '../i18n'
import type { ClassId, WertungsDisziplin } from '../types'

/**
 * Der Schalter „Disziplin nicht werten“ je Disziplin und Klasse (lib/disziplinen.ts), mit der
 * Abkürzung „Alle Klassen“. Entscheidung des O.O.D. vor Ort: Regel 960 regelt den Abbruch einer
 * Disziplin nicht (nur Pkt. 5.1: „Drivers must complete the relevant stage and cross the
 * finishing line in order to be classified for the stage.“). Wird eine Disziplin in einer Klasse
 * abgebrochen, zählt sie für diese Klasse nicht – ob dann auch für fertige Klassen, wird hier
 * gewählt. Einzel- und Mannschaftswertung folgen dem, die Listen nennen es.
 *
 * Wählbar ist nur eine Disziplin, zu der schon etwas erfasst ist: Ohne Werte zählt sie ohnehin nicht.
 */
const { state, dispatch } = useStore()
const { classes, classLabel } = useEvent()

const klassen = computed(() => classes.value.map((c) => c.id))
const zeilen = computed(() =>
  WERTUNGS_DISZIPLINEN.map((disziplin) => ({
    disziplin,
    gefahren: disziplinGefahren(state.value, disziplin),
    alle: klassen.value.length > 0 && klassen.value.every((k) => nichtGewertet(state.value.nichtWerten, disziplin, k)),
    keine: !klassen.value.some((k) => nichtGewertet(state.value.nichtWerten, disziplin, k)),
  })),
)
const setze = (disziplin: WertungsDisziplin, betroffen: readonly ClassId[], an: boolean) => dispatch({ type: 'SET_NICHT_WERTEN', disziplin, klassen: betroffen, an })
</script>

<template>
  <fieldset class="nicht-werten" data-feld="nicht-werten">
    <legend class="subhead">{{ t('notScored.title') }}</legend>
    <p class="note">{{ t('notScored.hint') }}</p>
    <div v-for="z in zeilen" :key="z.disziplin" class="row nicht-werten-zeile" :data-disziplin="z.disziplin">
      <strong class="nicht-werten-name">{{ t(DISZIPLIN_TEXT[z.disziplin]) }}</strong>
      <span v-if="!z.gefahren" class="note" data-hinweis="nicht-gefahren">{{ t('notScored.notDriven') }}</span>
      <template v-else>
        <label v-for="k in klassen" :key="k" class="check">
          <input type="checkbox" :data-klasse="k" :checked="nichtGewertet(state.nichtWerten, z.disziplin, k)" @change="setze(z.disziplin, [k], ($event.target as HTMLInputElement).checked)" />
          {{ classLabel(k) }}
        </label>
        <button type="button" class="btn sm" data-action="nicht-werten-alle" :disabled="z.alle" @click="setze(z.disziplin, klassen, true)">{{ t('notScored.all') }}</button>
        <button type="button" class="btn sm" data-action="nicht-werten-keine" :disabled="z.keine" @click="setze(z.disziplin, klassen, false)">{{ t('notScored.none') }}</button>
      </template>
    </div>
  </fieldset>
</template>

<style scoped>
.nicht-werten {
  border: 1px solid var(--line, #ccc);
  border-radius: 6px;
  padding: 8px 12px;
  margin: 10px 0;
}
.nicht-werten-zeile {
  align-items: center;
  gap: 10px 14px;
  margin-top: 6px;
}
.nicht-werten-name {
  min-width: 9em;
}
</style>
