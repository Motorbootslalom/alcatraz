<script setup lang="ts">
import { t } from '../i18n'
import type { PauseItem } from '../types'

/** Pausen-Block innerhalb einer Spur (Versatz um `length` Starts). */
defineProps<{ item: PauseItem }>()
const emit = defineEmits<{ length: [length: number]; remove: [] }>()
</script>

<template>
  <div class="pause-chip">
    <span class="handle drag-handle" :title="t('parcours.pauseMove')">{{ t('parcours.pause') }}</span>
    <button
      class="len"
      :disabled="item.length <= 1"
      :title="t('parcours.pauseShorter')"
      :aria-label="t('parcours.pauseShorter')"
      @click="emit('length', Math.max(1, item.length - 1))"
    >
      −
    </button>
    <span class="len-val" :title="t('parcours.pauseBeats')">{{ item.length }}</span>
    <button
      class="len"
      :title="t('parcours.pauseLonger')"
      :aria-label="t('parcours.pauseLonger')"
      @click="emit('length', Math.min(20, item.length + 1))"
    >
      +
    </button>
    <button class="rm" :title="t('parcours.pauseRemove')" :aria-label="t('parcours.pauseRemove')" @click="emit('remove')">
      ×
    </button>
  </div>
</template>
