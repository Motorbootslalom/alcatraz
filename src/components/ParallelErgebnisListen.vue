<script setup lang="ts">
import { computed, useId, watchEffect } from 'vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { useEvent } from '../lib/event'
import { wertungDer } from '../lib/ergebnis'
import {
  FINALE_UM_1,
  klassenDerRunde,
  QUALIFIZIERT,
  RUNDEN_ANSICHTEN as ANSICHTEN,
  RUNDEN_ORDNUNG as ORDNUNG,
  RUNDEN_UMFANG as UMFANG,
  rundenBlaetter,
  rundenErgebnisse,
  type RundenAnsicht,
  type RundenBlatt,
  type RundenOrdnung,
  type RundenUmfang,
} from '../lib/parallelErgebnis'
import { festeRunden } from '../lib/parallelBogen'
import { klassenStaende, offeneKlassen, offeneRundeText, stageBlaetter, type StageBlatt } from '../lib/parallelStage'
import { rundenName, VORLAUF, zerlegeRerun } from '../planung/parallelRunden'
import { PARALLEL } from '../config/catalog'
import { pokalVorgabe } from '../config/pokal'
import { t, tn } from '../i18n'
import { adresse } from '../lib/router'
import type { ClassId, ErgebnisFassung, ParallelRunde } from '../types'
import ParallelErgebnisStapel from './ParallelErgebnisStapel.vue'
import EingabenHinweis from './EingabenHinweis.vue'

/**
 * Die Wertungslisten des Parallelslaloms unter „Listen“: je Klasse die Liste der Attempts (zwei
 * Tabellen) und das Ergebnis der Runde, gerechnet aus den erfassten Werten
 * (lib/parallelErgebnis.ts) – für jede Runde mit festgeschriebenem Plan („preliminary heat /
 * semi-finals / finals“, Regel 960, Pkt. 5.2.2, und die Wiederholungen nach Pkt. 5.2.6) – und,
 * sobald eine Klasse alle Runden gefahren ist, ihr Gesamtergebnis des Parallelslaloms
 * (lib/parallelStage.ts). Die Bildschirmansicht ist die Druckansicht; gedruckt wird, was die
 * Auswahl zeigt.
 *
 * Ohne festgeschriebenen Plan gibt es keine Liste: Wer in welchem Attempt auf welchem
 * Racecourse fährt, steht nur im Plan.
 */
const emit = defineEmits<{
  /** Wie viele Listen die Auswahl zeigt und wie sie heißt (für Fenstertitel und Dateiname). */
  stand: [stand: { anzahl: number; auswahl: string }]
}>()

const { state } = useStore()
const konfig = useKonfig()
const { classLabel, regelwerk } = useEvent()
const id = useId()

const istEine = <T extends string>(liste: readonly T[], x: unknown): x is T => (liste as readonly unknown[]).includes(x)
// Fassung und Ansicht bleiben über Ansichtswechsel und Neuladen stehen – Bedienung, kein
// Inhalt: Die Ansicht „nach Attempt / nach Racecourse“ ändert keinen Wert und keinen Zeitstempel.
const wahl = merke<{ runde?: string; klasse?: ClassId; umfang: RundenUmfang; ordnung: RundenOrdnung; ansicht: RundenAnsicht; fassung: ErgebnisFassung }>(
  'listen.ergebnis.parallel',
  // Zuerst die Fassung für den Aushang: Sie ist die, die am ehesten ohne Nachdenken gedruckt wird.
  { fassung: 'aushang', umfang: 'alles', ordnung: 'platz', ansicht: 'attempt' },
  { ueberNeuladen: true },
)
const umfang = computed<RundenUmfang>(() => (istEine(UMFANG, wahl.value.umfang) ? wahl.value.umfang : 'alles'))
const ordnung = computed<RundenOrdnung>(() => (istEine(ORDNUNG, wahl.value.ordnung) ? wahl.value.ordnung : 'platz'))
const ansicht = computed<RundenAnsicht>(() => (istEine(ANSICHTEN, wahl.value.ansicht) ? wahl.value.ansicht : 'attempt'))
const fassung = computed<ErgebnisFassung>(() => (wahl.value.fassung === 'intern' ? 'intern' : 'aushang'))
const FASSUNGEN: ErgebnisFassung[] = ['aushang', 'intern']

