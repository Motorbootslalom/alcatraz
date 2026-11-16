<script setup lang="ts">
import { computed, reactive, ref, watch, watchEffect } from 'vue'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { useBogenZoom } from '../lib/bogenZoom'
import { zettelSchritte } from '../lib/laufzettel'
import { schrittIn, schrittText } from '../lib/laufzettelText'
import { messKennungRunde, parallelBoegen, rundenSeitenzahl, rundenZettel, type RundenZettel } from '../lib/parallelBogen'
import type { Racecourse } from '../lib/parallelSchluessel'
import type { ParallelRunde } from '../types'
import { rundenName } from '../planung/parallelRunden'
import { t, tn } from '../i18n'
import { adresse } from '../lib/router'
import { useListenSprache } from '../lib/listensprache'
import LaufzettelBlatt from './LaufzettelBlatt.vue'
import ParallelMessung from './ParallelMessung.vue'

/**
 * Die Laufzettel des Parallelslaloms unter „Listen“: je Runde (statt je Klasse und Lauf) immer
 * zwei, einer je Racecourse (Entscheidung des Nutzers vom 15.11.2026, abends). Er dient dazu,
 * die richtigen Blätter einzusammeln und zusammenzuhalten – ein Kästchen je gedrucktem Blatt
 * seiner drei Listen (lib/parallelBogen.ts `rundenZettel`). Sein QR-Code führt in der Erfassung
 * nur zu den Listen seines Racecourse, untereinander. Die Schritte der Auswertung stehen nur auf
 * Zettel A: Die Runde wird einmal ausgewertet. Zettel B verweist darauf (Entscheidung 16.11.2026),
 * damit niemand mit Zettel B die Schritte sucht.
 *
 * Passen die Kästchen auch dicht gesetzt nicht auf einen Zettel, sagt es der Zettel selbst
 * (components/LaufzettelBlatt.vue `zuviel`) – nichts wird zu Seitenbereichen zusammengefasst.
 *
 * Die Seitenzahlen sind gemessen (components/ParallelMessung.vue): Jede Liste teilt für sich,
 * die Zeit-Liste hat deshalb weniger Blätter als Steg und Fahrweg – und je Racecourse, weil die
 * Sprache des Bogens dort gilt (zweisprachig braucht mehr Platz).
 *
 * Arbeitsschritte: die der Zettel zwischen den Läufen, mit dem Aushang – nach einer Runde wird
 * ausgehängt, wer weiterkommt; „Ausgehangen“ (zentrale Tafel) und „An die ML geschickt“ (PDF
 * per Messenger) sind zwei getrennte Schritte. Das ist Organisation; Regel 960 verlangt den
 * Aushang je Stage (Pkt. 5.2).
 */
const props = defineProps<{ gesperrt?: boolean }>()
const emit = defineEmits<{ stand: [stand: { anzahl: number; auswahl: string }] }>()

const { state } = useStore()
const konfig = useKonfig()
const { listenLocale, t: lt } = useListenSprache()

const parallel = computed(() => parallelBoegen(state.value, konfig.value))
/** Gemessen je Racecourse und Liste: so viele Tabellenzeilen passen auf ihr Blatt (fehlt = unbekannt). */
const kapazitaeten = ref<Record<string, number>>({})
const seitenVon = (runde: ParallelRunde, typeId: string, racecourse: Racecourse) =>
  rundenSeitenzahl(state.value.parallelPlaene[runde]!, kapazitaeten.value[messKennungRunde({ racecourse, typeId })] ?? 0, {
    zeilenJeSeite: state.value.wkrZeilenJeSeite,
    teilenAb: state.value.wkrTeilenAb,
  })
const zettel = computed(() => (props.gesperrt ? [] : rundenZettel(state.value, parallel.value, seitenVon)))
watchEffect(() => emit('stand', { anzahl: zettel.value.length, auswahl: t('parallel.title') }))

