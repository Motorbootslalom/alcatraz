<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../state/store'
import { t, tn } from '../i18n'
import type { EventPlan } from '../planung/plan'
import type { BoatConfig } from '../types'

/**
 * Bootbestand und Bootbedarf: einstellbare Bootzahlen, der Klasse-4-Schalter
 * und der Hinweis, ob die Verzahnung fahrbar ist oder Boote fehlen.
 */
const props = defineProps<{ plan: EventPlan }>()
const { state, dispatch } = useStore()

function clampBoats(e: Event): number {
  return Math.max(0, Math.min(99, parseInt((e.target as HTMLInputElement).value, 10) || 0))
}

const setBoats = (patch: Partial<BoatConfig>) =>
  dispatch({ type: 'SET_BOATS', boats: { ...state.value.boats, ...patch } })

const short = computed(() => props.plan.extra.klein > 0 || props.plan.extra.gross > 0)

const banner = computed(() => {
  const demand = t('boats.demand', props.plan.demand)
  const available = t('boats.available', state.value.boats)
  if (!short.value) return t('boats.ok', { demand, available })
  const missing: string[] = []
  if (props.plan.extra.klein > 0) missing.push(tn('boats.extra.klein', props.plan.extra.klein))
  if (props.plan.extra.gross > 0) missing.push(tn('boats.extra.gross', props.plan.extra.gross))
  return t('boats.short', {
    demand,
    available,
    missing: missing.join(` ${t('common.and')} `),
    optimal: t('boats.demand', props.plan.optimalDemand),
  })
})
</script>

<template>
  <div class="panel">
    <h2>{{ t('boats.title') }}</h2>
    <div class="boat-controls">
      <div class="field" style="width: 150px">
        <label for="boats-klein">{{ t('boats.small') }}</label>
        <input
          id="boats-klein"
          class="input"
          type="number"
          min="0"
          max="99"
          :value="state.boats.klein"
          @input="setBoats({ klein: clampBoats($event) })"
        />
      </div>
      <div class="field" style="width: 150px">
        <label for="boats-gross">{{ t('boats.large') }}</label>
        <input
          id="boats-gross"
          class="input"
          type="number"
          min="0"
          max="99"
          :value="state.boats.gross"
          @input="setBoats({ gross: clampBoats($event) })"
        />
      </div>
      <label class="boat-check">
        <input
          type="checkbox"
          :checked="state.class4Small"
          @change="dispatch({ type: 'SET_CLASS4_SMALL', class4Small: ($event.target as HTMLInputElement).checked })"
        />
        {{ t('boats.class4Small') }}
      </label>
    </div>
    <div :class="['boat-banner', short ? 'warn' : 'ok']" role="status">{{ banner }}</div>
  </div>
</template>
