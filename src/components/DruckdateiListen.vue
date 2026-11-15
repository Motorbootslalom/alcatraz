<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUpdated, ref, watch, watchEffect } from 'vue'
import { DRUCKSEITE, useLeereRueckseite } from '../lib/doppelseitig'
import { pageHeightMm, printableHeightPx } from '../lib/paging'
import LeereRueckseite from './LeereRueckseite.vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { useEvent } from '../lib/event'
import { klassenErgebnis } from '../lib/ergebnis'
import type { PokalVariante } from '../config/pokal'
import { ergebnisBlaetter } from '../lib/ergebnisBlaetter'
import { rundenBlaetter, rundenErgebnisse, RUNDEN_ANSICHTEN, type RundenAnsicht, type RundenBlatt } from '../lib/parallelErgebnis'
import { festeRunden } from '../lib/parallelBogen'
import { offeneKlassen, offeneRundeText, stageBlaetter, type StageBlatt } from '../lib/parallelStage'
import { rundenName } from '../planung/parallelRunden'
import { pokalVorgabe } from '../config/pokal'
import { pokalWahl, usePokalWertung } from '../lib/pokalBlaetter'
import { druckdateiFolge, druckdateiVorgabe, istDruckdateiWahl, teilGewaehlt, type DruckdateiDokument, type DruckdateiFassung, type DruckdateiTeil, type DruckdateiWahl, type ParallelAbschnitt } from '../lib/druckdatei'
import { einzelBlaetter } from '../lib/einzelwertung'
import { nichtGewertet } from '../lib/disziplinen'
import { starterDokumente } from '../lib/starterlisten'
import { namenDerFassung } from '../lib/namen'
import { istOriginStyle } from '../lib/origin'
import { useListenSprache } from '../lib/listensprache'
import { t, tn } from '../i18n'
import { adresse } from '../lib/router'
import type { ClassId, ErgebnisFassung, OriginStyle, ParallelRunde } from '../types'
import StarterBlaetter from './StarterBlaetter.vue'
import PokalStapel from './PokalStapel.vue'
import CodesAushang from './CodesAushang.vue'
import ErgebnisStapel from './ErgebnisStapel.vue'
import ParallelErgebnisStapel from './ParallelErgebnisStapel.vue'
import ParallelStartlisten from './ParallelStartlisten.vue'
import EinzelwertungStapel from './EinzelwertungStapel.vue'
import EingabenHinweis from './EingabenHinweis.vue'

/**
 * Die Druckdatei unter „Listen“: alles, was nach dem Wettkampf an die teilnehmenden Gruppen
 * geht, in EINEM Druck – „Als PDF speichern“ ergibt eine Datei. Vorbild ist die lange PDF der
 * Deutschen Meisterschaft: Starterliste (verzahnt, je Parcours), Mannschaftswertungen, die
 * Erklärung der Codes, dann je Klasse die Läufe und die Gesamtliste, nach Platz.
 *
 * Hier steht nur die Folge. Jedes Blatt zeichnet die Komponente, die es auch in seinem eigenen
 * Reiter zeichnet (StarterBlaetter, PokalStapel, CodesAushang, ErgebnisStapel) – eine Änderung
 * an einer Liste gilt damit auch hier. Jedes Dokument teilt sich selbst in Seiten und zählt
 * nur die eigenen; Hoch- und Querformat wechseln über die benannten Seiten der Blätter.
 *
 * Zwei Fassungen, mit denselben Einstellungen wie die Wertungslisten: „Extern“ ist der Aushang
 * (Namen gekürzt oder weggelassen, wie eingestellt; die Starterliste ebenso und immer ohne
 * Geburtsdatum), „Intern“ zeigt volle Namen.
 */
const props = defineProps<{
  /** Startnummern fehlen oder sind doppelt: Dann gibt es keine Starterliste (wie in ihrem eigenen Reiter). */
  starterGesperrt?: boolean
}>()
const emit = defineEmits<{
  /** Wie viele Listen die Auswahl zeigt und wie sie heißt (für Fenstertitel und Dateiname). */
  stand: [stand: { anzahl: number; auswahl: string }]
}>()

