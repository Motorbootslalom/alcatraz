<script setup lang="ts">
import { computed, ref } from 'vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import { CLASSES } from '../domain/classes'
import { duplicateStartNrIds, sortedByStartNr } from '../domain/startnumbers'
import { sollgewichtOf } from '../config/catalog'
import { gewichtsGruppen } from '../domain/gewicht'
import { fileStamp } from '../persistenz/backup'
import { planEvent } from '../planung/plan'
import { originLabelKey, originText } from '../lib/origin'
import { t, tn } from '../i18n'
import { useListenSprache } from '../lib/listensprache'
import type { Starter } from '../types'
import WkrListen from '../components/WkrListen.vue'
import ErgebnisListen from '../components/ErgebnisListen.vue'
import LaufzettelListen from '../components/LaufzettelListen.vue'
import CodesAushang from '../components/CodesAushang.vue'

/**
 * Druckbare Listen. Gedruckt wird über den Browser (auch „Als PDF speichern“);
 * die Bildschirmansicht ist die Druckansicht.
 */
// Die verzahnte Startliste ist die übliche; „nach Klasse“ braucht man fast nie – sie steht deshalb hinten.
// Davor in der Reihenfolge, in der man sie am Wettkampftag braucht: Die Laufzettel und der
// Aushang der Fehler- und Disqualifikations-Codes gehören zu den Bögen der Wettkampfrichter.
const KINDS = ['interleaved', 'gewicht', 'vorsteg', 'wkr', 'laufzettel', 'codes', 'ergebnis', 'byClass'] as const
type Kind = (typeof KINDS)[number]

const { state } = useStore()
const kind = merke<Kind>('listen.art', 'interleaved')
// Was auf den Blättern steht, folgt der Listensprache (`lt`, lib/listensprache.ts); die
// Bedienung und der Fenstertitel der Sprache der Oberfläche (`t`).
const { t: lt, formatDate, formatDateTime } = useListenSprache()

// Listen entstehen erst, wenn jede Startnummer gesetzt und eindeutig ist.
const missing = computed(() => state.value.starters.filter((p) => p.startNr.trim() === '').length)
const duplicate = computed(() => duplicateStartNrIds(state.value.starters, state.value.startNrMode).size)
// Gewichtslisten entstehen beim Check-in, oft bevor es Startnummern gibt – sie brauchen keine.
const weightList = computed(() => kind.value === 'gewicht')
// Der Aushang der Codes hängt nur am Regelwerk – er lässt sich drucken, bevor es Starter gibt.
const codeList = computed(() => kind.value === 'codes')
// Ergebnislisten rechnen über die Starter-ID; eine fehlende Nummer hält den Aushang nicht auf.
const blocked = computed(() => !weightList.value && !codeList.value && kind.value !== 'ergebnis' && (missing.value > 0 || duplicate.value > 0))
const showOrigin = computed(() => state.value.originMode !== 'none' && kind.value !== 'gewicht')
// Geburtsdatum nur, wenn die Veranstaltung es zeigt; auf der Vorsteg-Liste steht es nie.
// Auf der Gewichtsliste steht das Geburtsdatum immer – es wird beim Check-in abgeglichen.
const showBirthdate = computed(() => weightList.value || (state.value.showBirthdate && kind.value !== 'vorsteg'))
const weightText = (p: Starter) => (p.gewicht === undefined ? '' : String(p.gewicht).replace('.', ','))
const origin = (p: Starter) => originText(p, state.value.originMode, state.value.listOrigin, state.value.originShort)
const columns = computed(
  () =>
    4 +
    (showOrigin.value ? 1 : 0) +
    (showBirthdate.value ? 1 : 0) +
    (kind.value === 'vorsteg' ? state.value.laufCount : 0) +
    (weightList.value ? 1 : 0),
)
const runs = computed(() => Array.from({ length: state.value.laufCount }, (_, i) => i + 1))

interface Section {
  id: string
  /** Name der Liste im Kopf links, z. B. „Starter Gesamt“. */
  title: string
  /**
   * Zeilenblöcke, die im Druck möglichst nicht über einen Seitenwechsel
   * getrennt werden: bei der Liste nach Klasse je Klasse einer, sonst ein
   * einziger (die verzahnte Folge hat keine sinnvolle Trennstelle).
   */
  groups: Starter[][]
}

