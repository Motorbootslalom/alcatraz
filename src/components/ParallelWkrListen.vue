<script setup lang="ts">
import { computed, ref, useId, watchEffect } from 'vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import { useAuswahlKonfig, useBogenKonfig, useKonfig } from '../lib/konfig'
import { useBogenZoom } from '../lib/bogenZoom'
import { parallelBoegen, waehleRundenBoegen, type ParallelAuswahl } from '../lib/parallelBogen'
import { RACECOURSE_PARCOURS, RACECOURSES, type Racecourse } from '../lib/parallelSchluessel'
import { rundenName as rundenNameIn } from '../planung/parallelRunden'
import { t, tn } from '../i18n'
import { adresse } from '../lib/router'
import type { ParallelRunde } from '../types'
import BogenBlatt from './bogen/BogenBlatt.vue'

/**
 * Die Wettkampfrichter-Listen des Parallelslaloms unter „Listen“: je Runde sechs Listen – je
 * Racecourse A und B Zeit, Steg und Fahrweg –, klassenübergreifend in der Reihenfolge des
 * festgeschriebenen Plans (lib/parallelBogen.ts). Die Bildschirmansicht ist die Druckansicht;
 * gedruckt wird, was die Auswahl zeigt.
 *
 * Ohne festgeschriebenen Plan gibt es keine Liste, nur den Hinweis: Ein Plan, der dem
 * Starterfeld noch folgt, stünde nach der nächsten Änderung anders da als auf dem Papier.
 *
 * Jede Liste teilt für sich, auf so wenige Seiten wie möglich und ausgeglichen (lib/parallelBogen.ts): Die Zeit-Liste fasst
 * mehr Starts als die Listen mit Legende. Eine Seite endet nur am Ende eines Blocks.
 *
 * `gesperrt`: Startnummern fehlen oder sind doppelt (ListsView.vue zeigt den Hinweis).
 */
const props = defineProps<{ gesperrt?: boolean }>()
const emit = defineEmits<{
  /** Wie viele Bögen die Auswahl zeigt und wie sie heißt (für Fenstertitel und Dateiname). */
  stand: [stand: { anzahl: number; auswahl: string }]
}>()

const { state } = useStore()
const konfig = useKonfig()
// Jeder Bogen in der Sprache seiner Liste auf seinem Racecourse; die Auswahl nennt eine Liste so,
// wenn A und B dieselbe Sprache haben, sonst in der des Regelwerks (lib/konfig.ts).
const bogenKonfig = useBogenKonfig()
const auswahlKonfig = useAuswahlKonfig()
const id = useId()

const parallel = computed(() => parallelBoegen(state.value, konfig.value, (typeId, parcoursId) => bogenKonfig(typeId, parcoursId).getSheetDef(typeId).title))
const alle = computed(() => parallel.value.boegen)
const listenArten = computed(() =>
  parallel.value.listen.map((typeId) => ({ typeId, titel: auswahlKonfig(typeId, Object.values(RACECOURSE_PARCOURS)).getSheetDef(typeId).title })),
)

// Eine Wahl, die es nicht mehr gibt, gilt als „alle“.
const wahl = merke<ParallelAuswahl>('listen.wkr.parallel', {}, { ueberNeuladen: true })
const auswahl = computed<ParallelAuswahl>(() => ({
  runde: parallel.value.runden.find((r) => r === wahl.value.runde),
  racecourse: RACECOURSES.find((rc) => rc === wahl.value.racecourse),
  liste: parallel.value.listen.includes(wahl.value.liste ?? '') ? wahl.value.liste : undefined,
}))

// Jeder Bogen misst sein Blatt selbst und teilt für sich (components/bogen/BogenBlatt.vue).
const boegen = computed(() => (props.gesperrt ? [] : waehleRundenBoegen(alle.value, auswahl.value)))

function setze<K extends keyof ParallelAuswahl>(feld: K, e: Event) {
  const wert = (e.target as HTMLSelectElement).value
  wahl.value = { ...wahl.value, [feld]: wert === '' ? undefined : wert }
}

const racecourseName = (rc: Racecourse) => t(rc === 'A' ? 'parallel.parcoursA' : 'parallel.parcoursB')
const rundenName = (r: ParallelRunde) => rundenNameIn(r, t)

