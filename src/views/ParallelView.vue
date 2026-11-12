<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../state/store'
import { buildParallelPlan, type ParallelOptions } from '../planung/parallel'
import { t, tn } from '../i18n'
import HeatTable from '../components/HeatTable.vue'

const { state, dispatch } = useStore()

const opts = computed<ParallelOptions>(() => ({
  // Parallelslalom gibt es nur nach den Regeln der UIM: bis Klasse 5, E heißt Dolphin.
  international: true,
  class4Small: state.value.class4Small,
  orderByStartNr: state.value.parallelOrderByStartNr,
}))

// Klassische Startnummern sind Zahlen und dienen als Sortierschlüssel „nach
// Startnummer“; klassenbasierte vergleicht der Plan selbst.
const numberOrder = computed(() => {
  if (state.value.startNrMode !== 'klassisch') return undefined
  const map = new Map<string, number>()
  for (const p of state.value.starters) {
    const n = parseInt(p.startNr, 10)
    if (Number.isFinite(n)) map.set(p.id, n)
  }
  return map
})
const plan = computed(() => buildParallelPlan(state.value.starters, opts.value, numberOrder.value))

function line(starters: number, dummy: boolean): string {
  const text = tn('app.starters', starters)
  return dummy ? t('parallel.plusDummy', { starters: text }) : text
}

const checked = (e: Event) => (e.target as HTMLInputElement).checked
</script>

<template>
  <div class="panel">
    <h2>{{ t('parallel.title') }}</h2>
    <p class="hint">{{ t('parallel.hint') }}</p>

    <div class="parallel-controls">
      <label class="boat-check">
        <input
          type="checkbox"
          :checked="state.class4Small"
          @change="dispatch({ type: 'SET_CLASS4_SMALL', class4Small: checked($event) })"
        />
        {{ t('boats.class4Small') }}
      </label>
      <label class="boat-check" :title="t('parallel.orderByStartNrTitle')">
        <input
          type="checkbox"
          :checked="state.parallelOrderByStartNr"
          @change="dispatch({ type: 'SET_PARALLEL_ORDER_BY_STARTNR', value: checked($event) })"
        />
        {{ t('parallel.orderByStartNr') }}
      </label>
    </div>

    <div class="parallel-stats">
      <span class="pstat">
        <span class="dot boat-dot klein" /> {{ t('parallel.smallBoats') }}
        <b>{{ line(plan.kleinStarter, plan.kleinDummy) }}</b>
      </span>
      <span class="pstat">
        <span class="dot boat-dot gross" /> {{ t('parallel.largeBoats') }}
        <b>{{ line(plan.grossStarter, plan.grossDummy) }}</b>
      </span>
      <span class="pstat">
        {{ t('parallel.stats', { heats: plan.heats.length, pairs: plan.pairs, blocks: plan.blocks }) }}
      </span>
    </div>
  </div>

  <div class="panel">
    <HeatTable :heats="plan.heats" :international="opts.international" />
  </div>
</template>