const { state } = useStore()
const konfig = useKonfig()
const { classes, classLabel, parallel } = useEvent()
const { t: lt } = useListenSprache()

const FASSUNGEN: DruckdateiFassung[] = ['extern', 'intern']
const TEILE: DruckdateiTeil[] = ['starter', 'pokal', 'einzel', 'codes', 'ergebnis', 'parallel']
const wahl = merke<DruckdateiWahl>('listen.druckdatei', druckdateiVorgabe, { ueberNeuladen: true, gueltig: istDruckdateiWahl })
/** „Extern“ ist die Fassung „Aushang“ der Wertungslisten – dieselben Einstellungen, ein anderes Wort für eine Datei, die verschickt wird. */
const fassung = computed<ErgebnisFassung>(() => (wahl.value.fassung === 'intern' ? 'intern' : 'aushang'))

// ---- Starterliste: die verzahnte, je Parcours – so steht sie in der Vorlage vorn.
const starter = computed(() =>
  props.starterGesperrt
    ? []
    : starterDokumente(state.value, { liste: 'starter', art: 'verzahnt' }, { starter: lt('lists.title.starter'), vorsteg: lt('lists.title.vorsteg'), gewicht: lt('lists.title.gewicht'), klasse: lt('lists.title.klasse') }),
)
// Auf der Starterliste gilt dieselbe Regel wie auf den Wertungslisten der Fassung: Was dort
// gekürzt oder weggelassen wird, stünde sonst zwei Seiten weiter vorn doch da.
const namen = computed(() => namenDerFassung(fassung.value, state.value))
const herkunftArt = computed(() => state.value.ergebnisListen[fassung.value].herkunft)
// Nach außen nie ein Geburtsdatum; intern nur, wenn die Veranstaltung es auf ihren Listen zeigt.
const geburtsdatum = computed(() => wahl.value.fassung === 'intern' && state.value.showBirthdate)

// ---- Mannschaftswertungen: alle, die für die Veranstaltung eingeschaltet sind; ohne Herkunft keine.
const pokal = usePokalWertung()
const pokalHerkunft = computed<OriginStyle>(() => {
  const h = pokalWahl().value.herkunft
  return istOriginStyle(h) ? h : 'lang'
})
/** Gibt es für die Veranstaltung überhaupt eine Mannschaftswertung? Sonst entfällt das Kästchen. */
const pokalMoeglich = computed(() => !pokal.ohneHerkunft && pokal.regeln.an.length > 0)

