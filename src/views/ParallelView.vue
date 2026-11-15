<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../state/store'
import { rundenName, vorlaufGebunden, vorlaufPlan, VORLAUF } from '../planung/parallelRunden'
import { t, tn } from '../i18n'
import HeatTable from '../components/HeatTable.vue'
import type { Starter } from '../types'

const { state, dispatch } = useStore()

// Der gültige Plan des Vorlaufs: der festgeschriebene, sonst der aus dem Starterfeld gerechnete –
// derselbe, nach dem die klassischen Startnummern vergeben werden (planung/running.ts).
const vorlauf = computed(() => vorlaufPlan(state.value))
const plan = computed(() => vorlauf.value.plan)
// Zum Vorlauf sind Werte erfasst: Der Plan bleibt fest, auch bei freigegebener Verzahnung, und die Schalter sind gesperrt.
const gebunden = computed(() => vorlaufGebunden(state.value))

function line(starters: number, dummy: number): string {
  const text = tn('app.starters', starters)
  return dummy > 0 ? tn('parallel.plusDummy', dummy, { starters: text }) : text
}

const namen = (liste: Starter[]) => liste.map((p) => `${p.startNr || '–'} ${p.nachname}`.trim()).join(', ')

const checked = (e: Event) => (e.target as HTMLInputElement).checked
</script>

<template>
  <div class="panel">
    <h2>{{ t('parallel.title') }}</h2>
    <p class="hint">{{ t('parallel.hint') }}</p>

    <div class="parallel-controls">
      <label class="boat-check" :title="t('parallel.strictTitle')">
        <input
          type="checkbox"
          data-option="parallel-streng"
          :disabled="gebunden"
          :checked="state.parallelStreng"
          @change="dispatch({ type: 'SET_PARALLEL_STRENG', value: checked($event) })"
        />
        {{ t('parallel.strict') }}
      </label>
      <label class="boat-check">
        <input
          type="checkbox"
          :disabled="gebunden"
          :checked="state.class4Small"
          @change="dispatch({ type: 'SET_CLASS4_SMALL', class4Small: checked($event) })"
        />
        {{ t('boats.class4Small') }}
      </label>
      <label class="boat-check" :title="t('parallel.orderByStartNrTitle')">
        <input
          type="checkbox"
          :disabled="gebunden"
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
        {{ t('parallel.stats', { starts: plan.heats.length, pairs: plan.pairs, blocks: plan.blocks }) }}
      </span>
    </div>
  </div>

  <div class="panel" data-runde="pre" :data-fest="vorlauf.fest">
    <h2>{{ rundenName(VORLAUF, t) }}</h2>
    <p class="hint" data-hinweis="plan-stand">{{ vorlauf.fest ? t('parallel.fixed') : t('parallel.live') }}</p>
    <p v-if="gebunden" class="boat-banner warn" role="status" data-hinweis="plan-gebunden">{{ t('parallel.plan.kept') }}</p>
    <!-- Ein fester Plan folgt dem Starterfeld nicht mehr: Was seither nicht mehr passt, steht hier. -->
    <p v-if="vorlauf.ohnePlatz.length > 0" class="note" style="color: var(--danger)" role="status" data-warnung="ohne-platz">
      {{ t('parallel.warn.unplaced', { names: namen(vorlauf.ohnePlatz) }) }}
    </p>
    <p v-if="vorlauf.fehlend.length > 0" class="note" style="color: var(--danger)" role="status" data-warnung="fehlend">
      {{ t('parallel.warn.missing', { n: vorlauf.fehlend.length }) }}
    </p>
    <p v-if="vorlauf.falschesBoot.length > 0" class="note" style="color: var(--danger)" role="status" data-warnung="boot">
      {{ t('parallel.warn.boat', { names: namen(vorlauf.falschesBoot) }) }}
    </p>
    <HeatTable :heats="plan.heats" />
  </div>
</template>
