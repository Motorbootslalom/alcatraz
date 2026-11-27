<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import { useBogenKonfig, useKonfig } from '../lib/konfig'
import { useEvent } from '../lib/event'
import { bogenMitBild, listenFuerKlasse, musterZeilen, type BogenAuftrag, type BogenOptionen } from '../lib/bogen'
import { parcoursVon, wkrName } from '../lib/einteilung'
import { gemeinsameBoegen, wkrBoegen } from '../lib/wkrListen'
import { planEvent } from '../planung/plan'
import { musterCode } from '../lib/qr'
import { musterRundenBoegen } from '../lib/parallelBogen'
import { RACECOURSES, type Racecourse } from '../lib/parallelSchluessel'
import { useBogenZoom } from '../lib/bogenZoom'
import { t, tn } from '../i18n'
import { adresse } from '../lib/router'
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
 * Der Name im Bogenkopf wird nur angezeigt: der aus der WKR-Einteilung für diese Liste auf dem
 * Parcours der Klasse (bzw. auf dem Racecourse). Ist dort niemand eingeteilt, steht wie auf dem
 * Papier die leere Linie mit „Name Wettkampfrichter*in“. Eintragen lässt er sich nur in der
 * WKR-Einteilung (Entscheidung des Nutzers vom 15.11.2026: ein Name auf einem Beispielbogen war
 * unlogisch) – so zeigen die Vorschau hier und die im Assistenten für eigene Aufbauten dasselbe.
 *
 * Unter einem Regelwerk mit Parallelslalom (UIM) kommen dessen Listen dazu: je Racecourse A und B
 * Zeit, Steg (pontoon) und Fahrweg einer Muster-Runde (Entscheidung des Nutzers vom 15.11.2026) –
 * gebaut mit denselben Bausteinen wie die echten Listen (lib/parallelBogen.ts `musterRundenBoegen`):
 * Muster-Startnummern in Blöcken wie gedruckt (4 bzw. 2 Starts), eine Dummy-Zeile, Muster-QR.
 * „Muster-Zeilen“ zählt dort die Starts, aufgerundet auf ganze Paare. Nicht im Assistenten: Der
 * entwirft einen Aufbau des Manövrierens.
 */
const props = defineProps<{
  /** Eine andere Konfiguration als die der Veranstaltung: der Entwurf im Assistenten. */
  konfig?: Konfig
  /** Der Aufbau; Vorgabe ist der gewählte. */
  aufbauId?: string
  /** Einleitung, wenn nicht die der Einstellungen passt. */
  einleitung?: string
}>()

const { state } = useStore()
const eigeneKonfig = useKonfig()
const konfig = computed(() => props.konfig ?? eigeneKonfig.value)
// Gezeichnet wird der Bogen in der Sprache seiner Liste auf seinem Parcours, wie er gedruckt
// würde. Der Entwurf im Assistenten bringt seine eigene Konfiguration mit; dort gilt die Sprache
// des Regelwerks.
const bogenKonfig = useBogenKonfig()
const blattKonfig = (b: { typeId: string; parcoursId?: string }) => props.konfig ?? bogenKonfig(b.typeId, b.parcoursId)
const aufbauId = computed(() => props.aufbauId ?? state.value.aufbau)
const id = useId()

// Nur die Klassen des Regelwerks; der Parcours dazu ergibt sich aus der Verzahnung.
const { regelwerk, classLabel } = useEvent()
const klassen = computed(() => regelwerk.value.klassen)
// Vorgabe wie im Prototyp die höchste Klasse: Sie hat die meisten Spalten und Listen. Nach
// einem Wechsel des Regelwerks gilt die Vorgabe, wenn es die gewählte Klasse dort nicht gibt.
// Die Auswahl der Vorschau übersteht das Neuladen; was es nicht mehr gibt, fällt unten auf die Vorgabe.
const istText = (w: unknown) => typeof w === 'string'
const wahl = merke<ClassId | undefined>('vorschau.klasse', undefined, { ueberNeuladen: true, gueltig: istText })
const klasse = computed<ClassId>(() => (wahl.value && klassen.value.includes(wahl.value) ? wahl.value : klassen.value[klassen.value.length - 1]))

