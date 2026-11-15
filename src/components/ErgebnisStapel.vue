<script setup lang="ts">
import { computed } from 'vue'
import { namenDerFassung } from '../lib/namen'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { useEvent } from '../lib/event'
import type { AbstandArt } from '../lib/ergebnis'
import type { ErgebnisBlatt } from '../lib/ergebnisBlaetter'
import { originLabelKey, starterHerkunft } from '../lib/origin'
import { gesamtZeit, laufListenSchluessel, standZeit } from '../lib/listenStand'
import { useListenSprache } from '../lib/listensprache'
import type { ClassId, ErgebnisFassung, Starter } from '../types'
import ErgebnisGesamtBlatt from './ergebnis/ErgebnisGesamtBlatt.vue'
import ErgebnisLaufBlatt from './ergebnis/ErgebnisLaufBlatt.vue'

/**
 * Ein Stapel Ergebnislisten: je Blatt (lib/ergebnisBlaetter.ts) ein Dokument, in der Fassung
 * „Aushang“ oder „Intern“. Was jede Fassung zeigt (Namen, Herkunft), steht in den
 * Einstellungen der Veranstaltung – an EINER Stelle für den Reiter „Ergebnislisten“
 * (ErgebnisListen.vue) und die Druckdatei (DruckdateiListen.vue).
 */
const props = defineProps<{
  blaetter: ErgebnisBlatt[]
  fassung: ErgebnisFassung
  abstand?: AbstandArt
}>()

const { state } = useStore()
const konfig = useKonfig()
const { regelwerk } = useEvent()
// Was auf den Blättern steht, folgt der Listensprache (`lt`).
const { listenLocale, t: lt, formatDateTime: lDateTime } = useListenSprache()
const klasseText = (k: ClassId) => regelwerk.value.klassenNamen[k] ?? lt('common.class', { id: k })

// Wann sich eine Liste zuletzt geändert hat – mit Sekunden, damit sich zwei Fassungen aus derselben Minute unterscheiden.
const disziplin = computed(() => konfig.value.getAufbau(state.value.aufbau).disziplin)
// Die Gesamtliste trägt den jüngsten Zeitpunkt der Läufe ihrer Klasse (oder ihren eigenen: Knoten, Streichläufe).
const standVon = (b: ErgebnisBlatt) =>
  lDateTime(
    b.liste ? standZeit(state.value.listenStand, laufListenSchluessel(disziplin.value, b.ergebnis.klasse, b.liste.lauf)) : gesamtZeit(state.value.listenStand, disziplin.value, b.ergebnis.klasse),
    true,
  )

const eventName = computed(() => [state.value.eventName, state.value.eventJahr].filter(Boolean).join(' '))
// Zwei Fassungen: „Aushang“ (öffentlich) und „Intern“. Was jede zeigt, steht in den
// Einstellungen: Namen voll, gekürzt oder gar nicht (nur Aushang); Herkunft nicht, als
// Kürzel oder ausgeschrieben.
const namen = computed(() => namenDerFassung(props.fassung, state.value))
const herkunftArt = computed(() => state.value.ergebnisListen[props.fassung].herkunft)
// Was je Starter dasteht (Text, Kürzel, Flagge), entscheidet lib/origin.ts – für alle Listen gleich.
const herkunftVon = (p: Starter) => starterHerkunft(p, state.value.originMode, herkunftArt.value === 'aus' ? 'kurz' : herkunftArt.value, state.value.originShort, listenLocale.value)
const herkunft = computed(() =>
  state.value.originMode === 'none' || herkunftArt.value === 'aus'
    ? undefined
    : {
        titel: lt(originLabelKey(state.value.originMode)),
        anzeige: herkunftVon,
        // Ohne Kürzel steht der volle Name da: Die Spalte wird dann so breit wie der längste (in Grenzen).
        // Eine Flagge zählt mit ihrer Breite mit (`mass`).
        zeichen: Math.max(0, ...state.value.starters.map((p) => herkunftVon(p).mass.length)),
      },
)
// Was bei gleichen Punkten entscheidet, in der Sprache der Liste: nur die Kriterien – steht
// dort ein Sternchen, hat eines von ihnen entschieden.
const stichAufListe = computed(() => [lt('results.tie.mark'), ...regelwerk.value.stichentscheid.map((k) => lt(`results.tie.${k}`))].join(' '))
</script>

<template>
  <div class="ergebnis-stapel">
    <template v-for="b in blaetter" :key="b.key">
      <ErgebnisGesamtBlatt
        v-if="!b.liste"
        :klasse-text="klasseText(b.ergebnis.klasse)"
        :event-name="eventName"
        :laeufe="b.ergebnis.gesamt.laeufe"
        :zeilen="b.ordnung === 'platz' ? b.ergebnis.gesamt.nachPlatz : b.ergebnis.gesamt.nachNummer"
        :sprache="listenLocale"
        :data-ordnung="b.ordnung"
        :mit-knoten="b.ergebnis.gesamt.mitKnoten"
        :abstand="abstand"
        :herkunft="herkunft"
        :namen="namen"
        :stand="standVon(b)"
        :stich-text="stichAufListe"
      />
      <ErgebnisLaufBlatt
        v-else
        :klasse-text="klasseText(b.ergebnis.klasse)"
        :lauf-text="lt('lists.wkr.runN', { n: b.liste.lauf })"
        :event-name="eventName"
        :gruppen="b.liste.gruppen"
        :zeilen="b.ordnung === 'platz' ? b.liste.nachPlatz : b.liste.nachNummer"
        :sprache="listenLocale"
        :data-ordnung="b.ordnung"
        :abstand="abstand"
        :herkunft="herkunft"
        :namen="namen"
        :stand="standVon(b)"
        :stich-text="stichAufListe"
      />
    </template>
  </div>
</template>
