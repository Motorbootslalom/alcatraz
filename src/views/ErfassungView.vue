<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { useEvent } from '../lib/event'
import { duplicateStartNrIds } from '../domain/startnumbers'
import { bogenFortschritt } from '../lib/erfassung'
import { wkrBoegenZumStand, type WkrBogen, type WkrListen } from '../lib/wkrListen'
import { leseCode, type QrFehler } from '../lib/qr'
import { meldeScan, scanBeenden, scanBogen, scanErledigt, scanStand } from '../lib/scan'
import { PROTOTYP_URL } from '../lib/prototyp'
import { veranstaltungsListen } from '../lib/listen'
import { t, tn } from '../i18n'
import type { ClassId } from '../types'
import ErfassungTabelle from '../components/erfassung/ErfassungTabelle.vue'
import EingabenHinweis from '../components/EingabenHinweis.vue'
import ScanHinweis from '../components/erfassung/ScanHinweis.vue'

/**
 * Erfassung: die ausgefüllten Wettkampfrichter-Listen nach dem Lauf abtippen. Gewählt wird
 * wie bei den Listen – Parcours, Klasse, Lauf, Liste –, gezeigt wird genau der Bogen, der
 * auf dem Klemmbrett lag, mit Eingabefeldern (components/erfassung/ErfassungTabelle.vue).
 *
 * Die Bögen sind dieselben wie unter „Listen“ (lib/wkrListen.ts): gleiche Zeilen in der
 * Startreihenfolge der Verzahnung. Was eingetippt ist, hängt an Starter-ID, Lauf und Feld –
 * die Auswahl hier ist nur der Blick darauf und gehört nicht zum Stand der Veranstaltung.
 *
 * Scannen: Jeder Bogen und jeder Laufzettel trägt einen QR-Code (lib/qr.ts). Ein Handscanner
 * – er tippt wie eine Tastatur, App.vue hört in jeder Ansicht darauf – oder eine ins Feld
 * getippte Kennung wählt Parcours, Klasse, Lauf und Liste des Blatts und stellt den Cursor in
 * die erste Zelle. Ein Laufzettel führt zur ersten Liste seiner Klasse in dem Lauf.
 */
const { state } = useStore()
const konfig = useKonfig({ einsprachig: true })
const { classLabel, parallel } = useEvent()
const id = useId()

/**
 * Die Bögen hängen an Startern, Verzahnung und Aufbau – nicht an den Eingaben. Jeder
 * Tastendruck ersetzt aber den Stand als Ganzes; ohne dieses Merken liefe die Verzahnung bei
 * jeder Ziffer neu. Verglichen wird Feld für Feld: Der Reducer lässt Unverändertes stehen.
 */
let gemerkt: { stand: Record<string, unknown>; konfig: unknown; listen: WkrListen } | undefined
const listen = computed(() => {
  // Auch der Stand der Ergebnislisten ändert sich mit jeder Eingabe und geht die Bögen nichts an.
  const { eingaben: _eingaben, listenStand: _listenStand, ...rest } = state.value
  const stand = rest as Record<string, unknown>
  const g = gemerkt
  if (g && g.konfig === konfig.value && Object.keys(stand).length === Object.keys(g.stand).length && Object.keys(stand).every((k) => stand[k] === g.stand[k])) return g.listen
  gemerkt = { stand, konfig: konfig.value, listen: wkrBoegenZumStand(state.value, konfig.value) }
  return gemerkt.listen
})
const alle = computed(() => listen.value.boegen)
const fehlend = computed(() => state.value.starters.filter((p) => p.startNr.trim() === '').length)
const doppelt = computed(() => duplicateStartNrIds(state.value.starters, state.value.startNrMode).size)

const wahl = merke<{ parcours?: string; klasse?: ClassId; lauf?: number; liste?: string }>('erfassung.wahl', {}, { ueberNeuladen: true })

