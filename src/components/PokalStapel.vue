<script setup lang="ts">
import { computed } from 'vue'
import { namenDerFassung } from '../lib/namen'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { useEvent } from '../lib/event'
import type { PokalVariante } from '../config/pokal'
import type { PokalWertung } from '../lib/pokalBlaetter'
import { herkunftAnzeige, originLabelKey } from '../lib/origin'
import { wertungZeit } from '../lib/listenStand'
import { useListenSprache } from '../lib/listensprache'
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
  /** Namen auf der UIM-Liste wie auf den Ergebnislisten: Aushang nach den Einstellungen, intern immer voll. */
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
const { listenLocale, t: lt, formatDateTime: lDateTime } = useListenSprache()
const klasseText = (k: ClassId) => regelwerk.value.klassenNamen[k] ?? lt('common.class', { id: k })
const klasseKurz = (k: ClassId) => regelwerk.value.klassenNamen[k] ?? k

const blaetter = computed(() => (props.nur === undefined ? props.pokal.blaetter : props.nur.filter((v) => props.pokal.blaetter.includes(v))))
const eventName = computed(() => [state.value.eventName, state.value.eventJahr].filter(Boolean).join(' '))
const herkunftTitel = computed(() => lt(originLabelKey(state.value.originMode)))
// Was dasteht (Text, Kürzel, Flagge), entscheidet lib/origin.ts – für alle Listen gleich.
const herkunftVon = (name: string) => herkunftAnzeige(name, state.value.originMode, props.herkunft, state.value.originShort, listenLocale.value)
const namen = computed(() => namenDerFassung(props.fassung, state.value))
// Der Zeitpunkt der Mannschaftswertung ist der jüngste der Gesamtlisten aller Klassen – für
// jede Variante derselbe, mit Sekunden wie auf den Ergebnislisten (lib/listenStand.ts).
const disziplin = computed(() => konfig.value.getAufbau(state.value.aufbau).disziplin)
const stand = computed(() => lDateTime(wertungZeit(state.value.listenStand, disziplin.value), true))
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
        :offen-text="pokal.offenText"
        :stand="stand"
        :sprache="listenLocale"
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
        :stand="stand"
        :sprache="listenLocale"
        :data-variante="v"
      />
    </template>
  </div>
</template>