// ---- Wertungslisten: Klassen in der Reihenfolge des Regelwerks (E, 1 … 7) wie in der Vorlage,
// nach Platz. Die Startfolge der Verzahnung, nach der der Reiter „Wertungslisten“ ordnet, sagt
// dem Empfänger nichts.
const ergebnisse = computed(() => classes.value.flatMap((c) => klassenErgebnis(state.value, konfig.value, c.id) ?? []))
// ---- Wertungslisten des Parallelslaloms: das Gesamtergebnis je Klasse (sobald sie alle Runden
// gefahren ist) und je Runde mit festgeschriebenem Plan die Liste der Attempts und das Ergebnis
// der Runde, nach Platz – nur unter einem Regelwerk, das ihn kennt (lib/parallelErgebnis.ts,
// lib/parallelStage.ts). Runden und Gesamtergebnis lassen sich einzeln abwählen.
const STAGE = 'stage'
const alleKlassen = computed(() => classes.value.map((c) => c.id))
const rundenFest = computed(() => (parallel.value ? festeRunden(state.value.parallelPlaene) : []))
const rundenAn = (r: string) => !(wahl.value.ohneRunden ?? []).includes(r)
const jeRunde = computed(() => rundenFest.value.map((r) => ({ runde: r, ergebnisse: rundenErgebnisse(state.value, konfig.value, alleKlassen.value, r) })).filter((x) => x.ergebnisse.length > 0))
const runden = computed(() => jeRunde.value.flatMap((x) => x.ergebnisse))
const stage = computed(() => (parallel.value ? stageBlaetter(state.value, konfig.value, alleKlassen.value, pokalVorgabe(state.value.regelwerk).punkte.uim) : []))
/** Was sich im Parallelslalom abwählen lässt: das Gesamtergebnis und die Runden mit Listen. */
const rundenWahl = computed(() => [...(stage.value.length > 0 ? [{ id: STAGE, name: t('parallel.stage.title') }] : []), ...jeRunde.value.map((x) => ({ id: x.runde as string, name: rundenName(x.runde, t) }))])
function setzeRunde(r: string, an: boolean) {
  const ohne = wahl.value.ohneRunden ?? []
  wahl.value.ohneRunden = an ? ohne.filter((x) => x !== r) : [...ohne, r]
}
const ansicht = computed<RundenAnsicht>(() => RUNDEN_ANSICHTEN.find((a) => a === wahl.value.ansicht) ?? 'attempt')
// Die Klassen beider Disziplinen, in der Reihenfolge des Regelwerks: Eine Klasse abwählen gilt für beide.
const klassen = computed(() => classes.value.map((c) => c.id).filter((k) => ergebnisse.value.some((e) => e.klasse === k) || runden.value.some((e) => e.klasse === k)))
const gewaehlt = computed(() => klassen.value.filter((k) => !wahl.value.ohneKlassen.includes(k)))
// ---- Einzelwertung (Regel 960, Pkt. 5.2.3; lib/einzelwertung.ts): je Klasse eine Liste, sobald
// jede Disziplin fertig ist, die für die Klasse zählt – auch wenn nur eine gefahren ist. Eine
// Disziplin ohne Werte fehlt. Unter der DM gibt es dazu weder Kästchen noch Dokumente.
const einzelAlle = computed(() => (parallel.value ? einzelBlaetter(state.value, konfig.value, alleKlassen.value, pokalVorgabe(state.value.regelwerk).punkte.uim) : []))
const einzelMoeglich = computed(() => einzelAlle.value.length > 0)
const einzel = computed(() => einzelAlle.value.filter((b) => gewaehlt.value.includes(b.einzel.klasse)))
const listen = computed(() => ergebnisBlaetter(ergebnisse.value, { klassen: gewaehlt.value, umfang: wahl.value.umfang, ordnungLauf: 'platz', ordnungGesamt: 'platz' }))
// „nur die Gesamtliste“ heißt hier: nur das Ergebnis der Runde.
// Der Parallelslalom in Abschnitten: das Gesamtergebnis, dann je Runde ihre Wertungslisten – unter
// Regel 960 steht vor jeder Runde ihre Startliste mit den Blöcken (lib/druckdatei.ts).
const rundenAbschnitte = computed<{ gruppe: string; startliste?: ParallelRunde; blaetter: (RundenBlatt | StageBlatt)[] }[]>(() => [
  ...(rundenAn(STAGE) ? [{ gruppe: STAGE, blaetter: stage.value.filter((b) => gewaehlt.value.includes(b.stage.klasse)) }] : []),
  ...jeRunde.value
    .filter((x) => rundenAn(x.runde))
    .map((x) => ({ gruppe: x.runde as string, startliste: x.runde, blaetter: rundenBlaetter(x.ergebnisse, { klassen: gewaehlt.value, umfang: wahl.value.umfang === 'gesamt' ? 'result' : 'alles', ordnung: 'platz' }) })),
])
const rundenListen = computed<(RundenBlatt | StageBlatt)[]>(() => rundenAbschnitte.value.flatMap((a) => a.blaetter))