const eventName = computed(() => [state.value.eventName, state.value.eventJahr].filter(Boolean).join(' '))
const titel = computed(() => [lt('runsheet.title'), eventName.value].filter(Boolean).join(' · '))
const blaetter = computed(() =>
  zettel.value.map((z) => ({
    zettel: z,
    zeilen: z.listen.map((liste) => ({
      key: liste.typeId,
      // Der Name der Liste wie im Kopf ihres Bogens, in der Sprache des Regelwerks.
      label: konfig.value.getSheetDef(liste.typeId).title,
      // Der Racecourse steht auf dem Rücken, nicht an jedem Kästchen.
      gruppen: liste.boegen.map((b) => ({ key: b.bogenId, seiten: b.seiten })),
    })),
  })),
)
const schritte = computed(() => {
  const config = konfig.value.getLaufzettelConfig()
  return {
    titel: config.titel ? schrittText(config.titel, lt) : undefined,
    liste: zettelSchritte(config, { letzterLauf: false }, false).map((s) => schrittIn(s, listenLocale.value, lt)),
  }
})

/** Zettel, deren Kästchen auch dicht gesetzt nicht passen: Darüber steht die Warnung. */
const zuViel = reactive(new Set<string>())
watch(zettel, (alle) => {
  for (const id of [...zuViel]) if (!alle.some((z) => z.id === id)) zuViel.delete(id)
})
function merkeZuViel(z: RundenZettel, ja: boolean) {
  if (ja) zuViel.add(z.id)
  else zuViel.delete(z.id)
}
const racecourseText = (z: RundenZettel) => lt(z.racecourse === 'A' ? 'parallel.parcoursA' : 'parallel.parcoursB')

const stapel = ref<HTMLElement | null>(null)
const { zoom } = useBogenZoom(stapel)
</script>

<template>
  <div v-if="!gesperrt" class="panel no-print laufzettel-wahl" data-listen="parallel">
    <p class="hint">{{ t('parallel.runsheet.hint') }}</p>
    <p v-if="parallel.boegen.length === 0" class="boat-banner warn" role="status" data-hinweis="parallel-plan">
      {{ t('parallel.lists.needPlan') }} <a :href="adresse('verzahnung', { reiter: 'parallel' })">{{ t('nav.verzahnung') }} → {{ t('parallel.title') }}</a>
    </p>
    <template v-else>
      <p class="note wkr-listen-stand" role="status">{{ tn('runsheet.count', zettel.length) }}</p>
      <p v-if="zuViel.size > 0" class="boat-banner warn" role="status" data-hinweis="lz-zuviel">
        {{ tn('runsheet.overflowNote', zuViel.size) }}
        <template v-if="state.laufzettelLayout !== 'liste'">{{ t('runsheet.overflowFix') }} <a :href="adresse('einstellungen')">{{ t('nav.einstellungen') }}</a>.</template>
      </p>
      <p class="note">{{ t('runsheet.print') }}</p>
      <p class="note">{{ t('runsheet.scan') }} <a :href="adresse('erfassung')">{{ t('nav.erfassung') }}</a>.</p>
    </template>
  </div>

  <div ref="stapel" class="laufzettel-stapel" :style="zoom">
    <LaufzettelBlatt
      v-for="b in blaetter"
      :key="b.zettel.id"
      :klassen-text="rundenName(b.zettel.runde, lt)"
      :lauf-text="lt('parallel.title')"
      :parcours="racecourseText(b.zettel)"
      :titel="titel"
      :zeilen="b.zeilen"
      :layout="state.laufzettelLayout"
      :qr="b.zettel.qr"
      :schritte-titel="b.zettel.schritte ? schritte.titel : undefined"
      :schritte="b.zettel.schritte ? schritte.liste : []"
      :schritte-verweis="b.zettel.schritte ? undefined : lt('runsheet.stepsElsewhere', { zettel: lt('parallel.parcoursA') })"
      :sprache="listenLocale"
      :data-zettel="b.zettel.id"
      @zuviel="merkeZuViel(b.zettel, $event)"
    />
  </div>
  <ParallelMessung v-if="!gesperrt" :boegen="parallel.boegen" @kapazitaeten="kapazitaeten = $event" />
</template>
