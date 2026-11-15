<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { merke } from '../lib/merken'
import { useReiter } from '../lib/router'
import type { ReiterNamen } from '../lib/adressen'
import { useStore } from '../state/store'
import { duplicateStartNrIds } from '../domain/startnumbers'
import { fileStamp } from '../persistenz/backup'
import { originLabelKey } from '../lib/origin'
import { t, tn } from '../i18n'
import { useListenSprache } from '../lib/listensprache'
import WkrListen from '../components/WkrListen.vue'
import ErgebnisListen from '../components/ErgebnisListen.vue'
import PokalListen from '../components/PokalListen.vue'
import LaufzettelListen from '../components/LaufzettelListen.vue'
import CodesAushang from '../components/CodesAushang.vue'
import StarterBlaetter from '../components/StarterBlaetter.vue'
import DruckdateiListen from '../components/DruckdateiListen.vue'
import AusgleichListen from '../components/AusgleichListen.vue'
import { ausgleichListen } from '../lib/ausgleich'
import { useEvent } from '../lib/event'
import type { ClassId } from '../types'
import { adresse } from '../lib/router'
import { ALLE, herkuenfte, istStarterArt, istStarterWahl, ohneHerkunft, STARTER_ARTEN, STARTER_WAHL, starterDokumente, type StarterArt, type StarterDokument, type StarterWahl } from '../lib/starterlisten'

/**
 * Druckbare Listen. Gedruckt wird über den Browser (auch „Als PDF speichern“);
 * die Bildschirmansicht ist die Druckansicht.
 */
// Die Starterlisten stehen vorn: ein Reiter, darunter die Auswahl „Art“ (verzahnt, je Herkunft
// nach Startnummer, nach Klasse – lib/starterlisten.ts). Danach in der Reihenfolge, in der man
// die Listen am Wettkampftag braucht: Die Laufzettel und der Aushang der Fehler- und
// Disqualifikations-Codes gehören zu den Bögen der Wettkampfrichter; die Mannschaftswertung
// (im Code „pokal“) entsteht aus den Ergebnislisten und steht hinter ihnen. Zuletzt die
// Druckdatei: alles zusammen in einer Datei, die nach dem Wettkampf an die Gruppen geht.
const KINDS = ['starter', 'gewicht', 'vorsteg', 'wkr', 'laufzettel', 'codes', 'ergebnis', 'pokal', 'druckdatei'] as const satisfies readonly ReiterNamen['listen'][]
type Kind = (typeof KINDS)[number]

const { state } = useStore()
// Eine gemerkte Listenart, die es nicht mehr gibt (die früheren zwei Starter-Reiter), gilt als die Vorgabe.
const kind = merke<Kind>('listen.art', 'starter', { gueltig: (x) => (KINDS as readonly unknown[]).includes(x) })
// Was im Reiter „Starterlisten“ gewählt ist, bleibt über Ansichtswechsel und Neuladen stehen.
const starterWahl = merke<StarterWahl>('listen.starter', () => ({ ...STARTER_WAHL }), { ueberNeuladen: true, gueltig: istStarterWahl })
// Die Listenart steht auch in der Adresse: Nach einem Neuladen ist man wieder bei derselben Liste.
// Die Adressen der früheren Reiter (`#/listen/verzahnt`, `#/listen/nach-klasse`) führen hierher
// und wählen die passende Art.
useReiter('listen', kind, KINDS, (art) => {
  if (istStarterArt(art)) starterWahl.value.art = art
})
const id = useId()
const { classes, classLabel } = useEvent()