// Wettkampfrichter-Listen zeichnet eine eigene Ansicht (components/WkrListen.vue); sie
// meldet, wie viele Bögen die Auswahl zeigt und wie die Auswahl heißt.
const wkrList = computed(() => kind.value === 'wkr')
const wkrStand = ref({ anzahl: 0, auswahl: '' })
// Ergebnislisten ebenso (components/ErgebnisListen.vue).
const resultList = computed(() => kind.value === 'ergebnis')
const resultStand = ref({ anzahl: 0, auswahl: '' })
// Und die Laufzettel (components/LaufzettelListen.vue).
const runSheets = computed(() => kind.value === 'laufzettel')
const runSheetStand = ref({ anzahl: 0, auswahl: '' })
const ownView = computed(() => wkrList.value || resultList.value || runSheets.value)
const ownStand = computed(() => (wkrList.value ? wkrStand.value : resultList.value ? resultStand.value : runSheetStand.value))
const nothingToPrint = computed(() => !codeList.value && (ownView.value ? ownStand.value.anzahl === 0 : sections.value.length === 0))

const sections = computed<Section[]>(() => {
  const k = kind.value
  if (k === 'wkr' || k === 'ergebnis' || k === 'laufzettel' || k === 'codes') return []
  if (weightList.value) {
    // Je Herkunft ein eigenes Blatt für die Mannschaftsleitung.
    return gewichtsGruppen(state.value.starters, state.value.originMode).map((g) => ({
      id: `gewicht:${g.origin}`,
      title: lt('lists.title.gewicht') + (g.origin ? `\n${g.origin}` : ''),
      groups: [g.starters],
    }))
  }
  if (k === 'byClass') {
    const groups = CLASSES.map((c) => sortedByStartNr(state.value.starters.filter((p) => p.klasse === c.id))).filter(
      (g) => g.length > 0,
    )
    return groups.length > 0 ? [{ id: 'all', title: lt('lists.title.byClass'), groups }] : []
  }
  // Je Parcours eine eigene Liste auf eigenem Blatt – sie hängt an einem anderen Steg.
  const plans = new Map(planEvent(state.value).plans.map((p) => [p.parcoursId, p]))
  const several = state.value.parcoursList.length > 1
  return state.value.parcoursList
    .map((p) => ({
      id: p.id,
      title: lt(`lists.title.${k}`) + (several ? `\n${p.name}` : ''),
      groups: [plans.get(p.id)?.sequence ?? []],
    }))
    .filter((s) => s.groups[0].length > 0)
})

/** Jede fünfte Zeile ist grau hinterlegt – durchgezählt über alle Blöcke und Blätter der Liste. */
const rows = computed(() => {
  let n = 0
  return sections.value.map((s) => {
    // Gewichtslisten sind einzelne Blätter je Herkunft; dort beginnt die Zählung neu.
    if (weightList.value) n = 0
    return s.groups.map((g) => g.map((p) => ({ p, shade: ++n % 5 === 0 })))
  })
})

/** Lange Namen werden wie in den bisherigen Ausdrucken kleiner gesetzt statt umbrochen. */
const fit = (text: string, normal: number) =>
  text.length > normal * 1.35 ? 'fit-2' : text.length > normal ? 'fit-1' : ''

const heading = computed(() => [state.value.eventName, state.value.eventJahr].filter(Boolean).join(' '))

// Zeitpunkt des Aufrufs – steht auf dem Ausdruck, damit alte Listen auffallen.
const openedAt = new Date().toISOString()
const stand = computed(() => formatDateTime(openedAt))

/**
 * Seitenzahl und Zeitpunkt im Seitenrand des Ausdrucks. Als eigenes
 * Stylesheet, weil der Text von Sprache und Uhrzeit abhängt.
 */
const cssString = (text: string) => `"${text.replace(/["\\]/g, '\\$&')}"`
const pageCss = computed(() => {
  const [before, after] = lt('lists.page', { page: '\u0001', pages: '\u0002' }).split('\u0001')
  const [between, end] = after.split('\u0002')
  const page = `${cssString(before)} counter(page) ${cssString(between)} counter(pages) ${cssString(end)}`
  // Die Bögen der Wettkampfrichter haben nur 8 mm Rand (benannte Seiten in bogen.css): dort
  // kleiner und oben im Rand, damit auch ein Drucker mit breitem Greifrand es noch druckt.
  const boxen = (font: string, extra = '') =>
    `@bottom-center { content: ${page}; font: ${font} Arial, sans-serif; ${extra} } @bottom-right { content: ${cssString(stand.value)}; font: ${font} Arial, sans-serif; ${extra} }`
  // Laufzettel werden gefaltet und abgehakt: Seitenzahl und Zeitpunkt stünden nur im Weg.
  if (runSheets.value) return ''
  if (wkrList.value) return `@page bogen-hoch { ${boxen('7pt', 'vertical-align: top;')} } @page bogen-quer { ${boxen('7pt', 'vertical-align: top;')} }`
  // Ergebnislisten: Querformat mit schmalem Rand (benannte Seite in ergebnis.css).
  return resultList.value ? `@page ergebnis { ${boxen('8pt')} }` : `@page { ${boxen('10pt')} }`
})

/**
 * Drucken. Der Browser schlägt den Fenstertitel als Dateinamen für „Als PDF
 * speichern“ vor – deshalb trägt das Fenster währenddessen den Namen der Liste
 * (in der Sprache der Oberfläche), die Veranstaltung und den Zeitpunkt.
 */
