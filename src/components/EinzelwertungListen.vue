<script setup lang="ts">
import { computed, useId, watchEffect } from 'vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { useEvent } from '../lib/event'
import { einzelBlaetter, einzelwertungen, kenntEinzelwertung } from '../lib/einzelwertung'
import { DISZIPLIN_TEXT, disziplinGefahren, WERTUNGS_DISZIPLINEN } from '../lib/disziplinen'
import { rundenName } from '../planung/parallelRunden'
import { pokalVorgabe } from '../config/pokal'
import { t, tn } from '../i18n'
import { adresse } from '../lib/router'
import type { ClassId, ErgebnisFassung } from '../types'
import EinzelwertungStapel from './EinzelwertungStapel.vue'
import EingabenHinweis from './EingabenHinweis.vue'
import NichtWertenWahl from './NichtWertenWahl.vue'

/**
 * Die Einzelwertung unter „Listen → Wertungslisten“ („Individual competition“, Regel 960, Pkt.
 * 5.2.3): je Klasse die UIM points aus dem Manövrieren und aus dem Parallelslalom, ihre Summe
 * und der Platz (lib/einzelwertung.ts). Die Bildschirmansicht ist die Druckansicht; gedruckt
 * wird, was die Auswahl zeigt.
 *
 * Eine Disziplin zählt, sobald zu ihr der erste Wert erfasst ist (lib/disziplinen.ts) – auch nur
 * eine von beiden, in beliebiger Reihenfolge. Eine Liste gibt es je Klasse, wenn jede Disziplin
 * fertig ist, die für die Klasse zählt – vorher sagt die Ansicht, woran es hängt. Hier steht
 * auch der Schalter „Disziplin nicht werten“ (Entscheidung des O.O.D.).
 */
const emit = defineEmits<{
  /** Wie viele Listen die Auswahl zeigt und wie sie heißt (für Fenstertitel und Dateiname). */
  stand: [stand: { anzahl: number; auswahl: string }]
}>()

const { state } = useStore()
const konfig = useKonfig()
const { classes, classLabel } = useEvent()
const id = useId()

// Fassung und Klasse bleiben über Ansichtswechsel und Neuladen stehen – Bedienung, kein Inhalt.
const wahl = merke<{ klasse?: ClassId; fassung: ErgebnisFassung }>('listen.ergebnis.einzel', { fassung: 'aushang' }, { ueberNeuladen: true })
const fassung = computed<ErgebnisFassung>(() => (wahl.value.fassung === 'intern' ? 'intern' : 'aushang'))
const FASSUNGEN: ErgebnisFassung[] = ['aushang', 'intern']

const punkte = computed(() => pokalVorgabe(state.value.regelwerk).punkte.uim)
const klassenIds = computed(() => classes.value.map((c) => c.id))
/** Gibt es eine Einzelwertung? Sobald zu einer Disziplin der erste Wert erfasst ist (unter Regel 960). */
const gewertet = computed(() => kenntEinzelwertung(konfig.value) && WERTUNGS_DISZIPLINEN.some((d) => disziplinGefahren(state.value, d)))
const alle = computed(() => einzelBlaetter(state.value, konfig.value, klassenIds.value, punkte.value))
const klassen = computed(() => alle.value.map((b) => b.einzel.klasse))
// Eine Wahl, die es nicht (mehr) gibt, gilt als „alle“.
const klasse = computed(() => (wahl.value.klasse !== undefined && klassen.value.includes(wahl.value.klasse) ? wahl.value.klasse : undefined))
const blaetter = computed(() => alle.value.filter((b) => klasse.value === undefined || b.einzel.klasse === klasse.value))