// Gewichtslisten gibt es in zwei Arten: je Herkunft zum Eintragen beim Check-in (quer, ohne
// Startnummern) und „Ausgleichsgewichte“ für den Steg (hoch, je Klasse ein Blatt nach
// Startnummer – lib/ausgleich.ts). Die Wahl bleibt über Ansichtswechsel und Neuladen stehen.
const GEWICHT_ARTEN = ['herkunft', 'steg'] as const
type GewichtArt = (typeof GEWICHT_ARTEN)[number]
const gewichtWahl = merke<{ art: GewichtArt; klasse: string }>('listen.gewicht', () => ({ art: 'herkunft', klasse: ALLE }), {
  ueberNeuladen: true,
  gueltig: (x) => !!x && typeof x === 'object' && (GEWICHT_ARTEN as readonly unknown[]).includes((x as { art?: unknown }).art) && typeof (x as { klasse?: unknown }).klasse === 'string',
})
/** Die Liste für den Steg ist gewählt. */
const stegList = computed(() => kind.value === 'gewicht' && gewichtWahl.value.art === 'steg')
/** Klassen mit Startern – nur für sie gibt es ein Blatt. */
const stegKlassen = computed(() => classes.value.filter((c) => state.value.starters.some((p) => p.klasse === c.id)))
/** Die gewählte Klasse – eine, die es nicht mehr gibt, zählt wie „alle“. */
const stegKlasse = computed(() => (stegKlassen.value.some((c) => c.id === gewichtWahl.value.klasse) ? (gewichtWahl.value.klasse as ClassId) : ALLE))
const stegListen = computed(() => (stegList.value ? ausgleichListen(state.value, stegKlasse.value === ALLE ? undefined : [stegKlasse.value as ClassId]) : []))
const stegUngewogen = computed(() => stegListen.value.reduce((n, l) => n + l.ungewogen, 0))
// Was auf den Blättern steht, folgt der Listensprache (`lt`, lib/listensprache.ts); die
// Bedienung und der Fenstertitel der Sprache der Oberfläche (`t`).
const { t: lt } = useListenSprache()

const ohneHerkunftsArt = computed(() => state.value.originMode === 'none')
/** Die Herkünfte des Starterfelds – gleichbedeutende Schreibweisen zusammengefasst wie in der Mannschaftswertung. */
const alleHerkuenfte = computed(() => herkuenfte(state.value.starters, state.value.originMode))
const starterOhneHerkunft = computed(() => ohneHerkunft(state.value.starters, state.value.originMode).length)
/** Die Art, die gilt: Ohne Herkunft gibt es keine Liste je Herkunft – dann bleibt die Wahl stehen, gezeigt wird die verzahnte. */
const starterArt = computed<StarterArt>(() => (starterWahl.value.art === 'herkunft' && ohneHerkunftsArt.value ? 'verzahnt' : starterWahl.value.art))
/** Verzahnt: die Markierung, die gilt – '' = keine. Eine Herkunft, die es nicht mehr gibt, zählt wie „ohne Markierung“. */
const markierung = computed(() => {
  const m = starterWahl.value.markierung
  return ohneHerkunftsArt.value || m === '' ? '' : m === ALLE || alleHerkuenfte.value.some((h) => h.schluessel === m) ? m : ''
})
/** Je Herkunft: die gewählte – eine, die es nicht mehr gibt, zählt wie „alle“. */
const herkunftsWahl = computed(() => (alleHerkuenfte.value.some((h) => h.schluessel === starterWahl.value.herkunft) ? starterWahl.value.herkunft : ALLE))

// Die Listen mit einer Zeile je Starter (Starterlisten, Vorsteg, Gewichtsliste zum Eintragen)
// zeichnet components/StarterBlaetter.vue; was auf ihnen steht, legt lib/starterlisten.ts fest.
// Die Ausgleichsgewichte für den Steg zeichnet eine eigene Ansicht (components/AusgleichListen.vue).

