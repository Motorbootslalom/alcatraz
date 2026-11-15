<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, watchEffect } from 'vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { useEvent } from '../lib/event'
import { klassenErgebnis } from '../lib/ergebnis'
import type { PokalVariante } from '../config/pokal'
import { ergebnisBlaetter } from '../lib/ergebnisBlaetter'
import { pokalWahl, usePokalWertung } from '../lib/pokalBlaetter'
import { druckdateiFolge, druckdateiVorgabe, istDruckdateiWahl, type DruckdateiFassung, type DruckdateiTeil, type DruckdateiWahl } from '../lib/druckdatei'
import { starterDokumente } from '../lib/starterlisten'
import { namenDerFassung } from '../lib/namen'
import { istOriginStyle } from '../lib/origin'
import { useListenSprache } from '../lib/listensprache'
import { t, tn } from '../i18n'
import { adresse } from '../lib/router'
import type { ClassId, ErgebnisFassung, OriginStyle } from '../types'
import StarterBlaetter from './StarterBlaetter.vue'
import PokalStapel from './PokalStapel.vue'
import CodesAushang from './CodesAushang.vue'
import ErgebnisStapel from './ErgebnisStapel.vue'
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
 * Zwei Fassungen, mit denselben Einstellungen wie die Ergebnislisten: „Extern“ ist der Aushang
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
const { classes, classLabel } = useEvent()
const { t: lt } = useListenSprache()

const FASSUNGEN: DruckdateiFassung[] = ['extern', 'intern']
const TEILE: DruckdateiTeil[] = ['starter', 'pokal', 'codes', 'ergebnis']
const wahl = merke<DruckdateiWahl>('listen.druckdatei', druckdateiVorgabe, { ueberNeuladen: true, gueltig: istDruckdateiWahl })
/** „Extern“ ist die Fassung „Aushang“ der Ergebnislisten – dieselben Einstellungen, ein anderes Wort für eine Datei, die verschickt wird. */
const fassung = computed<ErgebnisFassung>(() => (wahl.value.fassung === 'intern' ? 'intern' : 'aushang'))

// ---- Starterliste: die verzahnte, je Parcours – so steht sie in der Vorlage vorn.
const starter = computed(() =>
  props.starterGesperrt
    ? []
    : starterDokumente(state.value, { liste: 'starter', art: 'verzahnt' }, { starter: lt('lists.title.starter'), vorsteg: lt('lists.title.vorsteg'), gewicht: lt('lists.title.gewicht'), klasse: lt('lists.title.klasse') }),
)
// Auf der Starterliste gilt dieselbe Regel wie auf den Ergebnislisten der Fassung: Was dort
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

// ---- Ergebnislisten: Klassen in der Reihenfolge des Regelwerks (E, 1 … 7) wie in der Vorlage,
// nach Platz. Die Startfolge der Verzahnung, nach der der Reiter „Ergebnislisten“ ordnet, sagt
// dem Empfänger nichts.
const ergebnisse = computed(() => classes.value.flatMap((c) => klassenErgebnis(state.value, konfig.value, c.id) ?? []))
const klassen = computed(() => ergebnisse.value.map((e) => e.klasse))
const gewaehlt = computed(() => klassen.value.filter((k) => !wahl.value.ohneKlassen.includes(k)))
const listen = computed(() => ergebnisBlaetter(ergebnisse.value, { klassen: gewaehlt.value, umfang: wahl.value.umfang, ordnungLauf: 'platz', ordnungGesamt: 'platz' }))