/** Statt einer Runde gewählt: nur das Gesamtergebnis des Parallelslaloms. */
const STAGE = 'stage'
const mitPlan = computed(() => state.value.parallelPlaene[VORLAUF] !== undefined)
const runden = computed(() => festeRunden(state.value.parallelPlaene))
// Eine Wahl, die es nicht (mehr) gibt, gilt als „alle“.
const runde = computed<ParallelRunde | typeof STAGE | undefined>(() => (wahl.value.runde === STAGE ? STAGE : runden.value.find((r) => r === wahl.value.runde)))
// Je Runde die Klassen in der Reihenfolge, in der sie laut Plan zuerst starten.
const jeRunde = computed(() => runden.value.map((r) => ({ runde: r, ergebnisse: rundenErgebnisse(state.value, konfig.value, klassenDerRunde(state.value, r), r) })))
const vorlauf = computed(() => jeRunde.value.find((x) => x.runde === VORLAUF)?.ergebnisse ?? [])
const staende = computed(() => klassenStaende(state.value, konfig.value))
const stage = computed(() =>
  stageBlaetter(
    state.value,
    konfig.value,
    staende.value.map((ks) => ks.klasse),
    pokalVorgabe(state.value.regelwerk).punkte.uim,
  ),
)
/** Was die Wahl der Runde zeigt: die Ergebnisse der gewählten Runden und, bei „alle“ oder „Gesamtergebnis“, die der Stage. */
const gezeigt = computed(() => jeRunde.value.filter((x) => runde.value === undefined || x.runde === runde.value))
const mitStage = computed(() => runde.value === undefined || runde.value === STAGE)
const klassen = computed(() => {
  const da = new Set<ClassId>([...gezeigt.value.flatMap((x) => x.ergebnisse.map((e) => e.klasse)), ...(mitStage.value ? stage.value.map((b) => b.stage.klasse) : [])])
  return staende.value.map((ks) => ks.klasse).filter((k) => da.has(k))
})
const klasse = computed(() => (wahl.value.klasse !== undefined && klassen.value.includes(wahl.value.klasse) ? wahl.value.klasse : undefined))
// Erst die Runden in ihrer Folge, dahinter das Gesamtergebnis; „nur die Versuche“ zeigt es nicht.
const blaetter = computed<(RundenBlatt | StageBlatt)[]>(() => [
  ...gezeigt.value.flatMap((x) => rundenBlaetter(x.ergebnisse, { klassen: klasse.value === undefined ? undefined : [klasse.value], umfang: umfang.value, ordnung: ordnung.value })),
  ...(mitStage.value && (umfang.value !== 'attempts' || runde.value === STAGE) ? stage.value.filter((b) => klasse.value === undefined || b.stage.klasse === klasse.value) : []),
])
const name = (r: ParallelRunde) => rundenName(r, t)

// Was bei gleicher Summe entscheidet, legt das Regelwerk fest – hier in Worten.
const stichText = computed(() => {
  const kriterien = wertungDer(regelwerk.value, PARALLEL).stichentscheid
  if (kriterien.length === 0) return t('results.tie.none')
  return [...(kriterien.length === 1 && kriterien[0] === 'besterLauf' ? [t('parallel.results.tie')] : kriterien.map((k) => t(`results.tie.${k}`))), t('results.tie.shared')].join(' ')
})