/** Die Dokumente in Druckreihenfolge (lib/druckdatei.ts) – daran hängen Zahl, Aufbau in Schritten und Reihenfolge. */
// Unter einem Regelwerk mit Parallelslalom (Regel 960) gilt die Ordnung des Nutzers vom 15.11.2026:
// Mannschaftswertung, Codes, Einzelwertung, dann je Disziplin ihre Listen. Die Datei der DM bleibt, wie sie ist.
const folge = computed(() =>
  druckdateiFolge(
    wahl.value,
    {
      starter: starter.value.map((s) => s.id),
      pokal: pokalMoeglich.value ? pokal.blaetter : [],
      einzel: einzel.value.map((b) => b.key),
      ergebnis: listen.value.map((b) => b.key),
      parallel: rundenListen.value.map((b) => b.key),
      parallelAbschnitte: rundenAbschnitte.value.map((a): ParallelAbschnitt => ({ gruppe: a.gruppe, startliste: a.startliste, ids: a.blaetter.map((b) => b.key) })),
    },
    parallel.value ? 'regel960' : 'dm',
  ),
)

// ---- Aufbau in Schritten. Bei 48 Startern sind es rund 40 Seiten, bei großen Feldern weit
// über 100; jedes Dokument misst sich nach dem Einhängen selbst aus. Alles in einem Zug
// aufgebaut, stünde das Fenster so lange still. Deshalb kommen die Dokumente in kleinen
// Portionen, dazwischen kommt der Browser zum Zeichnen und Bedienen. Gedruckt werden kann
// erst, wenn alle da sind – sonst fehlte der Datei das Ende.
// Ein Dokument je Schritt: Gemessen bei 336 Startern (83 Seiten) steht das Fenster so höchstens
// rund 0,2 s am Stück still (zwei je Schritt: 0,3 s), der Aufbau dauert dafür 3,0 statt 2,4 s –
// bedienbar bleiben zählt hier mehr als die halbe Sekunde.
const SCHRITT = 1
const gebaut = ref(0)
let naechster: ReturnType<typeof setTimeout> | undefined
function weiter() {
  naechster = undefined
  gebaut.value = Math.min(folge.value.length, gebaut.value + SCHRITT)
  if (gebaut.value < folge.value.length) naechster = setTimeout(weiter, 0)
}
// Eine andere Auswahl oder Fassung beginnt von vorn; ein geänderter Wert in einer Liste nicht.
watch(
  () => `${wahl.value.fassung}|${folge.value.map((d) => `${d.teil}:${d.id}`).join(',')}`,
  () => {
    if (naechster !== undefined) clearTimeout(naechster)
    gebaut.value = 0
    weiter()
  },
  { immediate: true },
)
onBeforeUnmount(() => naechster !== undefined && clearTimeout(naechster))
const fertig = computed(() => gebaut.value >= folge.value.length)
/**
 * Was schon aufgebaut ist, in Abschnitten: aufeinanderfolgende Dokumente desselben Teils (im
 * Parallelslalom: derselben Runde) stehen in einem Stapel. Jeder Abschnitt beginnt im Druck auf
 * einem neuen Blatt.
 */
const abschnitte = computed(() => {
  const out: { teil: DruckdateiDokument['teil']; gruppe?: string; ids: string[] }[] = []
  for (const d of folge.value.slice(0, gebaut.value)) {
    const letzter = out[out.length - 1]
    if (letzter && letzter.teil === d.teil && letzter.gruppe === d.gruppe) letzter.ids.push(d.id)
    else out.push({ teil: d.teil, gruppe: d.gruppe, ids: [d.id] })
  }
  return out.map((a) => ({ ...a, key: `${a.teil}:${a.gruppe ?? ''}` }))
})
const starterVon = (ids: readonly string[]) => starter.value.filter((s) => ids.includes(s.id))
const einzelVon = (ids: readonly string[]) => einzel.value.filter((b) => ids.includes(b.key))
const listenVon = (ids: readonly string[]) => listen.value.filter((b) => ids.includes(b.key))
const rundenVon = (ids: readonly string[]) => rundenListen.value.filter((b) => ids.includes(b.key))