/** Die Dokumente in Druckreihenfolge (lib/druckdatei.ts) – daran hängen Zahl, Aufbau in Schritten und Reihenfolge. */
const folge = computed(() =>
  druckdateiFolge(wahl.value, {
    starter: starter.value.map((s) => s.id),
    pokal: pokalMoeglich.value ? pokal.blaetter : [],
    ergebnis: listen.value.map((b) => b.key),
  }),
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
/** Was von einem Teil schon aufgebaut ist. */
const sichtbar = (teil: DruckdateiTeil) =>
  folge.value
    .slice(0, gebaut.value)
    .filter((d) => d.teil === teil)
    .map((d) => d.id)
const starterSichtbar = computed(() => starter.value.slice(0, sichtbar('starter').length))
const pokalSichtbar = computed(() => sichtbar('pokal') as PokalVariante[])
const codesSichtbar = computed(() => sichtbar('codes').length > 0)
const listenSichtbar = computed(() => listen.value.slice(0, sichtbar('ergebnis').length))

// ---- Unfertiger Stand: welche Klassen noch kein Endergebnis haben und welche Läufe ihnen fehlen.
// Klassen, denen dieselben Läufe fehlen, stehen zusammen – mitten im Wettkampf sind das meist alle.
const offen = computed(() => {
  const gruppen = new Map<string, { fehlen: number[]; klassen: string[] }>()
  for (const k of pokal.klassen.filter((x) => !x.fertig)) {
    const fehlen = Array.from({ length: Math.max(1, state.value.laufCount) }, (_, i) => i + 1).filter((n) => !k.laeufe.includes(n))
    const schluessel = fehlen.join(',')
    if (!gruppen.has(schluessel)) gruppen.set(schluessel, { fehlen, klassen: [] })
    gruppen.get(schluessel)!.klassen.push(classLabel(k.klasse))
  }
  return [...gruppen.values()].map((g) => (g.fehlen.length > 0 ? tn('booklet.missingRuns', g.fehlen.length, { class: g.klassen.join(', '), runs: g.fehlen.join(', ') }) : g.klassen.join(', ')))
})

/** Die Auswahl in Worten, für Fenstertitel und Dateiname – in der Sprache der Oberfläche. */
watchEffect(() => emit('stand', { anzahl: fertig.value ? folge.value.length : 0, auswahl: t(`booklet.version.${wahl.value.fassung}`) }))

const teilAn = (teil: DruckdateiTeil) => wahl.value.teile[teil]
function setzeKlasse(k: ClassId, an: boolean) {
  wahl.value.ohneKlassen = an ? wahl.value.ohneKlassen.filter((x) => x !== k) : [...wahl.value.ohneKlassen, k]
}
</script>

<template>
  <div class="panel no-print druckdatei-wahl">
    <p class="hint">{{ t('booklet.hint') }}</p>
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
          <label v-if="teil !== 'pokal' || pokalMoeglich" class="boat-check">
            <input type="checkbox" :data-teil="teil" :checked="teilAn(teil)" @change="wahl.teile[teil] = ($event.target as HTMLInputElement).checked" />
            {{ t(`booklet.part.${teil}`) }}
          </label>
        </template>
      </fieldset>
      <template v-if="teilAn('ergebnis')">
        <div class="field">
          <label for="druckdatei-umfang">{{ t('results.scope') }}</label>
          <select id="druckdatei-umfang" class="input" data-feld="druckdatei-umfang" :value="wahl.umfang" @change="wahl.umfang = ($event.target as HTMLSelectElement).value === 'gesamt' ? 'gesamt' : 'alles'">
            <option value="alles">{{ t('results.scope.alles') }}</option>
            <option value="gesamt">{{ t('results.scope.gesamt') }}</option>
          </select>
        </div>
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
    <p v-if="teilAn('ergebnis') && ergebnisse.length === 0" class="note" data-hinweis="druckdatei-ohne-ergebnis">
      {{ t('results.empty') }} <a :href="adresse('erfassung')">{{ t('nav.erfassung') }}</a
      >.
    </p>
    <EingabenHinweis />
  </div>

  <div v-if="folge.length === 0" class="panel empty no-print" data-hinweis="druckdatei-leer">{{ t('booklet.nothing') }}</div>

  <!-- Die Teile in der Reihenfolge der Vorlage. Jeder beginnt im Druck auf einem neuen Blatt (styles/print.css). -->
  <div class="druckdatei" :data-fassung="wahl.fassung" :data-fertig="fertig ? '' : undefined">
    <div v-if="starterSichtbar.length > 0" class="druckdatei-teil" data-teil="starter">
      <StarterBlaetter :dokumente="starterSichtbar" liste="starter" :namen="namen" :geburtsdatum="geburtsdatum" :herkunft="herkunftArt" />
    </div>
    <div v-if="pokalSichtbar.length > 0" class="druckdatei-teil" data-teil="pokal">
      <PokalStapel :pokal="pokal" :fassung="fassung" :herkunft="pokalHerkunft" :nur="pokalSichtbar" />
    </div>
    <div v-if="codesSichtbar" class="druckdatei-teil" data-teil="codes">
      <CodesAushang />
    </div>
    <div v-if="listenSichtbar.length > 0" class="druckdatei-teil" data-teil="ergebnis">
      <ErgebnisStapel :blaetter="listenSichtbar" :fassung="fassung" />
    </div>
  </div>
</template>