// Jede Stufe grenzt die nächste ein; eine Wahl, die es nicht (mehr) gibt, fällt auf die erste Möglichkeit.
const parcoursListe = computed(() => state.value.parcoursList.filter((p) => alle.value.some((b) => b.parcoursId === p.id)))
const parcoursId = computed(() => (parcoursListe.value.some((p) => p.id === wahl.value.parcours) ? wahl.value.parcours : parcoursListe.value[0]?.id))
const amParcours = computed(() => alle.value.filter((b) => b.parcoursId === parcoursId.value))
const klassen = computed(() => [...new Set(amParcours.value.flatMap((b) => b.klassen))])
const klasse = computed(() => (wahl.value.klasse !== undefined && klassen.value.includes(wahl.value.klasse) ? wahl.value.klasse : klassen.value[0]))
const laeufe = computed(() => Array.from({ length: Math.max(1, state.value.laufCount) }, (_, i) => i + 1))
const lauf = computed(() => (wahl.value.lauf !== undefined && laeufe.value.includes(wahl.value.lauf) ? wahl.value.lauf : 1))

/** Die Bögen der Klasse in diesem Lauf; eine Liste ohne Lauf (Knoten) gibt es nur einmal – sie steht bei jedem Lauf dabei. */
const boegen = computed<WkrBogen[]>(() => {
  // In der Reihenfolge der Listen: Der Bogen ohne Lauf gehört zum 1. Lauf und stünde sonst
  // in jedem späteren Lauf vor allen anderen.
  const listen = veranstaltungsListen(konfig.value, state.value)
  return amParcours.value
    .filter((b) => klasse.value !== undefined && b.klassen.includes(klasse.value) && (b.lauf === lauf.value || konfig.value.getSheetDef(b.typeId).showLauf === false))
    .sort((a, b) => listen.indexOf(a.typeId) - listen.indexOf(b.typeId))
})
const bogen = computed(() => boegen.value.find((b) => b.typeId === wahl.value.liste) ?? boegen.value[0])

const titel = computed(() => {
  const jeTyp = new Map(boegen.value.map((b) => [b.typeId, b.titel]))
  // Teilen sich zwei Listen den Titel, unterscheidet sie der ausführliche Name aus dem Menü.
  const mehrfach = (text: string) => [...jeTyp.values()].filter((x) => x === text).length > 1
  return new Map([...jeTyp].map(([typeId, text]) => [typeId, mehrfach(text) ? konfig.value.getSheetDef(typeId).menuLabel : text]))
})

const stand = computed(() =>
  boegen.value.map((b) => ({ bogen: b, titel: titel.value.get(b.typeId) ?? b.titel, ...bogenFortschritt(konfig.value, state.value.eingaben, state.value.aufbau, b.auftrag) })),
)
const summe = computed(() => stand.value.reduce((s, x) => ({ erfasst: s.erfasst + x.erfasst, gesamt: s.gesamt + x.gesamt }), { erfasst: 0, gesamt: 0 }))

function setze(feld: 'parcours' | 'klasse' | 'lauf' | 'liste', e: Event) {
  const wert = (e.target as HTMLSelectElement).value
  wahl.value = { ...wahl.value, [feld]: feld === 'lauf' ? Number(wert) : wert }
  // Wer selbst wählt, sieht nicht mehr das gescannte Blatt.
  scanBeenden()
}

function zeige(typeId: string) {
  wahl.value = { ...wahl.value, liste: typeId }
  scanBeenden()
}

// ---- Scannen ----------------------------------------------------------------

/** Was der zuletzt gelesene Code bedeutet – gegen den Stand von jetzt. */
const scan = computed(() => {
  const s = scanStand.value
  if (!s) return null
  const k = konfig.value
  const lesung = leseCode(s.code, {
    kennung: state.value.kennung,
    regelwerk: state.value.regelwerk,
    aufbau: state.value.aufbau,
    regelwerke: k.getRegelwerke().map((r) => r.id),
    aufbauten: k.getAufbauten().map((a) => a.id),
    parcours: state.value.parcoursList.map((p) => p.id),
    listen: veranstaltungsListen(k, state.value),
    laufCount: state.value.laufCount,
  })
  if (!lesung.ok) return { code: s.code, fehler: lesung.fehler as QrFehler | { art: 'bogen' }, angaben: angabenZu(lesung.fehler) }
  const treffer = scanBogen(lesung.ziel, alle.value, (typeId) => k.getSheetDef(typeId).showLauf === false)
  const klassenText = lesung.ziel.klassen.map((x) => classLabel(x)).join(', ')
  if (!treffer) return { code: s.code, fehler: { art: 'bogen' as const }, angaben: { printed: klassenText } }
  const { ziel } = lesung
  const teile = [
    ziel.typeId ? titel.value.get(ziel.typeId) ?? treffer.bogen.titel : t('runsheet.title'),
    ...(state.value.parcoursList.length > 1 ? [treffer.bogen.parcoursName] : []),
    klassenText,
    t('lists.wkr.runN', { n: ziel.lauf }),
    ...(ziel.seite ? [t('scan.page', { n: ziel.seite })] : []),
  ]
  return { code: s.code, treffer, lauf: ziel.lauf, teile }
})