// ---- Unfertiger Stand: welche Klassen noch kein Endergebnis haben und welche Läufe ihnen fehlen.
// Klassen, denen dieselben Läufe fehlen, stehen zusammen – mitten im Wettkampf sind das meist alle.
const offen = computed(() => {
  const gruppen = new Map<string, { fehlen: number[]; klassen: string[] }>()
  // Unter Regel 960 zählt das Manövrieren erst, wenn dazu etwas erfasst ist (lib/disziplinen.ts):
  // Eine Veranstaltung, die nur den Parallelslalom fährt, ist ohne es fertig.
  const manoeverZaehlt = !pokal.uimRegel || pokal.gefahren.includes('manoever')
  for (const k of manoeverZaehlt ? pokal.klassen.filter((x) => !x.fertig) : []) {
    const fehlen = Array.from({ length: Math.max(1, state.value.laufCount) }, (_, i) => i + 1).filter((n) => !k.laeufe.includes(n))
    const schluessel = fehlen.join(',')
    if (!gruppen.has(schluessel)) gruppen.set(schluessel, { fehlen, klassen: [] })
    gruppen.get(schluessel)!.klassen.push(classLabel(k.klasse))
  }
  const manoever = [...gruppen.values()].map((g) => (g.fehlen.length > 0 ? tn('booklet.missingRuns', g.fehlen.length, { class: g.klassen.join(', '), runs: g.fehlen.join(', ') }) : g.klassen.join(', ')))
  // Parallelslalom: Klassen, die noch nicht alle Runden gefahren sind – mit der Runde, an der es hängt.
  // Erst, wenn zum Parallelslalom etwas erfasst ist: Eine Veranstaltung nach Regel 960, die nur
  // das Manövrieren fährt, ist ohne ihn fertig.
  const stageOffen = parallel.value && runden.value.length > 0 ? offeneKlassen(state.value, konfig.value)
        // Eine Klasse, für die der O.O.D. den Parallelslalom nicht wertet, hält nichts auf.
        .filter((o) => !nichtGewertet(state.value.nichtWerten, 'parallel', o.klasse))
        .map((o) => `${classLabel(o.klasse)} (${offeneRundeText(o, (r) => rundenName(r, t), t('parallel.rounds.staleHint'))})`) : []
  return stageOffen.length > 0 ? [...manoever, t('booklet.parallelOpen', { classes: stageOffen.join(', ') })] : manoever
})

/** Die Auswahl in Worten, für Fenstertitel und Dateiname – in der Sprache der Oberfläche. */
watchEffect(() => emit('stand', { anzahl: fertig.value ? folge.value.length : 0, auswahl: t(`booklet.version.${wahl.value.fassung}`) }))

// ---- Doppelseitig (lib/doppelseitig.ts): Die Listen zählen ihre Seiten selbst; der Aushang
// der Codes ist ein Blatt, das der Browser umbricht. Seine Seitenzahl folgt aus seiner Höhe –
// in aller Regel eine, dann folgt ihm eine leere Rückseite.
const codesTeil = ref<HTMLElement>()
/** Der Abschnitt der Codes steht in einer Schleife – sein Element kommt über eine Funktion. */
const merkeCodesTeil = (el: unknown) => {
  codesTeil.value = el instanceof HTMLElement ? el : undefined
}
const codesSeiten = ref(1)
function messeCodes() {
  const px = codesTeil.value?.querySelector('.sheet-section')?.getBoundingClientRect().height ?? 0
  // Ohne Layout (Test-DOM) bleibt es bei einer Seite.
  if (px > 0) codesSeiten.value = Math.max(1, Math.ceil(px / printableHeightPx(pageHeightMm('portrait'))))
}
onMounted(messeCodes)
onUpdated(messeCodes)
const codesLeer = useLeereRueckseite(
  () => codesSeiten.value,
  () => codesTeil.value?.querySelector(`[${DRUCKSEITE}]`),
)
const druckseite = { [DRUCKSEITE]: '' }