/** Wie viele Muster-Starter auf den Listen stehen; mit vielen zeigt sich die Seitenaufteilung. */
const MAX_ZEILEN = 60
const anzahl = merke('vorschau.zeilen', 10, { ueberNeuladen: true, gueltig: (w) => typeof w === 'number' && w >= 0 && w <= MAX_ZEILEN })
function setzeAnzahl(e: Event) {
  const n = parseInt((e.target as HTMLInputElement).value, 10)
  anzahl.value = Number.isNaN(n) ? 0 : Math.max(0, Math.min(MAX_ZEILEN, n))
}

const parcours = computed(() => parcoursVon(state.value.parcoursList, klasse.value))
const heading = computed(() => [state.value.eventName, state.value.eventJahr].filter(Boolean).join(' '))

/** Ein Reiter der Beispielansicht: ein Blatt, wie es gedruckt würde. */
interface Blatt {
  /** Kennung des Reiters: im Manövrieren die Liste, im Parallelslalom Runde, Racecourse und Liste. */
  id: string
  typeId: string
  /** Parcours bzw. Racecourse des Blatts (Kennung in der Einteilung) – für Name und Sprache. */
  parcoursId?: string
  auftrag: BogenAuftrag
  optionen: Pick<BogenOptionen, 'leerzeilen' | 'zeilenJeSeite' | 'teilenAb' | 'klassenBloecke' | 'leerzeilenJeKlasse' | 'leerzeilenJeSeite' | 'zebra'>
}

/**
 * Gemeinsame Bögen (Clubmeisterschaft; Meisterschaft auf Wunsch, R11-03, 26.11.2026): Dort stehen mehrere Klassen auf
 * einem Bogen. Die Beispielansicht zeigt
 * deshalb, was wirklich gedruckt würde – abgeleitet mit derselben Funktion wie die echten
 * Listen (lib/wkrListen.ts), nur mit Muster-Startern: je Klasse des Parcours `anzahl` Stück.
 * Stehen die Klassen in der Startfolge (`wkrGemeinsamFolge` `verzahnung`, 24.11.2026), mischt
 * die Verzahnung des Parcours (planung/plan.ts, mit seinen Spuren und Booten) die Muster-Starter
 * so, wie sie es mit echten täte – sonst sähe der Bogen aus wie Blöcke ohne Überschrift. Bestätigt
 * 27.11.2026 (R13-14 (3)).
 */
const musterGemeinsam = computed(() => {
  if (!gemeinsameBoegen(state.value).gemeinsam) return undefined
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
  const folge = state.value.wkrGemeinsamFolge === 'verzahnung' && dabei.length > 1 ? (planEvent({ ...stand, starters: starter }).plans[0]?.sequence ?? starter) : starter
  return wkrBoegen(stand, konfig.value, new Map([[p.id, folge]])).boegen
})

