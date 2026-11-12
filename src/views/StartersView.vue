<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../state/store'
import { CLASSES } from '../domain/classes'
import { duplicateStartNrIds, sortedByStartNr } from '../domain/startnumbers'
import { useEvent } from '../lib/event'
import { t } from '../i18n'
import StartNumberPanel from '../components/StartNumberPanel.vue'
import ExcelPanel from '../components/ExcelPanel.vue'
import ClassSection from '../components/ClassSection.vue'
import type { ClassId, Starter } from '../types'

const { state } = useStore()
const { classes } = useEvent()

const byClass = computed(() => {
  const m = new Map<ClassId, Starter[]>()
  for (const c of CLASSES) m.set(c.id, [])
  for (const p of state.value.starters) m.get(p.klasse)?.push(p)
  for (const [k, list] of m) m.set(k, sortedByStartNr(list))
  return m
})

// Klassen mit Startern sind zu Beginn aufgeklappt.
const expanded = ref<Set<ClassId>>(new Set(CLASSES.map((c) => c.id).filter((id) => byClass.value.get(id)!.length > 0)))

function toggle(id: ClassId) {
  const next = new Set(expanded.value)
  if (!next.delete(id)) next.add(id)
  expanded.value = next
}

// Nach der automatischen Vergabe ordnen sich alle Klassen neu.
const sortTick = ref(0)

const duplicates = computed(() => duplicateStartNrIds(state.value.starters, state.value.startNrMode))
</script>

<template>
  <ExcelPanel />
  <StartNumberPanel @assigned="sortTick++" />
  <div class="panel">
    <h2>{{ t('starters.title') }}</h2>
    <p class="hint">{{ t('starters.hint') }}</p>
    <ClassSection
      v-for="c in classes"
      :key="c.id"
      :class-id="c.id"
      :starters="byClass.get(c.id)!"
      :duplicates="duplicates"
      :sort-tick="sortTick"
      :open="expanded.has(c.id)"
      @toggle="toggle(c.id)"
    />
  </div>
</template>
