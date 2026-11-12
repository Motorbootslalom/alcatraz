<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useStore } from '../state/store'
import { uid } from '../domain/ids'
import { classCounts } from '../planung/verzahnung'
import { useEvent } from '../lib/event'
import { t, tn } from '../i18n'
import TrackContainer from './TrackContainer.vue'
import FlowPreview from './FlowPreview.vue'
import SequenceTable from './SequenceTable.vue'
import type { ParcoursPlan } from '../planung/plan'
import type { ClassId, Parcours, TrackItem, WechselFaktor } from '../types'

const FACTORS: WechselFaktor[] = [1, 2, 3, 4]

const props = defineProps<{ parcours: Parcours; plan: ParcoursPlan; locked: boolean }>()

const { state, dispatch } = useStore()
const { classes, classLabel } = useEvent()

const filtered = computed(() => state.value.starters.filter((p) => props.parcours.classIds.includes(p.klasse)))
const counts = computed(() => classCounts(filtered.value))

// Die (auf den Bootbestand begrenzte) Anordnung kommt aus dem Plan.
const signature = computed(() => JSON.stringify(props.plan.tracks))

// Lokale Arbeitskopie der Spuren – vuedraggable ändert sie an Ort und Stelle.
const containers = ref<TrackItem[][]>(props.plan.tracks.map((track) => [...track]))

watch(signature, () => {
  containers.value = props.plan.tracks.map((track) => [...track])
})

function persist() {
  dispatch({
    type: 'SET_PARCOURS_TRACKS',
    id: props.parcours.id,
    tracks: containers.value.map((track) => [...track]),
  })
}

function addPause(trackIndex: number) {
  containers.value[trackIndex].push({ kind: 'pause', id: uid('pause'), length: 1 })
  persist()
}

function setPauseLength(pauseId: string, length: number) {
  containers.value = containers.value.map((track) =>
    track.map((it) => (it.kind === 'pause' && it.id === pauseId ? { ...it, length } : it)),
  )
  persist()
}

function removePause(pauseId: string) {
  containers.value = containers.value.map((track) =>
    track.filter((it) => !(it.kind === 'pause' && it.id === pauseId)),
  )
  persist()
}

function toggleClass(id: ClassId) {
  const has = props.parcours.classIds.includes(id)
  const next = has ? props.parcours.classIds.filter((c) => c !== id) : [...props.parcours.classIds, id]
  dispatch({ type: 'SET_PARCOURS_CLASSES', id: props.parcours.id, classIds: next })
}

const trackTotal = (track: TrackItem[]) =>
  track.reduce((sum, it) => sum + (it.kind === 'class' ? (counts.value.get(it.klasse) ?? 0) : 0), 0)

const hasPauses = computed(() => containers.value.some((track) => track.some((it) => it.kind === 'pause')))

function starterCount(id: ClassId): number {
  return state.value.starters.filter((p) => p.klasse === id).length
}

function removeParcours() {
  if (confirm(t('parcours.removeConfirm', { name: props.parcours.name }))) {
    dispatch({ type: 'REMOVE_PARCOURS', id: props.parcours.id })
  }
}
</script>

<template>
  <section class="parcours">
    <div class="parcours-head">
      <input
        class="pname"
        :value="parcours.name"
        :aria-label="t('event.name')"
        @input="dispatch({ type: 'RENAME_PARCOURS', id: parcours.id, name: ($event.target as HTMLInputElement).value })"
      />
      <div class="segmented">
        <button
          v-for="f in FACTORS"
          :key="f"
          :class="parcours.wechselFaktor === f ? 'active' : ''"
          :title="t(`parcours.factorHint.${f}`)"
          @click="dispatch({ type: 'SET_PARCOURS_FACTOR', id: parcours.id, wechselFaktor: f })"
        >
          {{ t('parcours.factor', { n: f }) }}
        </button>
      </div>
      <span style="flex: 1" />
      <button
        v-if="plan.manual || hasPauses"
        class="btn sm ghost"
        :title="t('parcours.autoTitle')"
        @click="dispatch({ type: 'RESET_TRACKS', id: parcours.id })"
      >
        {{ t('parcours.auto') }}
      </button>
      <button class="btn sm danger" @click="removeParcours">{{ t('common.remove') }}</button>
    </div>

    <div style="padding: 12px 16px 0">
      <div class="subhead">{{ t('parcours.classesHead', { n: parcours.wechselFaktor }) }}</div>
      <div class="classes-picker">
        <button
          v-for="c in classes"
          :key="c.id"
          :class="['class-toggle', parcours.classIds.includes(c.id) ? 'on' : '']"
          :style="parcours.classIds.includes(c.id) ? { background: c.color, borderColor: c.color } : undefined"
          :title="`${classLabel(c.id)} · ${tn('app.starters', starterCount(c.id))}`"
          :aria-pressed="parcours.classIds.includes(c.id)"
          @click="toggleClass(c.id)"
        >
          {{ c.id }} <span style="opacity: 0.8; font-weight: 600">· {{ starterCount(c.id) }}</span>
        </button>
      </div>
      <p class="note">
        {{ t(`parcours.factorHint.${parcours.wechselFaktor}`) }} ·
        {{ t('parcours.demand', { demand: t('boats.demand', plan.demand) }) }}
        <span
          v-if="!plan.manual && plan.constrained && plan.effectiveTracks < parcours.wechselFaktor"
          style="color: var(--danger)"
        >
          · ⚠ {{ tn('parcours.reduced', plan.effectiveTracks) }}
        </span>
      </p>
    </div>

    <div class="parcours-body">
      <div class="tracks-area">
        <div class="subhead">{{ t('parcours.tracksHead') }}</div>
        <div v-if="filtered.length === 0" class="empty">{{ t('parcours.noStarters') }}</div>
        <template v-else>
          <TrackContainer
            v-for="(track, i) in containers"
            :key="`${parcours.id}::track::${i}`"
            :index="i"
            :items="track"
            :counts="counts"
            :total="trackTotal(track)"
            :group="parcours.id"
            :locked="locked"
            @change="persist"
            @add-pause="addPause(i)"
            @pause-length="setPauseLength"
            @pause-remove="removePause"
          />
        </template>
        <FlowPreview :sequence="plan.sequence" />
      </div>

      <div class="sequence-area">
        <div class="subhead">
          {{ t('parcours.seqHead', { count: tn('app.starters', plan.sequence.length) }) }}
        </div>
        <SequenceTable :sequence="plan.sequence" :origin-mode="state.originMode" />
      </div>
    </div>
  </section>
</template>