const boegen = computed<Blatt[]>(() => {
  const zeilen = musterZeilen(anzahl.value, t('preview.numberPrefix'))
  return listenFuerKlasse(konfig.value, { ...state.value, aufbau: aufbauId.value }, klasse.value).map((typeId) => {
    // Der gemeinsame Bogen, auf dem die gewählte Klasse steht (nur mit gemeinsamen Bögen).
    const gemeinsam = musterGemeinsam.value?.find((b) => b.typeId === typeId && b.klassen.includes(klasse.value))
    const auftrag: BogenAuftrag = {
      ...(gemeinsam?.auftrag ?? { typeId, klassen: [klasse.value], lauf: 1, zeilen, aufbauId: aufbauId.value }),
      eventName: heading.value,
      // Wie auf den Startlisten: Der Parcours steht nur da, wenn es mehrere gibt.
      parcours: state.value.parcoursList.length > 1 ? parcours.value?.name : undefined,
      // Nur zur Anzeige: der Name aus der WKR-Einteilung, wie er gedruckt wird (siehe oben).
      wkr: wkrName(state.value, typeId, klasse.value, konfig.value),
      // Der Code zeigt, wo er steht und wie groß er ist – trifft aber keinen Bogen: An der
      // Stelle der Veranstaltung steht „MUSTER“, die Erfassung weist ihn als Beispiel ab.
      qr: musterCode(
        { regelwerk: state.value.regelwerk, aufbau: aufbauId.value },
        { parcoursId: parcours.value?.id ?? 'p', klassen: gemeinsam?.klassen ?? [klasse.value], lauf: 1, typeId },
      ),
    }
    // Leerzeilen und Seitenaufteilung wie auf den echten Listen (Einstellungen).
    const optionen = gemeinsam?.optionen ?? {
      leerzeilen: state.value.wkrLeerzeilenKlasse[klasse.value] ?? state.value.wkrLeerzeilen,
      zeilenJeSeite: state.value.wkrZeilenJeSeite,
      teilenAb: state.value.wkrTeilenAb,
    }
    return { id: typeId, typeId, parcoursId: parcours.value?.id, auftrag, optionen }
  })
})

// --- Parallelslalom: eine Muster-Runde je Racecourse (nur unter einem Regelwerk, das ihn kennt) ---
const parallel = computed(() =>
  props.konfig ? undefined : musterRundenBoegen(state.value, konfig.value, { anzahl: anzahl.value, praefix: t('preview.numberPrefix'), klasse: klasse.value }),
)
const parallelBlaetter = computed<(Blatt & { racecourse: Racecourse })[]>(() =>
  (parallel.value?.boegen ?? []).map((b) => ({ id: b.id, typeId: b.typeId, parcoursId: b.parcoursId, racecourse: b.runde!.racecourse, auftrag: b.auftrag, optionen: b.optionen })),
)
const parallelGruppen = computed(() =>
  RACECOURSES.map((rc) => ({ racecourse: rc, blaetter: parallelBlaetter.value.filter((b) => b.racecourse === rc) })).filter((g) => g.blaetter.length > 0),
)
const racecourseName = (rc: Racecourse) => t(rc === 'A' ? 'parallel.parcoursA' : 'parallel.parcoursB')
/** Wie viele Starts eine Liste der Muster-Runde hat (Zeilen): je Paar zwei Attempts. */
const parallelStarts = computed(() => parallelBlaetter.value[0]?.auftrag.zeilen.length ?? 0)

// Je Position ein Reiter: Untereinander wären es bis zu neun Blätter – wer einen Aufbau
// anlegt, will die eine Position sehen, an der er gerade arbeitet. Gibt es die gewählte
// Position nicht mehr (andere Klasse, anderer Aufbau, anderes Regelwerk), gilt die erste.
const gewaehlt = merke<string | undefined>('vorschau.reiter', undefined, { ueberNeuladen: true, gueltig: istText })
const alleBlaetter = computed<Blatt[]>(() => [...boegen.value, ...parallelBlaetter.value])
const aktiv = computed(() => alleBlaetter.value.find((b) => b.id === gewaehlt.value) ?? alleBlaetter.value[0])
const parallelAktiv = computed(() => !!aktiv.value && parallelBlaetter.value.some((b) => b.id === aktiv.value!.id))
// Dieselbe Regel wie auf dem Bogen – auch die Muster-Runde des Parallelslaloms trägt auf dem Fahrweg-Bogen die Zeichnung (23.11.2026).
const mitBild = computed(() => !!aktiv.value && bogenMitBild(konfig.value, aktiv.value.auftrag))
const reiterTitel = (b: Blatt) => konfig.value.getSheetDef(b.typeId).title

// Schmale Fenster: Die Bögen werden als Ganzes verkleinert (lib/bogenZoom.ts).
const stapel = ref<HTMLElement | null>(null)
const { zoom } = useBogenZoom(stapel)
</script>

