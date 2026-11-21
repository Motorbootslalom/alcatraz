<script setup lang="ts">
import { t } from '../i18n'
import SlotCell from './SlotCell.vue'
import { startEntfaellt, type ParallelHeat } from '../planung/parallel'

defineProps<{
  heats: ParallelHeat[]
  /**
   * Je Start ein Vermerk in einer eigenen Spalte – in den Runden nach dem Vorlauf die Klasse (um
   * welche Plätze ein Finale geht, sagt seit 21.11.2026 die Runde selbst). Fehlt = keine Spalte (Vorlauf).
   */
  vermerke?: readonly string[]
  /** Die Überschrift über der Tabelle; fehlt = die des Vorlaufs (Blöcke zu vier Startern). */
  kopf?: string
}>()
</script>

<template>
  <!-- Auch ein fester Plan, dessen Starter es alle nicht mehr gibt, hat niemanden, der fährt. -->
  <div v-if="heats.every(startEntfaellt)" class="empty">
    {{ t('parallel.empty') }}
  </div>
  <template v-else>
    <div class="subhead">{{ kopf ?? t('parallel.head', { n: heats.length }) }}</div>
    <div class="sequence parallel-sequence">
      <table>
        <thead>
          <tr>
            <th class="pos">#</th>
            <th style="width: 70px">{{ t('parallel.boat') }}</th>
            <th style="width: 70px">{{ t('parallel.attempt') }}</th>
            <th v-if="vermerke" data-spalte="vermerk">{{ t('parallel.rounds.heat') }}</th>
            <th>{{ t('parallel.parcoursA') }}</th>
            <th>{{ t('parallel.parcoursB') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="h in heats" :key="h.pos" :class="{ 'block-start': h.blockStart && h.pos > 1, entfaellt: startEntfaellt(h) }">
            <td class="pos">{{ h.pos }}</td>
            <td>
              <span :class="['boat-tag', h.boat]">{{ t(`common.boat.${h.boat}`) }}</span>
            </td>
            <!-- Der frühere Start eines Paares ist der 1. Attempt; im 2. sind die Racecourses getauscht. -->
            <td class="num">
              {{ h.run }}
              <span v-if="h.run === 2" class="run-tag" :title="t('parallel.swapTitle')">⇄</span>
            </td>
            <td v-if="vermerke" data-spalte="vermerk">{{ vermerke[h.pos - 1] ?? '' }}</td>
            <!-- Fester Plan, beide Starter entfernt: Der Start entfällt, seine Position bleibt. -->
            <td v-if="startEntfaellt(h)" colspan="2" class="entfaellt-text" data-start="entfaellt">{{ t('parallel.cancelled') }}</td>
            <template v-else>
              <td><SlotCell :item="h.a" /></td>
              <td><SlotCell :item="h.b" /></td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>
