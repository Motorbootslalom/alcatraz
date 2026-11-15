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
import { pokalVorgabe } from '../config/pokal'
import { gesamtPunkte } from '../lib/pokal'
import type { ClassId, ErgebnisFassung, Starter } from '../types'
import ErgebnisGesamtBlatt from './ergebnis/ErgebnisGesamtBlatt.vue'
import ErgebnisLaufBlatt from './ergebnis/ErgebnisLaufBlatt.vue'
import { DISZIPLIN_TEXT, nichtGewertet } from '../lib/disziplinen'

/**
 * Ein Stapel Wertungslisten: je Blatt (lib/ergebnisBlaetter.ts) ein Dokument, in der Fassung
 * „Aushang“ oder „Intern“. Was jede Fassung zeigt (Namen, Herkunft), steht in den
 * Einstellungen der Veranstaltung – an EINER Stelle für den Reiter „Wertungslisten“
 * (ErgebnisListen.vue) und die Druckdatei (DruckdateiListen.vue).
 */
const props = defineProps<{
  blaetter: ErgebnisBlatt[]
  fassung: ErgebnisFassung
  abstand?: AbstandArt
}>()

const { state } = useStore()
const konfig = useKonfig()
const { regelwerk, parallel } = useEvent()
// Was auf den Blättern steht, folgt der Listensprache (`lt`).
const { listenLocale, kuerzelNorm, t: lt, formatDateTime: lDateTime } = useListenSprache()
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
const herkunftVon = (p: Starter) => starterHerkunft(p, state.value.originMode, herkunftArt.value === 'aus' ? 'kurz' : herkunftArt.value, state.value.originShort, listenLocale.value, kuerzelNorm.value)
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
// Die Spalte „UIM points“ der Gesamtliste, wenn das Regelwerk sie verlangt (UIM 960, Pkt.
// 5.2.1). Die Punkte sind die der Tabelle des Regelwerks (Pkt. 5.1) – dieselbe, nach der die
// Mannschaftswertung rechnet; sie stehen erst da, wenn die Klasse vollständig ist. Dieselbe
// Liste nach Pkt. 5.2.1 hat keine Spalte „Result“ (bester Versuch ohne Knoten; Entscheidung
// des Nutzers vom 15.11.2026) – auch nicht, wenn die Punkte nach „nicht werten“ entfallen.
const uimPunkte = computed(() => (regelwerk.value.aushang.punkte ? pokalVorgabe(state.value.regelwerk).punkte.uim : undefined))
// „Disziplin nicht werten“ (nur nach Regel 960; Entscheidung des O.O.D., lib/disziplinen.ts):
// Wertet er das Manövrieren für die Klasse nicht, entfällt auf ihrer Gesamtliste die Spalte
// „UIM points“ – Zeiten und Plätze bleiben –, und ein kurzer Hinweis sagt, warum (Entscheidung
// des Nutzers vom 15.11.2026). Unter der DM gibt es den Schalter nicht.
const nichtGewertetFuer = (klasse: ClassId) => parallel.value && nichtGewertet(state.value.nichtWerten, 'manoever', klasse)
const punkteVon = (b: ErgebnisBlatt) =>
  uimPunkte.value && !nichtGewertetFuer(b.ergebnis.klasse) ? { werte: gesamtPunkte(b.ergebnis.gesamt, state.value.laufCount, uimPunkte.value) } : undefined
const fussHinweis = (b: ErgebnisBlatt) => (nichtGewertetFuer(b.ergebnis.klasse) ? lt('notScored.sheet', { discipline: lt(DISZIPLIN_TEXT.manoever) }) : undefined)
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
        :data-klasse="b.ergebnis.klasse"
        :mit-knoten="b.ergebnis.gesamt.mitKnoten"
        :punkte="punkteVon(b)"
        :ohne-ergebnis="regelwerk.aushang.punkte"
        :unterschrift="regelwerk.aushang.unterschrift"
        :abstand="abstand"
        :herkunft="herkunft"
        :namen="namen"
        :stand="standVon(b)"
        :stich-text="stichAufListe"
        :fuss-hinweis="fussHinweis(b)"
      />
      <ErgebnisLaufBlatt
        v-else
        :klasse-text="klasseText(b.ergebnis.klasse)"
        :lauf-text="lt('lists.wkr.runN', { n: b.liste.lauf })"
        :event-name="eventName"
        :gruppen="b.liste.gruppen"
        :unterschrift="regelwerk.aushang.unterschrift"
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