const teilAn = (teil: DruckdateiTeil) => teilGewaehlt(wahl.value, teil)
function setzeKlasse(k: ClassId, an: boolean) {
  wahl.value.ohneKlassen = an ? wahl.value.ohneKlassen.filter((x) => x !== k) : [...wahl.value.ohneKlassen, k]
}
</script>

<template>
  <div class="panel no-print druckdatei-wahl">
    <p class="hint">{{ t(parallel ? 'booklet.hint960' : 'booklet.hint') }}</p>
    <div class="row">
      <div class="field">
        <label>{{ t('results.version') }}</label>
        <div class="segmented" role="group" :aria-label="t('results.version')">
          <button v-for="f in FASSUNGEN" :key="f" type="button" :data-fassung="f" :class="wahl.fassung === f ? 'active' : ''" :aria-pressed="wahl.fassung === f" @click="wahl.fassung = f">
            {{ t(`booklet.version.${f}`) }}
          </button>
        </div>
      </div>
      <fieldset class="field druckdatei-gruppe">
        <legend>{{ t('booklet.parts') }}</legend>
        <template v-for="teil in TEILE" :key="teil">
          <label v-if="(teil !== 'pokal' || pokalMoeglich) && (teil !== 'parallel' || parallel) && (teil !== 'einzel' || einzelMoeglich)" class="boat-check">
            <input type="checkbox" :data-teil="teil" :checked="teilAn(teil)" @change="wahl.teile[teil] = ($event.target as HTMLInputElement).checked" />
            {{ t(`booklet.part.${teil}`) }}
          </label>
        </template>
      </fieldset>
      <template v-if="teilAn('ergebnis') || (parallel && teilAn('parallel')) || (einzelMoeglich && teilAn('einzel'))">
        <div v-if="teilAn('ergebnis') || (parallel && teilAn('parallel'))" class="field">
          <label for="druckdatei-umfang">{{ t('results.scope') }}</label>
          <select id="druckdatei-umfang" class="input" data-feld="druckdatei-umfang" :value="wahl.umfang" @change="wahl.umfang = ($event.target as HTMLSelectElement).value === 'gesamt' ? 'gesamt' : 'alles'">
            <option value="alles">{{ t('results.scope.alles') }}</option>
            <option value="gesamt">{{ t('results.scope.gesamt') }}</option>
          </select>
        </div>
        <!-- Nur eine Ansicht: nach Attempt oder nach Racecourse geteilt, mit denselben Werten. -->
        <div v-if="parallel && teilAn('parallel')" class="field">
          <label for="druckdatei-ansicht">{{ t('booklet.view') }}</label>
          <select id="druckdatei-ansicht" class="input" data-feld="druckdatei-ansicht" :value="ansicht" @change="wahl.ansicht = ($event.target as HTMLSelectElement).value === 'racecourse' ? 'racecourse' : 'attempt'">
            <option v-for="a in RUNDEN_ANSICHTEN" :key="a" :value="a">{{ t(`parallel.results.view.${a}`) }}</option>
          </select>
        </div>
        <!-- Parallelslalom: Gesamtergebnis und Runden einzeln – etwa nur das Halbfinale zum Aushang. -->
        <fieldset v-if="parallel && teilAn('parallel') && rundenWahl.length > 0" class="field druckdatei-gruppe">
          <legend>{{ t('booklet.rounds') }}</legend>
          <label v-for="r in rundenWahl" :key="r.id" class="boat-check">
            <input type="checkbox" :data-runde="r.id" :checked="rundenAn(r.id)" @change="setzeRunde(r.id, ($event.target as HTMLInputElement).checked)" />
            {{ r.name }}
          </label>
        </fieldset>
        <fieldset v-if="klassen.length > 0" class="field druckdatei-gruppe">
          <legend>{{ t('booklet.classes') }}</legend>
          <label v-for="k in klassen" :key="k" class="boat-check">
            <input type="checkbox" :data-klasse="k" :checked="!wahl.ohneKlassen.includes(k)" @change="setzeKlasse(k, ($event.target as HTMLInputElement).checked)" />
            {{ classLabel(k) }}
          </label>
        </fieldset>
      </template>
      <p class="note ergebnis-zahl" role="status" data-hinweis="druckdatei-zahl">
        {{ fertig ? tn('results.count', folge.length) : t('booklet.building', { done: gebaut, total: folge.length }) }}
      </p>
    </div>
    <p class="note">
      {{ t(`booklet.versionNote.${wahl.fassung}`) }} <a :href="adresse('einstellungen', { ziel: 'ergebnislisten' })">{{ t('nav.einstellungen') }}</a
      >.
    </p>
    <!-- Drucken bleibt möglich: Auch ein Zwischenstand wird verschickt – aber niemand soll ihn für das Ende halten. -->
    <p v-if="offen.length > 0" class="boat-banner warn" data-hinweis="druckdatei-unfertig" role="status">
      {{ t('booklet.unfinished', { classes: offen.join('; ') }) }}
    </p>
    <p v-if="starterGesperrt && teilAn('starter')" class="boat-banner warn" data-hinweis="druckdatei-ohne-starterliste" role="status">
      {{ t('booklet.noStarterList') }} <a :href="adresse('starter')">{{ t('nav.starter') }}</a
      >.
    </p>
    <p v-if="teilAn('ergebnis') && ergebnisse.length === 0 && rundenListen.length === 0" class="note" data-hinweis="druckdatei-ohne-ergebnis">
      {{ t('results.empty') }} <a :href="adresse('erfassung')">{{ t('nav.erfassung') }}</a
      >.
    </p>
    <EingabenHinweis />
  </div>

  <div v-if="folge.length === 0" class="panel empty no-print" data-hinweis="druckdatei-leer">{{ t('booklet.nothing') }}</div>

  <!-- Die Teile in der Reihenfolge der Vorlage. Jeder beginnt im Druck auf einem neuen Blatt (styles/print.css). -->
  <div class="druckdatei" :data-fassung="wahl.fassung" :data-fertig="fertig ? '' : undefined">
    <template v-for="a in abschnitte" :key="a.key">
      <div v-if="a.teil === 'starter'" class="druckdatei-teil" data-teil="starter">
        <StarterBlaetter :dokumente="starterVon(a.ids)" liste="starter" :namen="namen" :geburtsdatum="geburtsdatum" :herkunft="herkunftArt" />
      </div>
      <div v-else-if="a.teil === 'pokal'" class="druckdatei-teil" data-teil="pokal">
        <PokalStapel :pokal="pokal" :fassung="fassung" :herkunft="pokalHerkunft" :nur="a.ids as PokalVariante[]" />
      </div>
      <div v-else-if="a.teil === 'einzel'" class="druckdatei-teil" data-teil="einzel">
        <EinzelwertungStapel :blaetter="einzelVon(a.ids)" :fassung="fassung" />
      </div>
      <div v-else-if="a.teil === 'codes'" :ref="merkeCodesTeil" class="druckdatei-teil" data-teil="codes">
        <CodesAushang v-bind="druckseite" />
        <LeereRueckseite v-if="codesLeer" />
      </div>
      <div v-else-if="a.teil === 'ergebnis'" class="druckdatei-teil" data-teil="ergebnis">
        <ErgebnisStapel :blaetter="listenVon(a.ids)" :fassung="fassung" />
      </div>
      <!-- Regel 960: vor den Wertungslisten einer Runde ihre Startliste mit den Blöcken. -->
      <div v-else-if="a.teil === 'startliste'" class="druckdatei-teil" data-teil="startliste" :data-runde="a.gruppe">
        <ParallelStartlisten :runden="a.ids as ParallelRunde[]" :namen="namen" :herkunft="herkunftArt" />
      </div>
      <div v-else class="druckdatei-teil" data-teil="parallel" :data-runde="a.gruppe">
        <ParallelErgebnisStapel :blaetter="rundenVon(a.ids)" :fassung="fassung" :ansicht="ansicht" />
      </div>
    </template>
  </div>
</template>
