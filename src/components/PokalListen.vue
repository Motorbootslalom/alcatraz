<script setup lang="ts">
import { computed, useId, watchEffect } from 'vue'
import { useStore } from '../state/store'
import { useEvent } from '../lib/event'
import { POKAL_VARIANTEN } from '../config/pokal'
import { pokalWahl, usePokalWertung } from '../lib/pokalBlaetter'
import { istOriginStyle, originLabelKey } from '../lib/origin'
import { t, tn } from '../i18n'
import { adresse } from '../lib/router'
import type { ErgebnisFassung, OriginStyle } from '../types'
import PokalStapel from './PokalStapel.vue'
import EingabenHinweis from './EingabenHinweis.vue'
import HerkunftWahl from './HerkunftWahl.vue'

/**
 * Die Pokalauswertungen unter „Listen“: Mannschaftswertung je Herkunft, gerechnet aus den
 * Gesamtlisten der Klassen (lib/pokal.ts). Je eingeschalteter Variante ein eigenes Dokument
 * mit eigener Seitenteilung und Seitenzahl; gedruckt wird, was die Auswahl zeigt.
 *
 * Die Auswertung steht da, sobald es das erste Ergebnis gibt – als Zwischenstand, deutlich
 * gekennzeichnet (im Kopf des Blatts, im Fuß mit den fehlenden Klassen und hier über der
 * Liste): Der Stand während des Wettkampfs ist das, wonach am Steg gefragt wird, und ein
 * versehentlich ausgehängter Zwischenstand soll als solcher zu erkennen sein.
 */
const emit = defineEmits<{
  /** Wie viele Listen die Auswahl zeigt und wie sie heißt (für Fenstertitel und Dateiname). */
  stand: [stand: { anzahl: number; auswahl: string }]
}>()

const { state } = useStore()
const { classLabel } = useEvent()
const id = useId()

const FASSUNGEN: ErgebnisFassung[] = ['aushang', 'intern']
// Die Wahl gehört zur Ansicht (lib/pokalBlaetter.ts `pokalWahl`); die Druckdatei liest die Herkunft daraus.
const wahl = pokalWahl()
// Eine gemerkte Wahl, die es nicht gibt, gilt als die Vorgabe.
const herkunftStil = computed<OriginStyle>(() => (istOriginStyle(wahl.value.herkunft) ? wahl.value.herkunft : 'lang'))

// Gerechnet wird in lib/pokalBlaetter.ts – dieselbe Wertung zeigt die Druckdatei.
const pokal = usePokalWertung(() => wahl.value.variante)
const regeln = computed(() => pokal.regeln)
const ohneHerkunft = computed(() => pokal.ohneHerkunft)
const variante = computed(() => pokal.variante)
const gezeigt = computed(() => pokal.gezeigt)
const hatErgebnis = computed(() => pokal.hatErgebnis)
const blaetter = computed(() => pokal.blaetter)
const offen = computed(() => pokal.offen)
const ohneHerkunftZahl = computed(() => pokal.ohneHerkunftZahl)
const abgewaehlt = computed(() => pokal.abgewaehlt)
const nichtGewertet = computed(() => pokal.nichtGewertet)

/** Die Auswahl in Worten, für Fenstertitel und Dateiname – in der Sprache der Oberfläche. */
const auswahlText = computed(() => blaetter.value.map((v) => t(`cup.variant.${v}`)).join(', '))
watchEffect(() => emit('stand', { anzahl: blaetter.value.length, auswahl: auswahlText.value }))
</script>