/** Namen statt Kennungen für die Meldung: Gedrucktes und Eingestelltes. */
function angabenZu(f: QrFehler) {
  const k = konfig.value
  if (f.art === 'veranstaltung') return { own: state.value.kennung }
  if (f.art === 'regelwerk') {
    const name = (rid: string) => k.getRegelwerke().find((r) => r.id === rid)?.label ?? rid
    return { printed: f.id ? name(f.id) : f.wert, current: name(state.value.regelwerk) }
  }
  if (f.art === 'aufbau') {
    const name = (aid: string) => k.getAufbauten().find((a) => a.id === aid)?.name ?? aid
    return { printed: f.id ? name(f.id) : f.wert, current: name(state.value.aufbau) }
  }
  if (f.art === 'lauf') return { runs: state.value.laufCount }
  return {}
}

/** Zum Bogen des Codes springen und den Cursor in seine erste Zelle stellen. */
async function springe() {
  const s = scanStand.value
  if (!s || scanErledigt.nr === s.nr) return
  // Nur einmal je Scan: Wer danach selbst wählt, die Ansicht wechselt und zurückkommt, bleibt bei seiner Wahl.
  scanErledigt.nr = s.nr
  const treffer = scan.value?.treffer
  if (!treffer) return
  wahl.value = { parcours: treffer.bogen.parcoursId, klasse: treffer.klasse, lauf: scan.value!.lauf, liste: treffer.bogen.typeId }
  // Die Tabelle wird für den neuen Bogen neu aufgebaut.
  await nextTick()
  await nextTick()
  const zelle = document.querySelector<HTMLInputElement>('.erf-panel .erf-tabelle tbody input.erf-feld')
  zelle?.focus()
  zelle?.scrollIntoView?.({ block: 'center' })
}
watch(() => scanStand.value?.nr, springe, { immediate: true })

// Scan-Feld: Handscanner mit Klick ins Feld, getippte oder eingefügte Kennung (Enter).
const scanText = ref('')
function scanAbschicken() {
  meldeScan(scanText.value)
  // Stehen lassen, was nicht erkannt wurde – zum Berichtigen.
  if (scan.value?.treffer) scanText.value = ''
}
function scanMitTab(e: KeyboardEvent) {
  // Manche Scanner schließen mit Tab statt Enter ab.
  if (!scanText.value.trim()) return
  e.preventDefault()
  scanAbschicken()
}

/** Zur nächsten Liste, die noch nicht fertig ist – sonst einfach zur nächsten. */
function weiter() {
  const i = boegen.value.findIndex((b) => b.id === bogen.value?.id)
  const danach = [...stand.value.slice(i + 1), ...stand.value.slice(0, i)]
  const ziel = danach.find((s) => s.erfasst < s.gesamt) ?? danach[0]
  if (ziel) wahl.value = { ...wahl.value, liste: ziel.bogen.typeId }
}
</script>

