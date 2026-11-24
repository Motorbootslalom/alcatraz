<script setup lang="ts">
import { computed, ref } from 'vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import { aufbauFuer, manoeverAufbauten, PARALLEL, REGELWERKE } from '../config/catalog'
import { useEvent } from '../lib/event'
import { t } from '../i18n'
import type { EventKind, OriginMode } from '../types'
import WkrVorschau from '../components/WkrVorschau.vue'
import BeispieldatenPanel from '../components/BeispieldatenPanel.vue'
import BesetzungPanel from '../components/BesetzungPanel.vue'
import RegelLaeufeHinweis from '../components/RegelLaeufeHinweis.vue'
import EingabenHinweis from '../components/EingabenHinweis.vue'
import DatumFeld from '../components/DatumFeld.vue'
import { starterfeldFest } from '../lib/eingaben'

/**
 * Die Veranstaltung selbst: Name, Jahr, Regelwerk, Aufbau – und im Block „Besetzung“
 * (components/BesetzungPanel.vue), was für diesen Wettkampf eingeteilt wird: Boote,
 * Co-Piloten und die WKR-Einteilung. Alles Übrige – Listen, Kürzel, Dateien – steht unter
 * „Einstellungen“. Am Ende der Block „Beispieldaten“ zum Ausprobieren
 * (components/BeispieldatenPanel.vue).
 */
const { state, dispatch } = useStore()
const { regelwerk, classLabel, foreignClasses, parallel } = useEvent()

// Mitgelieferte Aufbauten und dahinter die eigenen aus den Einstellungen.
const aufbauten = computed(() => manoeverAufbauten(state.value.eigeneAufbauten))
/** Der Aufbau des Parallelslaloms – nur zur Anzeige: Es gibt bisher genau einen. */
const parallelAufbau = computed(() => aufbauFuer(PARALLEL))

const vorschauOffen = merke('veranstaltung.vorschau', false, { ueberNeuladen: true })

// Sobald Ergebnisse erfasst sind, lässt sich das Regelwerk nicht mehr wechseln (der Reducer
// lehnt es ebenfalls ab): Listen, Felder und Wertung hängen daran.
const regelwerkFest = computed(() => starterfeldFest(state.value))

const KINDS: EventKind[] = ['meisterschaft', 'club']
const ORIGINS: OriginMode[] = ['verein', 'bundesland', 'land', 'none']

/** Ein anderer Aufbau kann schon Erfasstes anders werten (lib/eingaben.ts) – dann erst fragen. */
function onAufbau(e: Event) {
  const select = e.target as HTMLSelectElement
  if (Object.keys(state.value.eingaben).length > 0 && !confirm(t('entries.setupConfirm'))) {
    select.value = state.value.aufbau
    return
  }
  dispatch({ type: 'SET_AUFBAU', aufbau: select.value })
}

/**
 * Datum der Veranstaltung (erster Wettkampftag, 24.11.2026): freiwillig, für die Warnung zur
 * Starterlaubnis nach Geburtstag im Reiter „Starter“ (DM-Reglement C8). Maßgeblich für die
 * Jahrgänge bleibt das Jahr; passt das Jahr des Datums nicht dazu, sagt es ein leiser Hinweis –
 * nichts wird angeglichen (es kann ja auch das Jahr falsch sein).
 */
const datumFehler = ref('')
/**
 * Prüfbefund 24.11.2026: Wozu das Datum dient, steht sichtbar unter der Zeile, nicht als `title`
 * (auf Pad und Handy nie zu sehen). Die Grenzen kommen aus dem Regelwerk (`geburtstagsGrenzen`) in
 * dessen Klassenfolge – ein Regelwerk ohne Grenzen (uim-2026) nennt keine, dort wirkt das Datum
 * nirgends, und der Satz sagt nur, was das Feld ist.
 */
