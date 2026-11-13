<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { useEvent } from '../lib/event'
import { listenFuerKlasse, musterZeilen, type BogenAuftrag } from '../lib/bogen'
import { parcoursVon, wkrFeld, wkrName } from '../lib/einteilung'
import { wkrBoegen } from '../lib/wkrListen'
import { useBogenZoom } from '../lib/bogenZoom'
import { t, tn } from '../i18n'
import type { Konfig } from '../config/konfig'
import type { ClassId, Starter } from '../types'
import BogenBlatt from './bogen/BogenBlatt.vue'
import ParcoursNachweis from './ParcoursNachweis.vue'

/**
 * Beispielansicht der Wettkampfrichter-Listen: die Listen eines Aufbaus für eine Klasse, je
 * Position ein Reiter, so wie sie gedruckt würden – mit Muster-Startnummern („M1“, „M2“ …) und einem Kennzeichen
 * quer über jedem Blatt. Vorbild ist die Vorschau im Fehlerpunkte-Prototyp (`vorschauKlasse`).
 *
 * Sie rechnet nur aus dem Stand und der Konfiguration und folgt deshalb sofort dem
 * Regelwerk, dem Aufbau, der Einteilung und der Sprache. Gedruckt wird sie nie (bogen.css).
 *
 * Mit `namenPflegen` ist das Namensfeld im Bogenkopf ein Eingabefeld. Es schreibt mit
 * derselben Action an dieselbe Stelle wie die Tabelle der WKR-Einteilung (lib/einteilung.ts
 * `wkrFeld`); beide zeigen deshalb stets denselben Stand. Ist das Blatt in einem schmalen
 * Fenster stark verkleinert, wäre das Feld im Kopf nur wenige Pixel hoch: Dann steht
 * dasselbe Feld in normaler Größe über dem Blatt, und der Kopf zeigt den Namen als Text.
 */
const props = withDefaults(
  defineProps<{
    /** Eine andere Konfiguration als die der Veranstaltung: der Entwurf im Assistenten. */
    konfig?: Konfig
    /** Der Aufbau; Vorgabe ist der gewählte. */
    aufbauId?: string
    namenPflegen?: boolean
    /** Einleitung, wenn nicht die der Einstellungen passt. */
    einleitung?: string
  }>(),
  { namenPflegen: true },
)

const { state, dispatch } = useStore()
const eigeneKonfig = useKonfig()
const konfig = computed(() => props.konfig ?? eigeneKonfig.value)
const aufbauId = computed(() => props.aufbauId ?? state.value.aufbau)
const id = useId()

// Nur die Klassen des Regelwerks; der Parcours dazu ergibt sich aus der Verzahnung.
const { regelwerk, classLabel } = useEvent()
const klassen = computed(() => regelwerk.value.klassen)
// Vorgabe wie im Prototyp die höchste Klasse: Sie hat die meisten Spalten und Listen. Nach
// einem Wechsel des Regelwerks gilt die Vorgabe, wenn es die gewählte Klasse dort nicht gibt.
const wahl = merke<ClassId | undefined>('vorschau.klasse', undefined)
const klasse = computed<ClassId>(() => (wahl.value && klassen.value.includes(wahl.value) ? wahl.value : klassen.value[klassen.value.length - 1]))

/** Wie viele Muster-Starter auf den Listen stehen; mit vielen zeigt sich die Seitenaufteilung. */
const MAX_ZEILEN = 60
const anzahl = merke('vorschau.zeilen', 10)
function setzeAnzahl(e: Event) {
  const n = parseInt((e.target as HTMLInputElement).value, 10)
  anzahl.value = Number.isNaN(n) ? 0 : Math.max(0, Math.min(MAX_ZEILEN, n))
}

const parcours = computed(() => parcoursVon(state.value.parcoursList, klasse.value))
const heading = computed(() => [state.value.eventName, state.value.eventJahr].filter(Boolean).join(' '))