<template>
  <!-- `no-print` zusätzlich zur Regel in bogen.css: Eine Beispielansicht ist keine Liste. -->
  <section class="wkr-vorschau no-print" :aria-labelledby="`${id}-titel`">
    <h3 :id="`${id}-titel`">
      {{ t('preview.title') }}
      <span class="wkr-vorschau-marke">{{ t('preview.mark') }}</span>
    </h3>
    <p class="hint">{{ einleitung ?? t('preview.intro') }}</p>
    <p v-if="!einleitung" class="note" data-hinweis="vorschau-namen">
      {{ t('preview.names') }} <a :href="adresse('veranstaltung', { ziel: 'wkr' })">{{ t('wkr.title') }}</a
      >.
    </p>
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
        <template v-if="parallelBlaetter.length > 0"> · {{ tn('preview.countParallel', parallelBlaetter.length) }}</template>
      </p>
    </div>
    <p v-if="!props.konfig && !parcours && klasse" class="boat-banner warn" role="status">
      {{ t('preview.noParcours', { class: classLabel(klasse) }) }} <a :href="adresse('verzahnung')">{{ t('nav.verzahnung') }}</a>
    </p>
    <p v-if="boegen.length === 0" class="boat-banner warn" role="status">{{ t('preview.noLists', { class: classLabel(klasse) }) }}</p>
    <div v-if="alleBlaetter.length > 1" class="wkr-vorschau-reiter" role="tablist" :aria-label="t('preview.tabs')">
      <div v-if="boegen.length > 0" class="segmented list-kinds wkr-vorschau-tabs">
        <button
          v-for="b in boegen"
          :key="b.id"
          type="button"
          role="tab"
          :data-liste="b.id"
          :class="aktiv?.id === b.id ? 'active' : ''"
          :aria-selected="aktiv?.id === b.id"
          @click="gewaehlt = b.id"
        >
          {{ reiterTitel(b) }}
        </button>
      </div>
      <!-- Parallelslalom: je Racecourse seine Listen. -->
      <div v-if="parallelGruppen.length > 0" class="wkr-vorschau-parallel">
        <span class="wkr-vorschau-parallel-titel">{{ t('parallel.title') }}</span>
        <div v-for="g in parallelGruppen" :key="g.racecourse" class="wkr-vorschau-racecourse" :data-racecourse="g.racecourse">
          <span class="wkr-vorschau-racecourse-name">{{ racecourseName(g.racecourse) }}</span>
          <div class="segmented list-kinds wkr-vorschau-parallel-tabs">
            <button
              v-for="b in g.blaetter"
              :key="b.id"
              type="button"
              role="tab"
              :data-liste="b.id"
              :class="aktiv?.id === b.id ? 'active' : ''"
              :aria-selected="aktiv?.id === b.id"
              :aria-label="`${reiterTitel(b)}, ${racecourseName(g.racecourse)}`"
              @click="gewaehlt = b.id"
            >
              {{ reiterTitel(b) }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Mit 0 Muster-Zeilen bleiben die Listen leer wie im Manövrieren (nur der Kopf) – dann nennt der
         Hinweis weder Blöcke noch eine Dummy-Zeile, die es nicht gibt. -->
    <p v-if="parallelAktiv" class="note" data-hinweis="vorschau-parallel">
      {{ parallelStarts > 0 ? tn('preview.parallelNote', parallelStarts) : t('preview.parallelNoteEmpty') }}
    </p>
    <div ref="stapel" class="bogen-stapel" :style="zoom">
      <template v-for="b in aktiv ? [aktiv] : []" :key="b.id">
        <BogenBlatt :konfig="blattKonfig(b)" :auftrag="b.auftrag" :optionen="b.optionen" :kennzeichen="t('preview.mark')" />
      </template>
    </div>
    <ParcoursNachweis v-if="mitBild" />
  </section>
</template>