/** Die Auswahl in Worten, für Fenstertitel und Dateiname – in der Sprache der Oberfläche. */
const auswahlText = computed(() => {
  const a = auswahl.value
  return [
    t('parallel.title'),
    a.runde !== undefined ? rundenName(a.runde) : undefined,
    a.racecourse !== undefined ? racecourseName(a.racecourse) : undefined,
    a.liste !== undefined ? listenArten.value.find((l) => l.typeId === a.liste)?.titel : undefined,
  ]
    .filter(Boolean)
    .join(' - ')
    .replace(/\s*[/\\:]\s*/g, '-')
})
watchEffect(() => emit('stand', { anzahl: boegen.value.length, auswahl: auswahlText.value }))

const stapel = ref<HTMLElement | null>(null)
const { zoom } = useBogenZoom(stapel)
</script>

<template>
  <div v-if="!gesperrt" class="panel no-print wkr-listen-wahl" data-listen="parallel">
    <p class="hint">{{ t('parallel.lists.hint') }}</p>
    <!-- Ohne festgeschriebenen Plan gibt es nichts zu drucken. -->
    <p v-if="alle.length === 0" class="boat-banner warn" role="status" data-hinweis="parallel-plan">
      {{ t('parallel.lists.needPlan') }} <a :href="adresse('verzahnung', { reiter: 'parallel' })">{{ t('nav.verzahnung') }} → {{ t('parallel.title') }}</a>
    </p>
    <template v-else>
      <div class="row wkr-listen-leiste">
        <div v-if="parallel.runden.length > 1" class="field">
          <label :for="`${id}-runde`">{{ t('parallel.lists.round') }}</label>
          <select :id="`${id}-runde`" class="input" data-feld="pwkr-runde" :value="auswahl.runde ?? ''" @change="setze('runde', $event)">
            <option value="">{{ t('lists.wkr.all') }}</option>
            <option v-for="r in parallel.runden" :key="r" :value="r">{{ rundenName(r) }}</option>
          </select>
        </div>
        <div class="field">
          <label :for="`${id}-racecourse`">{{ t('parallel.lists.racecourse') }}</label>
          <select :id="`${id}-racecourse`" class="input" data-feld="pwkr-racecourse" :value="auswahl.racecourse ?? ''" @change="setze('racecourse', $event)">
            <option value="">{{ t('lists.wkr.all') }}</option>
            <option v-for="rc in RACECOURSES" :key="rc" :value="rc">{{ racecourseName(rc) }}</option>
          </select>
        </div>
        <div class="field">
          <label :for="`${id}-liste`">{{ t('lists.wkr.list') }}</label>
          <select :id="`${id}-liste`" class="input" data-feld="pwkr-liste" :value="auswahl.liste ?? ''" @change="setze('liste', $event)">
            <option value="">{{ t('lists.wkr.all') }}</option>
            <option v-for="l in listenArten" :key="l.typeId" :value="l.typeId">{{ l.titel }}</option>
          </select>
        </div>
        <p class="note wkr-listen-stand" role="status">{{ tn('lists.wkr.count', boegen.length) }}</p>
      </div>
      <p class="note" data-hinweis="parallel-seiten">{{ t('parallel.lists.pages') }}</p>
      <p v-if="state.wkrRueckseite" class="boat-banner ok" role="status">{{ t('lists.wkr.duplex') }}</p>
      <p class="note">
        {{ t('lists.wkr.settings') }} <a :href="adresse('einstellungen')">{{ t('nav.einstellungen') }}</a
        >. {{ t('lists.wkr.names') }} <a :href="adresse('veranstaltung', { ziel: 'wkr' })">{{ t('nav.veranstaltung') }} → {{ t('crew.title') }}</a
        >.
      </p>
    </template>
  </div>

  <!-- Immer da, auch leer: Der Stapel misst seine Breite ab dem Einhängen (lib/bogenZoom.ts). -->
  <div ref="stapel" class="bogen-stapel wkr-listen" :style="zoom">
    <BogenBlatt v-for="b in boegen" :key="b.id" :konfig="bogenKonfig(b.typeId, b.parcoursId)" :auftrag="b.auftrag" :optionen="b.optionen" :rueckseite="state.wkrRueckseite" />
  </div>
</template>