const geburtstagsGrenzenText = computed(() => {
  const grenzen = regelwerk.value.geburtstagsGrenzen
  const teile: string[] = []
  for (const k of regelwerk.value.klassen) {
    const g = grenzen[k]
    if (!g) continue
    if (g.ab !== undefined) teile.push(t('event.dateGrenzeAb', { class: classLabel(k), jahre: g.ab }))
    if (g.bis !== undefined) teile.push(t('event.dateGrenzeBis', { class: classLabel(k), jahre: g.bis }))
  }
  return teile.join(', ')
})
const datumJahr = computed(() => (state.value.eventDatum ? Number(state.value.eventDatum.slice(0, 4)) : null))
const jahrPasstNicht = computed(() => datumJahr.value !== null && datumJahr.value !== state.value.eventJahr)

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
      <div class="field" style="width: 150px">
        <label for="ev-datum">{{ t('event.date') }}</label>
        <!-- Eigenes Textfeld mit festem Muster – nie die Datumswahl des Browsers (mm/dd/yyyy). -->
        <DatumFeld
          id="ev-datum"
          class="input"
          data-feld="event-datum"
          :model-value="state.eventDatum"
          @update:model-value="dispatch({ type: 'SET_EVENT_DATUM', datum: $event })"
          @fehler="datumFehler = $event"
        />
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
    <!-- Unter der Zeile statt im schmalen Feld: Die Sätze sind länger als das Datum. -->
    <p class="note" data-hinweis="datum-zweck">
      {{ t('event.dateHint') }}
      <template v-if="geburtstagsGrenzenText">{{ t('event.dateHintGeburtstag', { grenzen: geburtstagsGrenzenText }) }}</template>
    </p>
    <p v-if="datumFehler" class="note" role="alert" data-hinweis="datum-fehler">{{ datumFehler }}</p>
    <p v-else-if="jahrPasstNicht" class="note" data-hinweis="datum-jahr">{{ t('event.dateOtherYear', { year: datumJahr ?? '', eventYear: state.eventJahr }) }}</p>
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
            :disabled="regelwerkFest && state.regelwerk !== r.id"
            :title="regelwerkFest && state.regelwerk !== r.id ? t('event.rulebookLocked') : undefined"
            :data-regelwerk="r.id"
            @click="dispatch({ type: 'SET_REGELWERK', regelwerk: r.id })"
          >
            {{ r.label }}
          </button>
        </div>
        <p v-if="regelwerkFest" class="note" data-hinweis="regelwerk-gesperrt" role="status">{{ t('event.rulebookLocked') }}</p>
      </div>
      <div class="field" style="min-width: 220px">
        <label for="ev-aufbau">{{ parallel ? t('event.setupManoever') : t('event.setup') }}</label>
        <select
          id="ev-aufbau"
          class="input"
          :value="state.aufbau"
          @change="onAufbau"
        >
          <option v-for="a in aufbauten" :key="a.id" :value="a.id">
            {{ a.eigen ? t('event.setupOwn', { name: a.name }) : a.name }}
          </option>
        </select>
      </div>
    </div>
    <RegelLaeufeHinweis />
    <!-- Regelwerk, Aufbau und Zahl der Läufe können erfasste Werte verbergen (3. Lauf, Klassen,
         die das Regelwerk nicht kennt): Das steht dort, wo man es auslöst. -->
    <EingabenHinweis />
    <p class="note">
      {{ parallel ? t('event.rulebookNote.parallel') : t('event.rulebookNote.manoever') }}
      {{ t('event.setupNote') }}
    </p>
    <!-- Der Parallelslalom ist ein eigener Wettkampf auf einem anderen Parcours und hat einen
         eigenen Aufbau (config/aufbauten/parallel.yaml) – bisher genau einen, zu wählen gibt es nichts. -->
    <p v-if="parallel && parallelAufbau" class="note" data-hinweis="parallel-aufbau">
      {{ t('event.parallelSetup', { setup: parallelAufbau.name }) }}
    </p>
    <p v-if="foreignClasses.length > 0" class="boat-banner warn" role="status">
      {{ t('event.foreignClasses', { rulebook: regelwerk.label, classes: foreignClasses.map((c) => classLabel(c.id)).join(', ') }) }}
    </p>
    <p class="note">{{ t('event.note') }}</p>
    <!-- Zugeklappt, damit die Seite kurz bleibt: Wer den Aufbau wählt, kann hier nachsehen,
         welche Listen er ergibt. Gebaut wird die Ansicht erst beim Aufklappen. -->
    <details class="sub-details" data-vorschau :open="vorschauOffen" @toggle="vorschauOffen = ($event.target as HTMLDetailsElement).open">
      <summary>{{ t('event.preview') }}</summary>
      <WkrVorschau v-if="vorschauOffen" />
    </details>
  </div>

  <!-- Was die Regattaleitung für diesen Wettkampf einteilt: Boote, Co-Piloten, Wettkampfrichter. -->
  <BesetzungPanel />

  <!-- Am Ende und zugeklappt: Neue sehen, dass es Beispieldaten gibt; offen, sobald sie geladen sind. -->
  <BeispieldatenPanel />
</template>
