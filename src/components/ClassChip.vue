<script setup lang="ts">
import { classColor } from '../domain/classes'
import { useEvent } from '../lib/event'
import type { ClassId } from '../types'

/** Klassen-Block innerhalb einer Spur (verschiebbar). */
defineProps<{ classId: ClassId; count: number }>()
const { classLabel } = useEvent()
</script>

<template>
  <div class="class-chip drag-handle" :style="{ background: classColor(classId) }">
    <span>{{ classLabel(classId) }}</span>
    <span class="cnt">{{ count }}</span>
  </div>
</template>