// Wo jede Klasse steht: im Vorlauf noch offen oder entschieden, im Gleichstand an einer Grenze
// zum Weiterkommen (Vorlauf: Platz 4/5, Halbfinale: Platz 2/3) – und wo das Gesamtergebnis noch fehlt.
const nummern = (ids: readonly string[]) => ids.map((sid) => state.value.starters.find((p) => p.id === sid)?.startNr ?? '?').join(', ')
const gleichstand = computed(() =>
  jeRunde.value
    .filter((x) => !zerlegeRerun(x.runde))
    .flatMap((x) =>
      x.ergebnisse
        .filter((e) => e.rerun.length > 0)
        .map((e) => ({
          schluessel: `${x.runde}/${e.klasse}`,
          klasse: e.klasse,
          text: t(x.runde === 'semi' ? 'parallel.results.deadHeatSemi' : 'parallel.results.deadHeat', { class: classLabel(e.klasse), numbers: nummern(e.rerun), n: x.runde === 'semi' ? FINALE_UM_1 : QUALIFIZIERT }),
        })),
    ),
)
const offen = computed(() => vorlauf.value.filter((e) => !e.vollstaendig).map((e) => classLabel(e.klasse)))
const entschieden = computed(() => vorlauf.value.filter((e) => e.entschieden).map((e) => classLabel(e.klasse)))
const ohneStage = computed(() => (vorlauf.value.length === 0 ? [] : offeneKlassen(state.value, konfig.value).map((o) => `${classLabel(o.klasse)} (${offeneRundeText(o, name, t('parallel.rounds.staleHint'))})`)))
const fertig = computed(() => staende.value.filter((ks) => ks.fertig).map((ks) => classLabel(ks.klasse)))

/** Die Auswahl in Worten, für Fenstertitel und Dateiname – in der Sprache der Oberfläche. */
const auswahlText = computed(() =>
  [
    t('parallel.title'),
    runde.value === STAGE ? t('parallel.stage.title') : runde.value !== undefined ? name(runde.value) : '',
    klasse.value !== undefined ? classLabel(klasse.value) : klassen.value.length > 1 ? t('results.allClasses') : klassen.value.map((k) => classLabel(k)).join(''),
    umfang.value === 'alles' ? '' : t(`parallel.results.${umfang.value}`),
  ]
    .filter(Boolean)
    .join(' - '),
)
watchEffect(() => emit('stand', { anzahl: blaetter.value.length, auswahl: auswahlText.value }))

function setze(feld: 'runde' | 'klasse' | 'umfang' | 'ordnung', e: Event) {
  const wert = (e.target as HTMLSelectElement).value
  wahl.value = { ...wahl.value, [feld]: (feld === 'klasse' || feld === 'runde') && wert === '' ? undefined : wert }
}
</script>