// Listen entstehen erst, wenn jede Startnummer gesetzt und eindeutig ist.
const missing = computed(() => state.value.starters.filter((p) => p.startNr.trim() === '').length)
const duplicate = computed(() => duplicateStartNrIds(state.value.starters, state.value.startNrMode).size)
// Gewichtslisten entstehen beim Check-in, oft bevor es Startnummern gibt – sie brauchen keine.
// Die Liste für den Steg dagegen ist nach Startnummer geordnet und braucht sie wie die übrigen.
const weightList = computed(() => kind.value === 'gewicht' && !stegList.value)
// Der Aushang der Codes hängt nur am Regelwerk – er lässt sich drucken, bevor es Starter gibt.
const codeList = computed(() => kind.value === 'codes')
// Ergebnislisten und Mannschaftswertung rechnen über die Starter-ID; eine fehlende Nummer hält den Aushang nicht auf.
// Die Druckdatei lässt dann nur ihre Starterliste weg und sagt das (components/DruckdateiListen.vue).
const blocked = computed(() => !weightList.value && !codeList.value && kind.value !== 'ergebnis' && kind.value !== 'pokal' && kind.value !== 'druckdatei' && (missing.value > 0 || duplicate.value > 0))

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
// Und die Pokalauswertung (components/PokalListen.vue); sie sagt auch selbst, warum es keine gibt.
const cupList = computed(() => kind.value === 'pokal')
const cupStand = ref({ anzahl: 0, auswahl: '' })
// Und die Ausgleichsgewichte für den Steg (components/AusgleichListen.vue); ihre Auswahl steht hier.
const stegStand = computed(() => ({ anzahl: stegListen.value.length, auswahl: [t('lists.title.ausgleich'), stegKlasse.value === ALLE ? '' : classLabel(stegKlasse.value as ClassId)].filter(Boolean).join(' ') }))
// Und die Druckdatei (components/DruckdateiListen.vue): Starterliste, Mannschaftswertungen, Codes und Ergebnislisten in einem Druck.
const bookletList = computed(() => kind.value === 'druckdatei')
const bookletStand = ref({ anzahl: 0, auswahl: '' })
const ownView = computed(() => wkrList.value || resultList.value || runSheets.value || cupList.value || stegList.value || bookletList.value)
const ownStand = computed(() =>
  stegList.value ? stegStand.value : wkrList.value ? wkrStand.value : resultList.value ? resultStand.value : cupList.value ? cupStand.value : bookletList.value ? bookletStand.value : runSheetStand.value,
)
const nothingToPrint = computed(() => !codeList.value && (ownView.value ? ownStand.value.anzahl === 0 : sections.value.length === 0))

const sections = computed<StarterDokument[]>(() => {
  const k = kind.value
  if ((k !== 'starter' && k !== 'vorsteg' && k !== 'gewicht') || stegList.value) return []
  return starterDokumente(
    state.value,
    { liste: k, art: starterArt.value, markierung: markierung.value, herkunft: herkunftsWahl.value },
    { starter: lt('lists.title.starter'), vorsteg: lt('lists.title.vorsteg'), gewicht: lt('lists.title.gewicht'), klasse: lt('lists.title.klasse') },
  )
})

/** Die Auswahl im Reiter „Starterlisten“ in Worten – für Fenstertitel und Dateiname, in der Sprache der Oberfläche. */
const starterAuswahl = computed(() => {
  const herkunftTitel = t(originLabelKey(state.value.originMode))
  const name = (wahl: string) => (wahl === ALLE ? '' : (alleHerkuenfte.value.find((h) => h.schluessel === wahl)?.name ?? ''))
  if (starterArt.value === 'klasse') return t('lists.starter.art.klasse')
  if (starterArt.value === 'herkunft') return [t('lists.starter.art.herkunft', { origin: herkunftTitel }), name(herkunftsWahl.value)].filter(Boolean).join(' ')
  return [t('lists.starter.art.verzahnt'), markierung.value === '' ? '' : name(markierung.value) || `${herkunftTitel}: ${t('lists.wkr.all')}`].filter(Boolean).join(', ')
})

const heading = computed(() => [state.value.eventName, state.value.eventJahr].filter(Boolean).join(' '))

// Im Seitenrand steht nichts, auch kein Druckzeitpunkt: Er änderte sich bei jedem Nachdruck
// und sagte nichts über die Liste. Nur die Ergebnislisten tragen eine Zeit – die ihrer letzten
// Änderung, in einem eigenen Feld unter der Tabelle (components/ergebnis/ErgebnisFuss.vue).
// Eine Seitenzahl im Rand gab es nie: Die Zähler des Browsers laufen über den ganzen Druck-
// auftrag („Seite 58 von 178“); jede Liste zählt ihre Seiten selbst (ListenDokument.vue).

/** Dokumente (nicht Seiten), die die Auswahl zeigt. */
const dokumente = computed(() => sections.value.length)

/**
 * Drucken. Der Browser schlägt den Fenstertitel als Dateinamen für „Als PDF
 * speichern“ vor – deshalb trägt das Fenster währenddessen den Namen der Liste
 * (in der Sprache der Oberfläche), die Veranstaltung und den Zeitpunkt.
 */