/**
 * Clubmeisterschaft: Dort stehen mehrere Klassen auf einem Bogen. Die Beispielansicht zeigt
 * deshalb, was wirklich gedruckt würde – abgeleitet mit derselben Funktion wie die echten
 * Listen (lib/wkrListen.ts), nur mit Muster-Startern: je Klasse des Parcours `anzahl` Stück.
 */
const clubBoegen = computed(() => {
  if (state.value.eventKind !== 'club') return undefined
  const praefix = t('preview.numberPrefix')
  const erlaubt = new Set<ClassId>(klassen.value)
  const p = parcours.value ?? { id: '_', name: '', classIds: [klasse.value], wechselFaktor: 2 as const }
  const dabei = p.classIds.filter((k) => erlaubt.has(k))
  let nr = 0
  const starter: Starter[] = dabei.flatMap((k) =>
    Array.from({ length: Math.max(0, Math.floor(anzahl.value)) }, () => {
      nr++
      return { id: `muster-${nr}`, startNr: `${praefix}${nr}`, vorname: '', nachname: '', verein: '', bundesland: '', geburtsdatum: '', groesse: '', klasse: k }
    }),
  )
  const stand = { ...state.value, aufbau: aufbauId.value, laufCount: 1, parcoursList: [p] }
  return wkrBoegen(stand, konfig.value, new Map([[p.id, starter]])).boegen
})

const boegen = computed(() => {
  const zeilen = musterZeilen(anzahl.value, t('preview.numberPrefix'))
  return listenFuerKlasse(konfig.value, aufbauId.value, klasse.value).map((typeId) => {
    const feld = props.namenPflegen ? wkrFeld(state.value, typeId, klasse.value, konfig.value) : undefined
    const def = konfig.value.getSheetDef(typeId)
    // Das Feld im Kopf nur, solange es sich treffen und lesen lässt.
    const imKopf = !!feld && faktoren.value[def.orientation] >= KOPF_FELD_AB
    // Der gemeinsame Bogen, auf dem die gewählte Klasse steht (nur Clubmeisterschaft).
    const gemeinsam = clubBoegen.value?.find((b) => b.typeId === typeId && b.klassen.includes(klasse.value))
    const auftrag: BogenAuftrag = {
      ...(gemeinsam?.auftrag ?? { typeId, klassen: [klasse.value], lauf: 1, zeilen, aufbauId: aufbauId.value }),
      eventName: heading.value,
      // Wie auf den Startlisten: Der Parcours steht nur da, wenn es mehrere gibt.
      parcours: state.value.parcoursList.length > 1 ? parcours.value?.name : undefined,
      // Im Eingabefeld der Eintrag, wie er getippt wurde; sonst der Name, wie er gedruckt wird.
      wkr: feld && imKopf ? feld.eingabe : wkrName(state.value, typeId, klasse.value, konfig.value),
    }
    // Leerzeilen wie auf den echten Listen (Einstellungen).
    const optionen = gemeinsam?.optionen ?? { leerzeilen: state.value.wkrLeerzeilenKlasse[klasse.value] ?? state.value.wkrLeerzeilen }
    const label = feld && parcours.value ? t('preview.nameFor', { list: def.title, parcours: parcours.value.name }) : undefined
    return { typeId, feld, imKopf, auftrag, optionen, label }
  })
})
// Je Position ein Reiter: Untereinander wären es bis zu neun Blätter – wer einen Aufbau
// anlegt, will die eine Position sehen, an der er gerade arbeitet. Gibt es die gewählte
// Position nicht mehr (andere Klasse, anderer Aufbau), gilt die erste.
const gewaehlt = merke<string | undefined>('vorschau.reiter', undefined)
const aktiv = computed(() => boegen.value.find((b) => b.typeId === gewaehlt.value) ?? boegen.value[0])
const mitBild = computed(() => !!aktiv.value && !aktiv.value.auftrag.ohneBild && !!konfig.value.getSheetDef(aktiv.value.typeId).bildErzeugen)

function setzeName(parcoursId: string, typeId: string, name: string) {
  dispatch({ type: 'SET_WKR_NAME', parcoursId, typeId, name })
}