function print() {
  const before = document.title
  const auswahl = ownView.value ? ownStand.value.auswahl : ''
  document.title = [t(`lists.kind.${kind.value}`), auswahl, heading.value, fileStamp(new Date())].filter(Boolean).join(' - ')
  window.addEventListener('afterprint', () => (document.title = before), { once: true })
  window.print()
}
</script>

<template>
  <div class="panel no-print">
    <h2>{{ t('lists.title') }}</h2>
    <p class="hint">{{ t('lists.hint') }}</p>
    <div class="row" style="align-items: center">
      <div class="segmented list-kinds">
        <button v-for="k in KINDS" :key="k" type="button" :data-kind="k" :class="kind === k ? 'active' : ''" @click="kind = k">
          {{ t(`lists.kind.${k}`) }}
        </button>
      </div>
      <span style="flex: 1" />
      <button class="btn primary" :disabled="nothingToPrint || blocked" @click="print">{{ t('common.print') }}</button>
    </div>
  </div>

  <p v-if="blocked" class="boat-banner warn no-print" role="alert" style="margin-bottom: 16px">
    <template v-if="missing > 0">{{ tn('lists.missingNumbers', missing) }} </template>
    <template v-if="duplicate > 0">{{ tn('lists.duplicateNumbers', duplicate) }} </template>
    {{ t('lists.fixNumbers') }}
  </p>

  <template v-if="codeList">
    <component :is="'style'">{{ pageCss }}</component>
    <CodesAushang />
  </template>

  <div v-else-if="ownView ? state.starters.length === 0 : sections.length === 0" class="panel empty no-print">{{ t('lists.empty') }}</div>

  <template v-else-if="wkrList">
    <component :is="'style'">{{ pageCss }}</component>
    <WkrListen :gesperrt="blocked" @stand="wkrStand = $event" />
  </template>

  <template v-else-if="runSheets">
    <LaufzettelListen :gesperrt="blocked" @stand="runSheetStand = $event" />
  </template>

  <template v-else-if="resultList">
    <component :is="'style'">{{ pageCss }}</component>
    <ErgebnisListen @stand="resultStand = $event" />
  </template>

  <div v-else :class="['sheet', weightList ? 'weights' : '']">
    <component :is="'style'">{{ pageCss }}</component>
    <section v-for="(s, si) in sections" :key="s.id" class="sheet-section">
      <table class="sheet-table">
        <thead>
          <tr class="sheet-title">
            <th :colspan="columns">
              <div class="sheet-title-box">
                <span class="list">{{ s.title }}</span>
                <span class="event">{{ heading }}</span>
              </div>
            </th>
          </tr>
          <tr class="sheet-cols">
            <th v-if="weightList" class="narrow">{{ lt('lists.class') }}</th>
            <th v-else class="narrow">{{ lt('common.startNr') }}</th>
            <th>{{ lt('common.lastName') }}</th>
            <th>{{ lt('common.firstName') }}</th>
            <th v-if="showOrigin">{{ lt(originLabelKey(state.originMode)) }}</th>
            <th v-if="showBirthdate" class="narrow">{{ lt('common.birthdate') }}</th>
            <template v-if="kind === 'vorsteg'">
              <th v-for="r in runs" :key="r" class="check">{{ lt('lists.run', { n: r }) }}</th>
            </template>
            <template v-if="weightList">
              <th class="weight">{{ lt('lists.standardWeight') }}</th>
              <th class="weight">{{ lt('lists.weight') }}</th>
            </template>
            <th v-else class="narrow">{{ lt('lists.class') }}</th>
          </tr>
        </thead>
        <tbody v-for="(group, gi) in rows[si]" :key="gi">
          <tr v-for="{ p, shade } in group" :key="p.id" :class="shade ? 'shade' : ''">
            <td v-if="weightList" class="narrow">{{ p.klasse }}</td>
            <td v-else class="narrow">{{ p.startNr }}</td>
            <td :class="fit(p.nachname, 18)">{{ p.nachname }}</td>
            <td :class="fit(p.vorname, 18)">{{ p.vorname }}</td>
            <td v-if="showOrigin" :class="fit(origin(p), 32)">{{ origin(p) }}</td>
            <td v-if="showBirthdate" class="narrow">{{ p.geburtsdatum ? formatDate(p.geburtsdatum) : '' }}</td>
            <template v-if="kind === 'vorsteg'">
              <td v-for="r in runs" :key="r" class="check" />
            </template>
            <template v-if="weightList">
              <td class="weight">{{ sollgewichtOf(state.regelwerk, state.sollgewicht, p.klasse) }} kg</td>
              <td class="weight">{{ weightText(p) }}</td>
            </template>
            <td v-else class="narrow">{{ p.klasse }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
