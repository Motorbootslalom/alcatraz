<script setup lang="ts">
import { computed } from 'vue'
import { namenDerFassung } from '../lib/namen'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { useEvent } from '../lib/event'
import type { PokalVariante } from '../config/pokal'
import { pokalStichText, type PokalWertung } from '../lib/pokalBlaetter'
import { herkunftAnzeige, originLabelKey } from '../lib/origin'
import { einzelZeit, wertungZeit } from '../lib/listenStand'
import { useListenSprache } from '../lib/listensprache'
import { rundenName } from '../planung/parallelRunden'
import { DISZIPLIN_TEXT, WERTUNGS_DISZIPLINEN } from '../lib/disziplinen'
import type { ClassId, ErgebnisFassung, OriginStyle } from '../types'
import PokalPlaetzeBlatt from './pokal/PokalPlaetzeBlatt.vue'
import PokalUimBlatt from './pokal/PokalUimBlatt.vue'

/**
 * Die Blätter der Mannschaftswertung: je Variante ein Dokument mit eigener Seitenteilung und
 * Seitenzahl. Gerechnet ist schon (lib/pokalBlaetter.ts `usePokalWertung`) – der Reiter
 * „Mannschaftswertung“ (PokalListen.vue) und die Druckdatei (DruckdateiListen.vue) reichen
 * ihre Wertung herein und bekommen dieselben Blätter.
 */
const props = defineProps<{
  pokal: PokalWertung
  /** Namen auf der UIM-Liste wie auf den Wertungslisten: Aushang nach den Einstellungen, intern immer voll. */
  fassung: ErgebnisFassung
  /** Wie die Herkunft dasteht (ausgeschrieben, Kürzel, Flagge). */
  herkunft: OriginStyle
  /** Nur diese Varianten, in dieser Reihenfolge; fehlt = alle Blätter der Wertung in der Reihenfolge der Einstellungen. */
  nur?: readonly PokalVariante[]
}>()

const { state } = useStore()
const konfig = useKonfig()
const { regelwerk } = useEvent()
// Was auf den Blättern steht, folgt der Listensprache (`lt`).
const { listenLocale, kuerzelNorm, t: lt, formatDateTime: lDateTime } = useListenSprache()
const klasseText = (k: ClassId) => regelwerk.value.klassenNamen[k] ?? lt('common.class', { id: k })
const klasseKurz = (k: ClassId) => regelwerk.value.klassenNamen[k] ?? k

// Die Erklärung zum Sternchen am Platz – wie auf den Wertungslisten: „Platz durch Stichentscheid.“ und die Regel.
const stichText = computed(() => (props.pokal.regeln.stich ? `${lt('results.tie.mark')} ${pokalStichText(props.pokal.regeln.stich, lt)}` : ''))

