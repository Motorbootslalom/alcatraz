<script setup lang="ts">
import { classColor } from '../domain/classes'
import { useEvent } from '../lib/event'
import { t } from '../i18n'
import type { ParallelSlot } from '../planung/parallel'

/** Ein Startplatz (Starter oder Dummy): farbiges Kürzel, Startnummer, Name. */
defineProps<{ item: ParallelSlot }>()
// Name und Kurzzeichen der Klasse kommen aus dem Regelwerk (UIM: „Dolphin“, „D“).
const { classLabel, classBadge } = useEvent()
</script>

<template>
  <div v-if="item.kind === 'dummy'" class="slot dummy-slot">
    <span class="class-badge dummy-badge">DU</span>
    <span class="slot-main">
      <span class="slot-nr">{{ t('parallel.dummy') }}</span>
      <span class="slot-name">{{ t('parallel.dummyNote', { boat: t(`common.boat.${item.boat}`) }) }}</span>
    </span>
  </div>
  <div v-else class="slot">
    <span
      class="class-badge"
      :style="{ background: classColor(item.p.klasse) }"
      :title="classLabel(item.p.klasse)"
    >
      {{ classBadge(item.p.klasse) }}
    </span>
    <span class="slot-main">
      <span class="slot-nr num">{{ item.p.startNr || '–' }}</span>
      <span class="slot-name">{{ item.p.nachname }}, {{ item.p.vorname }}</span>
    </span>
  </div>
</template>
