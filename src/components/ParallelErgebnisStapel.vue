<script setup lang="ts">
import { computed } from 'vue'
import { namenDerFassung } from '../lib/namen'
import { useStore } from '../state/store'
import { useEvent } from '../lib/event'
import { wertungDer } from '../lib/ergebnis'
import { attemptTabellen, rundenVermerke, type RundenAnsicht, type RundenBlatt, type RundenErgebnis } from '../lib/parallelErgebnis'
import { klassenStand, type StageBlatt } from '../lib/parallelStage'
import { useKonfig } from '../lib/konfig'
import { rundenDisziplin } from '../lib/parallelSchluessel'
import { rundenName, VORLAUF } from '../planung/parallelRunden'
import { originLabelKey, starterHerkunft } from '../lib/origin'
import { gesamtZeit, laeufeZeit } from '../lib/listenStand'
import ParallelStageBlatt from './ergebnis/ParallelStageBlatt.vue'
import { useListenSprache } from '../lib/listensprache'
import { PARALLEL } from '../config/catalog'
import { pokalVorgabe } from '../config/pokal'
import type { ClassId, ErgebnisFassung, ParallelRunde, Starter } from '../types'
import ErgebnisGesamtBlatt from './ergebnis/ErgebnisGesamtBlatt.vue'
import ParallelAttemptsBlatt from './ergebnis/ParallelAttemptsBlatt.vue'
import { DISZIPLIN_TEXT, nichtGewertet } from '../lib/disziplinen'

/**
 * Ein Stapel Wertungslisten des Parallelslaloms: je Blatt ein Dokument – die Liste der Attempts
 * einer Runde (zwei Tabellen), das Ergebnis einer Runde (lib/parallelErgebnis.ts
 * `rundenBlaetter`) oder das Ergebnis der Stage (lib/parallelStage.ts `stageBlaetter`) –, in
 * der Fassung „Aushang“ oder „Intern“. Was jede Fassung zeigt (Namen, Herkunft),
 * steht wie beim Manövrieren in den Einstellungen der Veranstaltung (ErgebnisStapel.vue). An
 * EINER Stelle für den Reiter „Wertungslisten“ (ParallelErgebnisListen.vue) und die Druckdatei
 * (DruckdateiListen.vue).
 *
 * `ansicht` teilt die Liste der Attempts nach Attempt oder nach Racecourse – nur eine Ansicht:
 * Werte, Plätze und der Zeitstempel bleiben dieselben.
 */
const props = defineProps<{
  blaetter: (RundenBlatt | StageBlatt)[]
  fassung: ErgebnisFassung
  ansicht: RundenAnsicht
}>()

const { state } = useStore()
const konfig = useKonfig()
const { regelwerk } = useEvent()
// Was auf den Blättern steht, folgt der Listensprache (`lt`).
const { listenLocale, kuerzelNorm, t: lt, formatDateTime: lDateTime } = useListenSprache()
const klasseText = (k: ClassId) => regelwerk.value.klassenNamen[k] ?? lt('common.class', { id: k })

// Das Ergebnis der Runde trägt den jüngsten Zeitpunkt der Klasse in der Runde (lib/listenStand.ts) –
// mit Sekunden, damit sich zwei Fassungen aus derselben Minute unterscheiden. Die Liste der
// Attempts nur den ihrer Attempts: Der Schalter „Disziplin nicht werten“ ändert das Ergebnis der
// Runde (UIM points), an den Attempts aber nichts – sie behält ihren Zeitpunkt.
const standVon = (e: RundenErgebnis) => lDateTime(gesamtZeit(state.value.listenStand, rundenDisziplin(e.runde), e.klasse), true)
const attemptsStand = (e: RundenErgebnis) => lDateTime(laeufeZeit(state.value.listenStand, rundenDisziplin(e.runde), e.klasse), true)

const eventName = computed(() => [lt('parallel.title'), [state.value.eventName, state.value.eventJahr].filter(Boolean).join(' ')].filter(Boolean).join(' · '))
const rundenTitel = (runde: ParallelRunde) => rundenName(runde, lt)
const titel = (e: RundenErgebnis, art: RundenBlatt['art']) => `${rundenTitel(e.runde)} – ${lt(art === 'attempts' ? 'parallel.results.attempts' : 'parallel.results.result')}`
// Das Ergebnis der Stage trägt den jüngsten Zeitpunkt aller Runden der Klasse: Jede von ihnen geht darin ein.
const juengster = (zeiten: string[]) => zeiten.reduce((a, b) => (b > a ? b : a), '')
const stageStand = (klasse: ClassId) => lDateTime(juengster((klassenStand(state.value, konfig.value, klasse)?.runden ?? []).map((r) => gesamtZeit(state.value.listenStand, rundenDisziplin(r.runde), klasse))), true)
const attemptText = (n: number) => (n === 1 ? lt('parallel.attempt.1') : n === 2 ? lt('parallel.attempt.2') : `${lt('parallel.attempt')} ${n}`)

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

