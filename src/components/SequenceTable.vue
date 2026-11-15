<script setup lang="ts">
import { getClass } from '../domain/classes'
import { originLabelKey, originOf } from '../lib/origin'
import { t } from '../i18n'
import { useEvent } from '../lib/event'
import type { OriginMode, Starter } from '../types'

defineProps<{ sequence: Starter[]; originMode: OriginMode }>()
const { classLabel, classBadge } = useEvent()
</script>

<template>
  <div v-if="sequence.length === 0" class="empty">{{ t('parcours.seqEmpty') }}</div>
  <div v-else class="sequence">
    <table>
      <thead>
        <tr>
          <th class="pos">#</th>
          <th style="width: 44px">{{ t('common.classShort') }}</th>
          <th style="width: 64px">{{ t('common.startNr') }}</th>
          <th>{{ t('common.nameBoth') }}</th>
          <th v-if="originMode !== 'none'">{{ t(originLabelKey(originMode)) }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(p, i) in sequence" :key="p.id">
          <td class="pos">{{ i + 1 }}</td>
          <td>
            <span class="class-badge sm" :style="{ background: getClass(p.klasse).color }" :title="classLabel(p.klasse)">{{ classBadge(p.klasse) }}</span>
          </td>
          <td class="num">{{ p.startNr || '–' }}</td>
          <td>{{ p.nachname }}, {{ p.vorname }}</td>
          <td v-if="originMode !== 'none'">{{ originOf(p, originMode) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