const blaetter = computed(() => (props.nur === undefined ? props.pokal.blaetter : props.nur.filter((v) => props.pokal.blaetter.includes(v))))
const eventName = computed(() => [state.value.eventName, state.value.eventJahr].filter(Boolean).join(' '))
const herkunftTitel = computed(() => lt(originLabelKey(state.value.originMode)))
// Was dasteht (Text, Kürzel, Flagge), entscheidet lib/origin.ts – für alle Listen gleich.
const herkunftVon = (name: string) => herkunftAnzeige(name, state.value.originMode, props.herkunft, state.value.originShort, listenLocale.value, false, kuerzelNorm.value)
const namen = computed(() => namenDerFassung(props.fassung, state.value))
// Der Zeitpunkt der Mannschaftswertung ist der jüngste der Gesamtlisten aller Klassen – für
// jede Variante derselbe, mit Sekunden wie auf den Wertungslisten (lib/listenStand.ts).
const disziplin = computed(() => konfig.value.getAufbau(state.value.aufbau).disziplin)
const stand = computed(() => lDateTime(wertungZeit(state.value.listenStand, disziplin.value), true))
// Rechnet die Wertung nach UIM-Punkten aus der Einzelwertung, gehen auch die Runden des
// Parallelslaloms in sie ein: Sie trägt dann den jüngsten Zeitpunkt über beide Disziplinen.
const standUim = computed(() => (props.pokal.ausEinzel ? lDateTime(einzelZeit(state.value.listenStand, disziplin.value), true) : stand.value))
// Unter Regel 960 zählen für die Mannschaftswertung die Ergebnisse der „overall individual
// competitions“ (Pkt. 5.1, 5.2.4): die Punkte der Disziplinen, die gefahren sind – eine Disziplin
// zählt, sobald zu ihr der erste Wert erfasst ist (lib/disziplinen.ts). Ist erst eine gefahren,
// sagt das Blatt, welche; welche der O.O.D. für welche Klassen nicht wertet, ebenfalls. Auf dem
// Blatt steht nie die Nummer einer Stage, nur der Name der Disziplin.
const disziplinName = (d: (typeof WERTUNGS_DISZIPLINEN)[number]) => lt(DISZIPLIN_TEXT[d])
const disziplinenText = computed(() => (props.pokal.uimRegel && props.pokal.gefahren.length > 1 ? props.pokal.gefahren.map(disziplinName).join(' + ') : ''))
const grundlage = computed(() => {
  if (!props.pokal.uimRegel) return ''
  const nur = props.pokal.gefahren.length === 1 ? props.pokal.gefahren[0] : undefined
  const andere = WERTUNGS_DISZIPLINEN.find((d) => d !== nur)
  const eine = nur && andere ? lt('cup.uim.only', { discipline: disziplinName(nur), other: disziplinName(andere) }) : ''
  const liste = props.pokal.gestrichen.map((g) => `${disziplinName(g.disziplin)} – ${g.alle ? lt('notScored.allClasses') : g.klassen.map(klasseText).join(', ')}`).join('; ')
  return [eine, liste ? lt('notScored.team', { list: liste }) : ''].filter(Boolean).join(' ')
})
// Die Wertungen nach Plätzen lesen nur die Gesamtlisten des Manövrierens: Wertet der O.O.D. es
// für Klassen nicht, fehlen diese dort – das Blatt sagt, welche.
const grundlagePlaetze = computed(() => {
  const m = props.pokal.gestrichen.find((g) => g.disziplin === 'manoever')
  return m ? lt('notScored.team', { list: `${disziplinName('manoever')} – ${m.alle ? lt('notScored.allClasses') : m.klassen.map(klasseText).join(', ')}` }) : ''
})
// Der Hinweis zum Zwischenstand nennt je offener Klasse, woran es hängt: am Manövrieren (Läufe
// und Starter, lib/pokalBlaetter.ts `offenText`) oder – ist das fertig – an einer Runde des
// Parallelslaloms.
const offenUim = (k: ClassId) => {
  const runde = props.pokal.offeneRunde(k)
  return runde === undefined ? props.pokal.offenText(k) : `${klasseKurz(k)}: ${rundenName(runde, lt)}`
}
</script>

<template>
  <div class="ergebnis-stapel">
    <template v-for="v in blaetter" :key="v">
      <PokalUimBlatt
        v-if="v === 'uim'"
        :wertung="pokal.wertungen.uim!"
        :event-name="eventName"
        :herkunft-titel="herkunftTitel"
        :herkunft-anzeige="herkunftVon"
        :klasse-kurz="klasseKurz"
        :klasse-text="klasseText"
        :namen="namen"
        :offen-text="offenUim"
        :stich-text="stichText"
        :stand="standUim"
        :sprache="listenLocale"
        :unterschrift="regelwerk.aushang.unterschrift"
        :hinweis="grundlage"
        :aus-einzel="pokal.ausEinzel"
        :disziplinen-text="disziplinenText"
      />
      <PokalPlaetzeBlatt
        v-else
        :wertung="pokal.wertungen[v]!"
        :punkte="pokal.regeln.punkte[v]"
        :event-name="eventName"
        :herkunft-titel="herkunftTitel"
        :herkunft-anzeige="herkunftVon"
        :klasse-text="klasseText"
        :offen-text="pokal.offenText"
        :stich-text="stichText"
        :stand="stand"
        :sprache="listenLocale"
        :unterschrift="regelwerk.aushang.unterschrift"
        :hinweis="grundlagePlaetze || undefined"
        :data-variante="v"
      />
    </template>
  </div>
</template>