// Woran es bei den Klassen ohne Liste hängt: am Manövrieren, an einer Runde des Parallelslaloms,
// an beidem – oder daran, dass für die Klasse keine Disziplin gewertet wird.
const offen = computed(() =>
  gewertet.value
    ? einzelwertungen(state.value, konfig.value, klassenIds.value, punkte.value)
        .filter((e) => !e.fertig)
        .map((e) => {
          const woran =
            e.disziplinen.length === 0
              ? [t('individual.noDiscipline')]
              : [...(e.manoeverFertig ? [] : [t(DISZIPLIN_TEXT.manoever)]), ...(e.parallelFertig ? [] : [e.offeneRunde ? rundenName(e.offeneRunde, t) + (e.planVeraltet ? ` – ${t('parallel.rounds.staleHint')}` : '') : t(DISZIPLIN_TEXT.parallel)])]
          return `${classLabel(e.klasse)} (${woran.join(', ')})`
        })
    : [],
)
const fertig = computed(() => klassen.value.map((k) => classLabel(k)))

/** Die Auswahl in Worten, für Fenstertitel und Dateiname – in der Sprache der Oberfläche. */
const auswahlText = computed(() =>
  [t('individual.title'), klasse.value !== undefined ? classLabel(klasse.value) : klassen.value.length > 1 ? t('results.allClasses') : klassen.value.map((k) => classLabel(k)).join('')].filter(Boolean).join(' - '),
)
watchEffect(() => emit('stand', { anzahl: blaetter.value.length, auswahl: auswahlText.value }))

function setzeKlasse(e: Event) {
  const wert = (e.target as HTMLSelectElement).value
  wahl.value = { ...wahl.value, klasse: wert === '' ? undefined : (wert as ClassId) }
}
</script>

<template>
  <div class="panel no-print ergebnis-wahl" data-listen="einzelwertung">
    <p class="hint">{{ t('individual.hint') }}</p>
    <!-- Ohne einen erfassten Wert zählt keine Disziplin: Es gibt noch nichts zu werten. -->
    <p v-if="!gewertet" class="boat-banner warn" role="status" data-hinweis="einzel-ohne-werte">{{ t('individual.needValues') }}</p>
    <template v-else>
      <div class="row">
        <div class="field">
          <label>{{ t('results.version') }}</label>
          <div class="segmented" role="group" :aria-label="t('results.version')">
            <button v-for="f in FASSUNGEN" :key="f" type="button" :data-fassung="f" :class="fassung === f ? 'active' : ''" :aria-pressed="fassung === f" @click="wahl.fassung = f">
              {{ t(`results.version.${f}`) }}
            </button>
          </div>
        </div>
        <div class="field">
          <label :for="`${id}-klasse`">{{ t('lists.class') }}</label>
          <select :id="`${id}-klasse`" class="input" data-feld="einzel-klasse" :value="klasse ?? ''" @change="setzeKlasse">
            <option value="">{{ t('lists.wkr.all') }}</option>
            <option v-for="k in klassen" :key="k" :value="k">{{ classLabel(k) }}</option>
          </select>
        </div>
        <p class="note ergebnis-zahl" role="status">{{ tn('results.count', blaetter.length) }}</p>
      </div>
      <p class="note" data-hinweis="einzel-wertung">{{ t('individual.rules') }}</p>
      <!-- Der Stichentscheid nach Pkt. 5.2.6 – und was dazu festgelegt ist. -->
      <p class="note" data-hinweis="stich">{{ t('individual.tie') }} {{ t('results.tie.shared') }} {{ t('individual.tieDecided') }}</p>
      <p class="note">
        {{ t(`results.versionNote.${fassung}`) }} <a :href="adresse('einstellungen', { ziel: 'ergebnislisten' })">{{ t('nav.einstellungen') }}</a
        >.
      </p>
      <p v-if="offen.length > 0" class="note" role="status" data-hinweis="einzel-offen">{{ t('individual.open', { classes: offen.join('; ') }) }}</p>
      <p v-if="fertig.length > 0" class="boat-banner ok" role="status" data-hinweis="einzel-fertig">{{ t('individual.done', { classes: fertig.join(', ') }) }}</p>
      <NichtWertenWahl />
    </template>
    <EingabenHinweis />
  </div>

  <div v-if="gewertet && blaetter.length === 0" class="panel empty no-print" data-hinweis="einzel-leer">{{ t('individual.empty') }}</div>

  <EinzelwertungStapel :blaetter="blaetter" :fassung="fassung" />
</template>