// Die Spalte „UIM points“ (UIM 960, Pkt. 5.2.2), wenn das Regelwerk sie verlangt: die Punkte
// der Tabelle des Regelwerks (Pkt. 5.1) – oder, wer weiterfährt, wohin: „Qualified“ im Vorlauf,
// das Finale im Halbfinale, „Re-run“ bei einem Gleichstand an der Grenze. Erst, wenn die Klasse
// in der Runde vollständig ist (lib/parallelErgebnis.ts `rundenVermerke`).
const punkteTabelle = computed(() => pokalVorgabe(state.value.regelwerk).punkte.uim)
const uimPunkte = computed(() => (regelwerk.value.aushang.punkte ? punkteTabelle.value : undefined))
// „Disziplin nicht werten“ (Entscheidung des O.O.D., lib/disziplinen.ts): Wertet er den
// Parallelslalom für die Klasse nicht, entfallen auf seinen Listen der Klasse – Results jeder
// Runde und Overall results – die UIM points; Zeiten und Plätze bleiben, ein kurzer Hinweis
// sagt, warum (Entscheidung des Nutzers vom 15.11.2026). Sonst stünden in der Druckdatei UIM
// points einer Disziplin, die laut Einzelwertung nicht zählt. Wer weiterfährt, steht trotzdem
// da: „Qualified“ im Vorlauf (ebenso „Re-run“ und im Halbfinale das Finale) – die Spalte heißt
// dann „Remark“. Wo es nur Punkte gäbe (Finals, Wiederholung), entfällt sie ganz.
const ohnePunkte = (k: ClassId) => nichtGewertet(state.value.nichtWerten, 'parallel', k)
const MIT_VERMERK: readonly ParallelRunde[] = [VORLAUF, 'semi']
function punkteVon(e: RundenErgebnis) {
  if (!uimPunkte.value) return undefined
  const ohne = ohnePunkte(e.klasse)
  if (ohne && !MIT_VERMERK.includes(e.runde)) return undefined
  const titel = ohne ? lt('parallel.results.remark') : undefined
  const vermerke = rundenVermerke(e, uimPunkte.value)
  if (!vermerke) return { werte: null, titel }
  const text = { qualified: 'parallel.results.qualified', rerun: 'parallel.round.rerun', final: 'parallel.results.toFinal', final34: 'parallel.results.toFinal34' } as const
  return {
    werte: new Map(
      [...vermerke].flatMap(([id, v]): [string, number | string][] => (v.art === 'punkte' ? (ohne ? [] : [[id, v.punkte]]) : [[id, lt(text[v.art])]])),
    ),
    titel,
  }
}
const nichtGewertetText = (k: ClassId) => (ohnePunkte(k) ? lt('notScored.sheet', { discipline: lt(DISZIPLIN_TEXT.parallel) }) : '')
const fussVon = (e: RundenErgebnis) => [e.wiederholt.length > 0 ? lt('parallel.results.rerunNote') : '', nichtGewertetText(e.klasse)].filter(Boolean).join(' ') || undefined
// Was bei gleicher Summe entscheidet, in der Sprache der Liste (Pkt. 5.2.6) – steht dort ein
// Sternchen, hat es entschieden.
const stichAufListe = computed(() => {
  const kriterien = wertungDer(regelwerk.value, PARALLEL).stichentscheid
  const texte = kriterien.length === 1 && kriterien[0] === 'besterLauf' ? [lt('parallel.results.tie')] : kriterien.map((k) => lt(`results.tie.${k}`))
  return [lt('results.tie.mark'), ...texte].join(' ')
})
</script>

<template>
  <div class="ergebnis-stapel" data-stapel="parallel">
    <template v-for="b in blaetter" :key="b.key">
      <ParallelStageBlatt
        v-if="b.art === 'stage'"
        :klasse-text="klasseText(b.stage.klasse)"
        :titel="lt('parallel.stage.title')"
        :event-name="eventName"
        :zeilen="b.stage.nachPlatz"
        :unterschrift="regelwerk.aushang.unterschrift"
        :sprache="listenLocale"
        :data-klasse="b.stage.klasse"
        :herkunft="herkunft"
        :namen="namen"
        :stand="stageStand(b.stage.klasse)"
        :hinweis-text="nichtGewertetText(b.stage.klasse) || undefined"
        :ohne-punkte="ohnePunkte(b.stage.klasse)"
      />
      <ParallelAttemptsBlatt
        v-else-if="b.art === 'attempts'"
        :klasse-text="klasseText(b.ergebnis.klasse)"
        :titel="titel(b.ergebnis, 'attempts')"
        :event-name="eventName"
        :gruppen="b.ergebnis.laeufe[0]?.gruppen ?? []"
        :tabellen="attemptTabellen(b.ergebnis, ansicht, b.ordnung)"
        :unterschrift="regelwerk.aushang.unterschrift"
        :sprache="listenLocale"
        :data-ordnung="b.ordnung"
        :data-klasse="b.ergebnis.klasse"
        :herkunft="herkunft"
        :namen="namen"
        :stand="attemptsStand(b.ergebnis)"
      />
      <ErgebnisGesamtBlatt
        v-else
        :klasse-text="klasseText(b.ergebnis.klasse)"
        :event-name="eventName"
        :laeufe="b.ergebnis.gesamt.laeufe"
        :zeilen="b.ordnung === 'platz' ? b.ergebnis.gesamt.nachPlatz : b.ergebnis.gesamt.nachNummer"
        :sprache="listenLocale"
        :data-ordnung="b.ordnung"
        :data-klasse="b.ergebnis.klasse"
        :mit-knoten="false"
        :runde="{ titel: titel(b.ergebnis, 'result'), laufTitel: attemptText, racecourse: b.ergebnis.racecourse }"
        :punkte="punkteVon(b.ergebnis)"
        :unterschrift="regelwerk.aushang.unterschrift"
        :herkunft="herkunft"
        :namen="namen"
        :stand="standVon(b.ergebnis)"
        :stich-text="stichAufListe"
        :fuss-hinweis="fussVon(b.ergebnis)"
      />
    </template>
  </div>
</template>
