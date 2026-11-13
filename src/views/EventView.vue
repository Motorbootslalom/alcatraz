<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../state/store'
import { manoeverAufbauten, REGELWERKE } from '../config/catalog'
import { useEvent } from '../lib/event'
import { t } from '../i18n'
import type { EventKind, OriginMode } from '../types'

/**
 * Die Veranstaltung selbst: Name, Jahr, Regelwerk, Aufbau. Alles Übrige –
 * Listen, Kürzel, WKR-Einteilung, Dateien – steht unter „Einstellungen“.
 */
const { state, dispatch } = useStore()
const { regelwerk, classLabel, foreignClasses, parallel } = useEvent()

// Mitgelieferte Aufbauten und dahinter die eigenen aus den Einstellungen.
const aufbauten = computed(() => manoeverAufbauten(state.value.eigeneAufbauten))

/** Hier werden die Listen für den Parallel-Slalom zuerst gebaut und getestet. */
const PROTOTYP_URL = 'https://motorbootslalom.github.io/fehlerpunkte-prototyp-vue/'

const KINDS: EventKind[] = ['meisterschaft', 'club']
const ORIGINS: OriginMode[] = ['verein', 'bundesland', 'none']

function onNumber(field: 'eventJahr' | 'laufCount', e: Event) {
  const value = parseInt((e.target as HTMLInputElement).value, 10)
  if (!Number.isNaN(value)) dispatch({ type: 'SET_EVENT', patch: { [field]: value } })
}
</script>

<template>
  <div class="panel">
    <h2>{{ t('event.title') }}</h2>
    <p class="hint">{{ t('event.intro') }}</p>
    <div class="row">
      <div class="field" style="flex: 2; min-width: 220px">
        <label for="ev-name">{{ t('event.name') }}</label>
        <input
          id="ev-name"
          class="input"
          :value="state.eventName"
          :placeholder="t('event.namePlaceholder')"
          @input="dispatch({ type: 'SET_EVENT', patch: { eventName: ($event.target as HTMLInputElement).value } })"
        />
      </div>
      <div class="field" style="width: 110px">
        <label for="ev-year">{{ t('event.year') }}</label>
        <input id="ev-year" class="input" type="number" :value="state.eventJahr" @change="onNumber('eventJahr', $event)" />
      </div>
      <div class="field" style="width: 90px">
        <label for="ev-runs">{{ t('event.runs') }}</label>
        <input
          id="ev-runs"
          class="input"
          type="number"
          min="1"
          max="9"
          :value="state.laufCount"
          @change="onNumber('laufCount', $event)"
        />
      </div>
      <div class="field">
        <label>{{ t('event.kind') }}</label>
        <div class="segmented">
          <button
            v-for="k in KINDS"
            :key="k"
            type="button"
            :class="state.eventKind === k ? 'active' : ''"
            @click="dispatch({ type: 'SET_EVENT_KIND', eventKind: k })"
          >
            {{ t(`event.kind.${k}`) }}
          </button>
        </div>
      </div>
      <div class="field">
        <label>{{ t('event.origin') }}</label>
        <div class="segmented">
          <button
            v-for="o in ORIGINS"
            :key="o"
            type="button"
            :class="state.originMode === o ? 'active' : ''"
            @click="dispatch({ type: 'SET_ORIGIN_MODE', originMode: o })"
          >
            {{ t(`event.origin.${o}`) }}
          </button>
        </div>
      </div>
    </div>
    <div class="row" style="margin-top: 14px">
      <div class="field">
        <label>{{ t('event.rulebook') }}</label>
        <div class="segmented">
          <button
            v-for="r in REGELWERKE"
            :key="r.id"
            type="button"
            :class="state.regelwerk === r.id ? 'active' : ''"
            :aria-pressed="state.regelwerk === r.id"
            @click="dispatch({ type: 'SET_REGELWERK', regelwerk: r.id })"
          >
            {{ r.label }}
          </button>
        </div>
      </div>
      <div class="field" style="min-width: 220px">
        <label for="ev-aufbau">{{ parallel ? t('event.setupManoever') : t('event.setup') }}</label>
        <select
          id="ev-aufbau"
          class="input"
          :value="state.aufbau"
          @change="dispatch({ type: 'SET_AUFBAU', aufbau: ($event.target as HTMLSelectElement).value })"
        >
          <option v-for="a in aufbauten" :key="a.id" :value="a.id">
            {{ a.eigen ? t('event.setupOwn', { name: a.name }) : a.name }}
          </option>
        </select>
      </div>
    </div>
    <p class="note">
      {{ parallel ? t('event.rulebookNote.parallel') : t('event.rulebookNote.manoever') }}
      {{ t('event.setupNote') }}
    </p>
    <!-- Der Parallel-Slalom ist ein eigener Wettkampf auf einem anderen Parcours und braucht
         einen eigenen Aufbau. Der entsteht zuerst im Fehlerpunkte-Prototyp und wird dort erprobt. -->
    <p v-if="parallel" class="boat-banner ok">
      {{ t('event.parallelSetup') }}
      <a :href="PROTOTYP_URL" target="_blank" rel="noopener">{{ t('event.parallelSetupLink') }}</a>
    </p>
    <p v-if="foreignClasses.length > 0" class="boat-banner warn" role="status">
      {{ t('event.foreignClasses', { rulebook: regelwerk.label, classes: foreignClasses.map((c) => classLabel(c.id)).join(', ') }) }}
    </p>
    <!-- Die WKR-Einteilung steht unter „Einstellungen“; hier beim Aufbau nur der Weg dorthin. -->
    <p class="note" data-hinweis="wkr">
      {{ t('event.wkrNote') }} <a href="#/einstellungen?wkr">{{ t('nav.einstellungen') }} → {{ t('wkr.title') }}</a>
    </p>
    <p class="note">{{ t('event.note') }}</p>
  </div>
</template>