<template>
  <!-- Ohne Herkunft gibt es keine Mannschaften. -->
  <div v-if="ohneHerkunft" class="panel empty no-print" data-hinweis="pokal-ohne-herkunft">
    {{ t('cup.noOrigin') }} <a :href="adresse('veranstaltung')">{{ t('nav.veranstaltung') }}</a
    >.
  </div>
  <div v-else-if="regeln.an.length === 0" class="panel empty no-print" data-hinweis="pokal-aus">
    {{ t('cup.off') }} <a :href="adresse('einstellungen', { ziel: 'pokal' })">{{ t('nav.einstellungen') }}</a
    >.
  </div>
  <template v-else>
    <div class="panel no-print cup-wahl">
      <p class="hint">{{ t('cup.hint') }}</p>
      <div class="row">
        <div class="field">
          <label>{{ t('cup.variant') }}</label>
          <div class="segmented" role="group" :aria-label="t('cup.variant')">
            <button v-if="regeln.an.length > 1" type="button" data-variante="" :class="variante === undefined ? 'active' : ''" :aria-pressed="variante === undefined" @click="wahl.variante = undefined">
              {{ t('lists.wkr.all') }}
            </button>
            <template v-for="v in POKAL_VARIANTEN" :key="v">
              <button
                v-if="regeln.an.includes(v)"
                type="button"
                :data-variante="v"
                :class="variante === v || regeln.an.length === 1 ? 'active' : ''"
                :aria-pressed="variante === v || regeln.an.length === 1"
                @click="wahl.variante = v"
              >
                {{ t(`cup.variant.${v}`) }}
              </button>
            </template>
          </div>
        </div>
        <div class="field">
          <label :for="`${id}-herkunft`">{{ t(originLabelKey(state.originMode)) }}</label>
          <HerkunftWahl :id="`${id}-herkunft`" data-feld="pokal-herkunft" :wert="herkunftStil" @wahl="wahl.herkunft = $event as OriginStyle" />
        </div>
        <!-- Namen stehen nur auf der UIM-Liste. -->
        <div v-if="gezeigt.includes('uim')" class="field">
          <label>{{ t('results.version') }}</label>
          <div class="segmented" role="group" :aria-label="t('results.version')">
            <button v-for="f in FASSUNGEN" :key="f" type="button" :data-fassung="f" :class="wahl.fassung === f ? 'active' : ''" :aria-pressed="wahl.fassung === f" @click="wahl.fassung = f">
              {{ t(`results.version.${f}`) }}
            </button>
          </div>
        </div>
        <p class="note ergebnis-zahl" role="status">{{ tn('results.count', blaetter.length) }}</p>
      </div>
      <p class="note">
        {{ t('cup.rulesNote') }} <a :href="adresse('einstellungen', { ziel: 'pokal' })">{{ t('nav.einstellungen') }}</a
        >.
        <template v-if="gezeigt.includes('uim')">
          {{ t(`results.versionNote.${wahl.fassung}`) }} <a :href="adresse('einstellungen', { ziel: 'ergebnislisten' })">{{ t('nav.einstellungen') }}</a
          >.
        </template>
      </p>
      <p v-if="hatErgebnis && offen.length > 0" class="boat-banner warn" data-hinweis="pokal-zwischenstand" role="status">
        {{ t('cup.interimScreen', { classes: offen.map((k) => classLabel(k)).join(', ') }) }}
      </p>
      <p v-if="regeln.nurAuswahl" class="note" data-hinweis="pokal-auswahl">
        {{ tn('cup.selectionNote', abgewaehlt) }} <a :href="adresse('starter')">{{ t('nav.starter') }}</a
        >.
      </p>
      <p v-if="ohneHerkunftZahl > 0" class="note" data-hinweis="pokal-starter-ohne-herkunft">{{ tn('cup.withoutOrigin', ohneHerkunftZahl, { origin: t(originLabelKey(state.originMode)) }) }}</p>
      <p v-if="hatErgebnis && nichtGewertet > 0" class="note" data-hinweis="pokal-nicht-gewertet">{{ tn('cup.notRankedNote', nichtGewertet, { min: regeln.mindestens }) }}</p>
      <EingabenHinweis />
    </div>

    <div v-if="state.starters.length === 0" class="panel empty no-print">{{ t('lists.empty') }}</div>
    <div v-else-if="!hatErgebnis" class="panel empty no-print" data-hinweis="pokal-leer">
      {{ t('cup.empty') }} <a :href="adresse('erfassung')">{{ t('nav.erfassung') }}</a>
    </div>
    <div v-else-if="blaetter.length === 0" class="panel empty no-print">{{ t('cup.nobody') }}</div>

    <PokalStapel :pokal="pokal" :fassung="wahl.fassung" :herkunft="herkunftStil" />
  </template>
</template>