<template>
  <div class="panel no-print ergebnis-wahl" data-listen="parallel-ergebnis">
    <p class="hint">{{ t('parallel.results.hint') }}</p>
    <!-- Ohne festgeschriebenen Plan gibt es nichts zu werten. -->
    <p v-if="!mitPlan" class="boat-banner warn" role="status" data-hinweis="parallel-plan">
      {{ t('parallel.results.needPlan') }} <a :href="adresse('verzahnung', { reiter: 'parallel' })">{{ t('nav.verzahnung') }} → {{ t('parallel.title') }}</a>
    </p>
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
          <label>{{ t('parallel.results.view') }}</label>
          <div class="segmented" role="group" :aria-label="t('parallel.results.view')">
            <button v-for="a in ANSICHTEN" :key="a" type="button" :data-ansicht="a" :class="ansicht === a ? 'active' : ''" :aria-pressed="ansicht === a" @click="wahl.ansicht = a">
              {{ t(`parallel.results.view.${a}`) }}
            </button>
          </div>
        </div>
        <div class="field">
          <label :for="`${id}-runde`">{{ t('parallel.lists.round') }}</label>
          <select :id="`${id}-runde`" class="input" data-feld="perg-runde" :value="runde ?? ''" @change="setze('runde', $event)">
            <option value="">{{ t('lists.wkr.all') }}</option>
            <option v-for="r in runden" :key="r" :value="r">{{ name(r) }}</option>
            <option :value="STAGE">{{ t('parallel.stage.title') }}</option>
          </select>
        </div>
        <div class="field">
          <label :for="`${id}-klasse`">{{ t('lists.class') }}</label>
          <select :id="`${id}-klasse`" class="input" data-feld="perg-klasse" :value="klasse ?? ''" @change="setze('klasse', $event)">
            <option value="">{{ t('lists.wkr.all') }}</option>
            <option v-for="k in klassen" :key="k" :value="k">{{ classLabel(k) }}</option>
          </select>
        </div>
        <div class="field">
          <label :for="`${id}-umfang`">{{ t('results.scope') }}</label>
          <select :id="`${id}-umfang`" class="input" data-feld="perg-umfang" :value="umfang" @change="setze('umfang', $event)">
            <option v-for="u in UMFANG" :key="u" :value="u">{{ t(`parallel.results.scope.${u}`) }}</option>
          </select>
        </div>
        <div class="field">
          <label :for="`${id}-ordnung`">{{ t('parallel.results.order') }}</label>
          <select :id="`${id}-ordnung`" class="input" data-feld="perg-ordnung" :value="ordnung" @change="setze('ordnung', $event)">
            <option v-for="o in ORDNUNG" :key="o" :value="o">{{ t(`results.order.${o}`) }}</option>
          </select>
        </div>
        <p class="note ergebnis-zahl" role="status">{{ tn('results.count', blaetter.length) }}</p>
      </div>
      <p class="note" data-hinweis="parallel-wertung">{{ t('parallel.results.rules', { n: QUALIFIZIERT }) }}</p>
      <!-- Der Stichentscheid kommt aus dem Regelwerk; hier steht, was es festlegt. -->
      <p class="note" data-hinweis="stich">{{ stichText }}</p>
      <p class="note" data-hinweis="parallel-ansicht">{{ t('parallel.results.viewNote') }}</p>
      <p class="note">
        {{ t(`results.versionNote.${fassung}`) }} <a :href="adresse('einstellungen', { ziel: 'ergebnislisten' })">{{ t('nav.einstellungen') }}</a
        >.
      </p>
      <!-- Gleichstand an der Grenze zum Weiterkommen: Er sperrt es, bis der Re-run gefahren ist (Pkt. 5.2.6). -->
      <p v-for="g in gleichstand" :key="g.schluessel" class="boat-banner warn" role="alert" data-hinweis="parallel-gleichstand" :data-klasse="g.klasse">
        {{ g.text }} <a :href="adresse('verzahnung', { reiter: 'parallel' })">{{ t('nav.verzahnung') }} → {{ t('parallel.title') }}</a>
      </p>
      <p v-if="offen.length > 0" class="note" role="status" data-hinweis="parallel-offen">{{ t('parallel.results.open', { classes: offen.join(', ') }) }}</p>
      <p v-if="entschieden.length > 0" class="boat-banner ok" role="status" data-hinweis="parallel-entschieden">{{ t('parallel.results.decided', { classes: entschieden.join(', ') }) }}</p>
      <!-- Das Gesamtergebnis einer Klasse gibt es erst, wenn sie alle ihre Runden gefahren ist. -->
      <p v-if="ohneStage.length > 0" class="note" role="status" data-hinweis="parallel-stage-offen">
        {{ t('parallel.stage.open', { classes: ohneStage.join(', ') }) }} <a :href="adresse('verzahnung', { reiter: 'parallel' })">{{ t('nav.verzahnung') }} → {{ t('parallel.title') }}</a>
      </p>
      <p v-if="fertig.length > 0" class="boat-banner ok" role="status" data-hinweis="parallel-stage-fertig">{{ t('parallel.stage.done', { classes: fertig.join(', ') }) }}</p>
      <p class="note" data-hinweis="parallel-mannschaft">{{ t('parallel.results.team') }}</p>
    </template>
    <EingabenHinweis />
  </div>

  <template v-if="mitPlan">
    <div v-if="vorlauf.length === 0" class="panel empty no-print" data-hinweis="parallel-leer">
      {{ t('parallel.results.empty') }} <a :href="adresse('erfassung')">{{ t('nav.erfassung') }}</a>
    </div>
    <div v-else-if="blaetter.length === 0" class="panel empty no-print">{{ t('results.nothing') }}</div>
  </template>

  <ParallelErgebnisStapel :blaetter="blaetter" :fassung="fassung" :ansicht="ansicht" />
</template>
