<script setup lang="ts">
import draggable from 'vuedraggable'
import { itemDragId } from '../planung/verzahnung'
import { t, tn } from '../i18n'
import ClassChip from './ClassChip.vue'
import PauseChip from './PauseChip.vue'
import type { ClassId, TrackItem } from '../types'

/**
 * Eine Spur der Verzahnung – Ablagefläche für Klassen- und Pausen-Blöcke.
 * `items` wird von vuedraggable an Ort und Stelle geändert; `change` meldet
 * danach, dass der Stand übernommen werden soll.
 */
defineProps<{
  index: number
  items: TrackItem[]
  counts: Map<ClassId, number>
  total: number
  group: string
  /** Festgeschriebene Verzahnung: Blöcke lassen sich nicht ziehen. */
  locked: boolean
}>()

const emit = defineEmits<{
  change: []
  addPause: []
  pauseLength: [pauseId: string, length: number]
  pauseRemove: [pauseId: string]
}>()
</script>

<template>
  <div class="track">
    <div class="track-label">
      <span>{{ t('parcours.track', { letter: String.fromCharCode(65 + index) }) }}</span>
      <span>
        {{ tn('app.starters', total) }}
        <button class="add-pause" :title="t('parcours.addPauseTitle')" @click="emit('addPause')">
          {{ t('parcours.addPause') }}
        </button>
      </span>
    </div>
    <draggable
      class="track-blocks"
      :list="items"
      :group="group"
      :item-key="itemDragId"
      handle=".drag-handle"
      ghost-class="dragging"
      :animation="150"
      :disabled="locked"
      @change="emit('change')"
    >
      <template #item="{ element }">
        <ClassChip
          v-if="element.kind === 'class'"
          :class-id="element.klasse"
          :count="counts.get(element.klasse) ?? 0"
        />
        <PauseChip
          v-else
          :item="element"
          @length="(len: number) => emit('pauseLength', element.id, len)"
          @remove="emit('pauseRemove', element.id)"
        />
      </template>
      <template #footer>
        <span v-if="items.length === 0" class="drop-hint">{{ t('parcours.dropHere') }}</span>
      </template>
    </draggable>
  </div>
</template>