<template>
  <div class="panel">
    <h2>{{ t('capture.title') }}</h2>
    <p class="hint">{{ t('capture.hint') }}</p>

    <ScanHinweis v-if="scan" :code="scan.code" :teile="scan.teile" :geaendert="scan.treffer && !scan.treffer.genau" :fehler="scan.fehler" :angaben="scan.angaben" @schliessen="scanBeenden" />

    <p v-if="state.starters.length === 0" class="empty">{{ t('capture.empty') }}</p>
    <p v-else-if="alle.length === 0" class="boat-banner warn" role="status">
      {{ t('capture.noSheets') }} <a href="#/verzahnung">{{ t('nav.verzahnung') }}</a>
    </p>
    <template v-else>
      <EingabenHinweis />
      <p v-if="fehlend > 0 || doppelt > 0" class="boat-banner warn" role="alert">
        <template v-if="fehlend > 0">{{ tn('lists.missingNumbers', fehlend) }} </template>
        <template v-if="doppelt > 0">{{ tn('lists.duplicateNumbers', doppelt) }} </template>
        {{ t('capture.numbersNote') }}
      </p>
      <div class="row eingabe-wahl">
        <div v-if="state.parcoursList.length > 1" class="field">
          <label :for="`${id}-parcours`">{{ t('lists.wkr.parcours') }}</label>
          <select :id="`${id}-parcours`" class="input" data-feld="erf-parcours" :value="parcoursId" @change="setze('parcours', $event)">
            <option v-for="p in parcoursListe" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="field">
          <label :for="`${id}-klasse`">{{ t('lists.class') }}</label>
          <select :id="`${id}-klasse`" class="input" data-feld="erf-klasse" :value="klasse" @change="setze('klasse', $event)">
            <option v-for="k in klassen" :key="k" :value="k">{{ classLabel(k) }}</option>
          </select>
        </div>
        <div class="field">
          <label :for="`${id}-lauf`">{{ t('lists.wkr.run') }}</label>
          <select :id="`${id}-lauf`" class="input" data-feld="erf-lauf" :value="lauf" @change="setze('lauf', $event)">
            <option v-for="l in laeufe" :key="l" :value="l">{{ t('lists.wkr.runN', { n: l }) }}</option>
          </select>
        </div>
        <div class="field">
          <label :for="`${id}-liste`">{{ t('lists.wkr.list') }}</label>
          <select :id="`${id}-liste`" class="input" data-feld="erf-liste" :value="bogen?.typeId" @change="setze('liste', $event)">
            <option v-for="s in stand" :key="s.bogen.id" :value="s.bogen.typeId">{{ s.titel }}</option>
          </select>
        </div>
      </div>

      <!-- Überblick über den Lauf der Klasse: je Liste, wie viel abgetippt ist. -->
      <div class="eingabe-listen" role="group" :aria-label="t('capture.overview')">
        <button
          v-for="s in stand"
          :key="s.bogen.id"
          type="button"
          :class="['eingabe-chip', { aktiv: s.bogen.id === bogen?.id, fertig: s.gesamt > 0 && s.erfasst === s.gesamt }]"
          :aria-pressed="s.bogen.id === bogen?.id"
          :data-liste="s.bogen.typeId"
          @click="zeige(s.bogen.typeId)"
        >
          <span class="eingabe-chip-titel">{{ s.titel }}</span>
          <span class="eingabe-chip-zahl">{{ s.erfasst }}/{{ s.gesamt }}</span>
        </button>
      </div>
      <div class="row" style="align-items: center">
        <p class="note eingabe-summe" role="status" style="flex: 1; margin: 0">{{ t('capture.sum', { done: summe.erfasst, total: summe.gesamt, sheets: stand.length }) }}</p>
        <button type="button" class="btn" data-action="weiter" :disabled="stand.length < 2" @click="weiter">{{ t('capture.next') }} →</button>
      </div>
      <div class="scan-feld">
        <label :for="`${id}-scan`">{{ t('scan.label') }}</label>
        <input
          :id="`${id}-scan`"
          v-model="scanText"
          class="input"
          data-scan-feld
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          :placeholder="t('scan.placeholder')"
          @keydown.enter.prevent="scanAbschicken"
          @keydown.tab="scanMitTab"
        />
        <button type="button" class="btn" data-action="scan" :disabled="!scanText.trim()" @click="scanAbschicken">{{ t('scan.go') }}</button>
      </div>
      <p class="note">{{ t('scan.hint') }}</p>
      <p class="note">
        {{ t('capture.results') }} <a href="#/listen">{{ t('nav.listen') }}</a
        >.
      </p>
      <!-- Parallel-Slalom: eigener Wettkampf, eigener Aufbau – entsteht zuerst im Fehlerpunkte-Prototyp. -->
      <p v-if="parallel" class="boat-banner ok">
        {{ t('capture.parallel') }} <a :href="PROTOTYP_URL" target="_blank" rel="noopener">{{ t('event.parallelSetupLink') }}</a>
      </p>
    </template>
  </div>

  <div v-if="bogen" class="panel erf-panel">
    <ErfassungTabelle :key="bogen.id" :bogen="bogen" />
  </div>
</template>