// Schmale Fenster: Die Bögen werden als Ganzes verkleinert (lib/bogenZoom.ts).
const stapel = ref<HTMLElement | null>(null)
const { faktoren, zoom } = useBogenZoom(stapel)
/** Unter diesem Faktor ist das Namensfeld im Kopf (12 pt) kleiner als etwa 9 px Schrift. */
const KOPF_FELD_AB = 0.6
</script>

<template>
  <!-- `no-print` zusätzlich zur Regel in bogen.css: Eine Beispielansicht ist keine Liste. -->
  <section class="wkr-vorschau no-print" :aria-labelledby="`${id}-titel`">
    <h3 :id="`${id}-titel`">
      {{ t('preview.title') }}
      <span class="wkr-vorschau-marke">{{ t('preview.mark') }}</span>
    </h3>
    <p class="hint">{{ einleitung ?? t('preview.intro') }}</p>
    <div class="row wkr-vorschau-leiste">
      <div class="field">
        <label :for="`${id}-klasse`">{{ t('preview.class') }}</label>
        <select :id="`${id}-klasse`" class="input" data-feld="vorschau-klasse" :value="klasse" @change="wahl = ($event.target as HTMLSelectElement).value as ClassId">
          <option v-for="k in klassen" :key="k" :value="k">{{ classLabel(k) }}</option>
        </select>
      </div>
      <div class="field" style="width: 120px">
        <label :for="`${id}-zeilen`">{{ t('preview.rows') }}</label>
        <input :id="`${id}-zeilen`" class="input" type="number" min="0" :max="MAX_ZEILEN" :value="anzahl" @change="setzeAnzahl" />
      </div>
      <p class="note wkr-vorschau-stand" role="status">
        {{ tn('preview.count', boegen.length) }}
        <template v-if="parcours"> · {{ t('preview.parcours', { parcours: parcours.name }) }}</template>
      </p>
    </div>
    <p v-if="namenPflegen && !parcours && klasse" class="boat-banner warn" role="status">
      {{ t('preview.noParcours', { class: classLabel(klasse) }) }} <a href="#/verzahnung">{{ t('nav.verzahnung') }}</a>
    </p>
    <p v-if="boegen.length === 0" class="boat-banner warn" role="status">{{ t('preview.noLists', { class: classLabel(klasse) }) }}</p>
    <div v-if="boegen.length > 1" class="segmented list-kinds wkr-vorschau-tabs" role="tablist" :aria-label="t('preview.tabs')">
      <button
        v-for="b in boegen"
        :key="b.typeId"
        type="button"
        role="tab"
        :data-liste="b.typeId"
        :class="aktiv?.typeId === b.typeId ? 'active' : ''"
        :aria-selected="aktiv?.typeId === b.typeId"
        @click="gewaehlt = b.typeId"
      >
        {{ konfig.getSheetDef(b.typeId).title }}
      </button>
    </div>
    <div ref="stapel" class="bogen-stapel" :style="zoom">
      <template v-for="b in aktiv ? [aktiv] : []" :key="b.typeId">
        <!-- Verkleinertes Blatt: das Namensfeld in normaler Größe darüber (siehe oben). -->
        <div v-if="b.feld && !b.imKopf" class="field wkr-vorschau-name">
          <label :for="`${id}-name-${b.typeId}`">{{ b.label }}</label>
          <input
            :id="`${id}-name-${b.typeId}`"
            class="input"
            autocomplete="off"
            :data-feld="`vorschau-name|${b.typeId}`"
            :value="b.feld.eingabe"
            @input="setzeName(b.feld.parcoursId, b.typeId, ($event.target as HTMLInputElement).value)"
          />
        </div>
        <BogenBlatt
          :konfig="konfig"
          :auftrag="b.auftrag"
          :optionen="b.optionen"
          :kennzeichen="t('preview.mark')"
          :wkr-pflege="b.imKopf"
          :wkr-label="b.label"
          @wkr="b.feld && setzeName(b.feld.parcoursId, b.typeId, $event)"
        />
      </template>
    </div>
    <ParcoursNachweis v-if="mitBild" />
  </section>
</template>
