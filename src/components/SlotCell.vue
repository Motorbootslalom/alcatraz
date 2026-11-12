<script setup lang="ts">
import { classColor, parallelClassBadge, parallelClassLabel } from '../domain/classes'
import { t } from '../i18n'
import type { ParallelSlot } from '../planung/parallel'

/** Ein Startplatz (Starter oder Dummy): farbiges Kürzel, Startnummer, Name. */
defineProps<{ item: ParallelSlot; international: boolean }>()
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
      :title="parallelClassLabel(item.p.klasse, international)"
    >
      {{ parallelClassBadge(item.p.klasse, international) }}
    </span>
    <span class="slot-main">
      <span class="slot-nr num">{{ item.p.startNr || '–' }}</span>
      <span class="slot-name">{{ item.p.nachname }}, {{ item.p.vorname }}</span>
    </span>
  </div>
</template>
