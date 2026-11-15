<script setup lang="ts">
import { computed } from 'vue'
import { namenDerFassung } from '../lib/namen'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { useEvent } from '../lib/event'
import type { EinzelBlatt, EinzelErgebnis } from '../lib/einzelwertung'
import { originLabelKey, starterHerkunft } from '../lib/origin'
import { einzelZeit } from '../lib/listenStand'
import { useListenSprache } from '../lib/listensprache'
import { DISZIPLIN_TEXT } from '../lib/disziplinen'
import type { ClassId, ErgebnisFassung, Starter } from '../types'
import EinzelwertungBlatt from './ergebnis/EinzelwertungBlatt.vue'

/**
 * Ein Stapel Listen der Einzelwertung („Individual competition“, Regel 960,
 * Pkt. 5.2.3): je Klasse ein Dokument (lib/einzelwertung.ts `einzelBlaetter`), in der Fassung
 * „Aushang“ oder „Intern“. Was jede Fassung zeigt (Namen, Herkunft), steht wie bei den anderen
 * Wertungslisten in den Einstellungen der Veranstaltung. An EINER Stelle für den Reiter
 * „Wertungslisten“ (EinzelwertungListen.vue) und die Druckdatei (DruckdateiListen.vue).
 */
const props = defineProps<{
  blaetter: EinzelBlatt[]
  fassung: ErgebnisFassung
}>()

const { state } = useStore()
const konfig = useKonfig()
const { regelwerk } = useEvent()
// Was auf den Blättern steht, folgt der Listensprache (`lt`).
const { listenLocale, kuerzelNorm, t: lt, formatDateTime: lDateTime } = useListenSprache()
const klasseText = (k: ClassId) => regelwerk.value.klassenNamen[k] ?? lt('common.class', { id: k })

// Die Einzelwertung trägt den jüngsten Zeitpunkt der Klasse in beiden Disziplinen (lib/listenStand.ts):
// Jede Liste des Manövrierens und jede Runde des Parallelslaloms geht in sie ein.
const disziplin = computed(() => konfig.value.getAufbau(state.value.aufbau).disziplin)
const standVon = (klasse: ClassId) => lDateTime(einzelZeit(state.value.listenStand, disziplin.value, klasse), true)

const eventName = computed(() => [state.value.eventName, state.value.eventJahr].filter(Boolean).join(' '))
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
        zeichen: Math.max(0, ...state.value.starters.map((p) => herkunftVon(p).mass.length)),
      },
)
// Was bei gleichen Punkten entscheidet, in der Sprache der Liste (Pkt. 5.2.6) – steht dort ein
// Sternchen, hat es entschieden.
// Ohne Sternchen (voller Gleichstand, fehlende Zeit) steht die Regel trotzdem im Fuß, mit dem
// Zusatz zum geteilten Platz: Sonst sagte der Aushang nicht, was die Spalte der Zeit ist, warum
// dort ein Strich steht und warum zwei denselben Platz haben.
// Die Regel nennt nur die Disziplinen, die für die Klasse zählen: Ist nur eine gefahren (oder
// die andere nicht gewertet), entscheidet deren Zeit allein.
const regelVon = (e: EinzelErgebnis) => lt(e.disziplinen.length === 1 ? `individual.tie.${e.disziplinen[0]}` : 'individual.tie')
const stichAufListe = (e: EinzelErgebnis) => `${lt('results.tie.mark')} ${regelVon(e)}`
// „Disziplin nicht werten“ (Entscheidung des O.O.D.): Die Liste sagt, was ihr fehlt.
const hinweisVon = (e: EinzelErgebnis) => e.gestrichen.map((d) => lt('notScored.sheet', { discipline: lt(DISZIPLIN_TEXT[d]) })).join(' ')
</script>

<template>
  <div class="ergebnis-stapel" data-stapel="einzel">
    <EinzelwertungBlatt
      v-for="b in blaetter"
      :key="b.key"
      :klasse-text="klasseText(b.einzel.klasse)"
      :titel="lt('individual.title')"
      :event-name="eventName"
      :zeilen="b.einzel.nachPlatz"
      :unterschrift="regelwerk.aushang.unterschrift"
      :sprache="listenLocale"
      :data-klasse="b.einzel.klasse"
      :herkunft="herkunft"
      :namen="namen"
      :stand="standVon(b.einzel.klasse)"
      :disziplinen="b.einzel.disziplinen"
      :hinweis-text="hinweisVon(b.einzel)"
      :stich-text="stichAufListe(b.einzel)"
      :regel-text="regelVon(b.einzel)"
      :geteilt-text="lt('individual.tieShared')"
    />
  </div>
</template>
