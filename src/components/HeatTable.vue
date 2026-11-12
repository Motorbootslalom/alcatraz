<script setup lang="ts">
import { t } from '../i18n'
import SlotCell from './SlotCell.vue'
import type { ParallelHeat } from '../planung/parallel'

defineProps<{ heats: ParallelHeat[]; international: boolean }>()
</script>

<template>
  <div v-if="heats.length === 0" class="empty">
    {{ t('parallel.empty') }}
  </div>
  <template v-else>
    <div class="subhead">{{ t('parallel.head', { n: heats.length }) }}</div>
    <div class="sequence parallel-sequence">
      <table>
        <thead>
          <tr>
            <th class="pos">#</th>
            <th style="width: 70px">{{ t('parallel.boat') }}</th>
            <th>{{ t('parallel.parcoursA') }}</th>
            <th>{{ t('parallel.parcoursB') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="h in heats" :key="h.pos" :class="h.blockStart && h.pos > 1 ? 'block-start' : ''">
            <td class="pos">{{ h.pos }}</td>
            <td>
              <span :class="['boat-tag', h.boat]">{{ t(`common.boat.${h.boat}`) }}</span>
              <span v-if="h.run === 2" class="run-tag" :title="t('parallel.swapTitle')">⇄</span>
            </td>
            <td><SlotCell :item="h.a" :international="international" /></td>
            <td><SlotCell :item="h.b" :international="international" /></td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>