function print() {
  const before = document.title
  const auswahl = ownView.value ? ownStand.value.auswahl : kind.value === 'starter' ? starterAuswahl.value : ''
  // Die Druckdatei geht an alle Gruppen: Dort steht die Veranstaltung vorn – so heißt die Datei im Posteingang.
  const teile = bookletList.value ? [heading.value, t('lists.kind.druckdatei'), auswahl] : [t(`lists.kind.${kind.value}`), auswahl, heading.value]
  document.title = [...teile, fileStamp(new Date())].filter(Boolean).join(' - ')
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

  <!-- Starterlisten: die Art der Liste und – wo es eine Herkunft gibt – für wen. -->
  <div v-if="kind === 'starter'" class="panel no-print starter-wahl">
    <div class="row">
      <div class="field">
        <label>{{ t('lists.starter.art') }}</label>
        <div class="segmented starter-arten" role="group" :aria-label="t('lists.starter.art')">
          <button
            v-for="a in STARTER_ARTEN"
            :key="a"
            type="button"
            :data-art="a"
            :class="starterArt === a ? 'active' : ''"
            :aria-pressed="starterArt === a"
            :disabled="a === 'herkunft' && ohneHerkunftsArt"
            @click="starterWahl.art = a"
          >
            {{ t(`lists.starter.art.${a}`, { origin: t(originLabelKey(state.originMode)) }) }}
          </button>
        </div>
      </div>
      <div v-if="starterArt === 'verzahnt' && !ohneHerkunftsArt" class="field">
        <label :for="`${id}-markierung`">{{ t('lists.starter.for', { origin: t(originLabelKey(state.originMode)) }) }}</label>
        <select :id="`${id}-markierung`" class="input" data-feld="starter-markierung" :value="markierung" @change="starterWahl.markierung = ($event.target as HTMLSelectElement).value">
          <option value="">{{ t('lists.starter.unmarked') }}</option>
          <option v-for="h in alleHerkuenfte" :key="h.schluessel" :value="h.schluessel">{{ h.name }}</option>
          <option v-if="alleHerkuenfte.length > 0" :value="ALLE">{{ t('lists.wkr.all') }}</option>
        </select>
      </div>
      <div v-if="starterArt === 'herkunft'" class="field">
        <label :for="`${id}-herkunft`">{{ t(originLabelKey(state.originMode)) }}</label>
        <select :id="`${id}-herkunft`" class="input" data-feld="starter-herkunft" :value="herkunftsWahl" @change="starterWahl.herkunft = ($event.target as HTMLSelectElement).value">
          <option :value="ALLE">{{ t('lists.wkr.all') }}</option>
          <option v-for="h in alleHerkuenfte" :key="h.schluessel" :value="h.schluessel">{{ h.name }}</option>
        </select>
      </div>
      <p v-if="!blocked" class="note ergebnis-zahl" role="status">{{ tn('results.count', dokumente) }}</p>
    </div>
    <p class="note" data-hinweis="starter-art">{{ t(starterArt === 'verzahnt' && markierung !== '' ? 'lists.starter.hint.verzahnt.marked' : `lists.starter.hint.${starterArt}`, { origin: t(originLabelKey(state.originMode)) }) }}</p>
    <p v-if="ohneHerkunftsArt" class="note" data-hinweis="starter-ohne-herkunftsart">
      {{ t('lists.starter.noOrigin') }} <a :href="adresse('veranstaltung')">{{ t('nav.veranstaltung') }}</a
      >.
    </p>
    <p v-else-if="starterOhneHerkunft > 0 && (starterArt === 'herkunft' || markierung !== '')" class="note" data-hinweis="starter-ohne-herkunft">
      {{ tn('lists.starter.withoutOrigin', starterOhneHerkunft, { origin: t(originLabelKey(state.originMode)) }) }}
    </p>
  </div>

  <!-- Gewichtslisten: zum Eintragen beim Check-in (je Herkunft) oder die Ausgleichsgewichte für den Steg (je Klasse). -->
  <div v-if="kind === 'gewicht'" class="panel no-print gewicht-wahl">
    <div class="row">
      <div class="field">
        <label>{{ t('lists.weight.art') }}</label>
        <div class="segmented gewicht-arten" role="group" :aria-label="t('lists.weight.art')">
          <button v-for="a in GEWICHT_ARTEN" :key="a" type="button" :data-art="a" :class="gewichtWahl.art === a ? 'active' : ''" :aria-pressed="gewichtWahl.art === a" @click="gewichtWahl.art = a">
            {{ a === 'steg' ? t('lists.weight.art.steg') : ohneHerkunftsArt ? t('lists.weight.art.checkin') : t('lists.weight.art.herkunft', { origin: t(originLabelKey(state.originMode)) }) }}
          </button>
        </div>
      </div>
      <div v-if="stegList" class="field">
        <label :for="`${id}-steg-klasse`">{{ t('lists.class') }}</label>
        <select :id="`${id}-steg-klasse`" class="input" data-feld="steg-klasse" :value="stegKlasse" @change="gewichtWahl.klasse = ($event.target as HTMLSelectElement).value">
          <option :value="ALLE">{{ t('lists.wkr.all') }}</option>
          <option v-for="c in stegKlassen" :key="c.id" :value="c.id">{{ classLabel(c.id) }}</option>
        </select>
      </div>
      <p v-if="!blocked && state.starters.length > 0" class="note ergebnis-zahl" role="status">{{ tn('results.count', stegList ? stegListen.length : dokumente) }}</p>
    </div>
    <p class="note" data-hinweis="gewicht-art">
      {{ t(`lists.weight.hint.${gewichtWahl.art}`) }}
      <template v-if="stegList">
        <a :href="adresse('veranstaltung', { ziel: 'besetzung' })">{{ t('nav.veranstaltung') }} → {{ t('crew.title') }}</a
        >.
      </template>
    </p>
    <p v-if="stegList && !blocked && stegUngewogen > 0" class="boat-banner warn" data-hinweis="steg-ungewogen" role="status">
      {{ tn('lists.weight.unweighed', stegUngewogen) }} <a :href="adresse('verwiegung')">{{ t('nav.verwiegung') }}</a
      >.
    </p>
  </div>

  <p v-if="blocked" class="boat-banner warn no-print" role="alert" style="margin-bottom: 16px">
    <template v-if="missing > 0">{{ tn('lists.missingNumbers', missing) }} </template>
    <template v-if="duplicate > 0">{{ tn('lists.duplicateNumbers', duplicate) }} </template>
    {{ t('lists.fixNumbers') }}
  </p>

  <CodesAushang v-if="codeList" />

  <!-- Vor dem Hinweis „keine Starter“: Ohne Herkunft oder ohne eingeschaltete Variante sagt die Ansicht das zuerst. -->
  <PokalListen v-else-if="cupList" @stand="cupStand = $event" />

  <div v-else-if="state.starters.length === 0" class="panel empty no-print">{{ t('lists.empty') }}</div>
  <!-- Starter gibt es, aber keine Liste: keiner fährt auf einem Parcours, oder keiner hat eine Herkunft. -->
  <div v-else-if="!ownView && sections.length === 0" class="panel empty no-print" data-hinweis="keine-liste">{{ t('lists.noList') }}</div>

  <WkrListen v-else-if="wkrList" :gesperrt="blocked" @stand="wkrStand = $event" />

  <LaufzettelListen v-else-if="runSheets" :gesperrt="blocked" @stand="runSheetStand = $event" />

  <ErgebnisListen v-else-if="resultList" @stand="resultStand = $event" />

  <DruckdateiListen v-else-if="bookletList" :starter-gesperrt="missing > 0 || duplicate > 0" @stand="bookletStand = $event" />

  <!-- Vor gültigen Startnummern gibt es die Liste für den Steg nicht (der Hinweis steht oben). -->
  <template v-else-if="stegList"><AusgleichListen v-if="!blocked" :listen="stegListen" /></template>

  <StarterBlaetter v-else :dokumente="sections" :liste="kind === 'gewicht' ? 'gewicht' : kind === 'vorsteg' ? 'vorsteg' : 'starter'" :form="starterArt === 'herkunft' ? 'herkunft' : 'starter'" :data-art="kind === 'starter' ? starterArt : undefined" />
</template>
