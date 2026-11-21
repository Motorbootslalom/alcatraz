<script setup lang="ts">
import type { SchlangenEintrag } from '../../geraete/erfassen'
import { useWkrText } from './texte'

/**
 * Starterkarte (W3.3, Plan §5.1): die Startnummer riesig, Klasse, Lauf bzw. Attempt, Boot – **nie ein Name** (F6;
 * die Sicht der Liste trägt keinen). Kennzeichen als Wort: „geschätzt (ohne Verbindung)“, „noch nicht gezeigt“
 * (Vorsteg vorab), „außer der Reihe“ (gewählt statt des Kopfs der Schlange), „● gesendet“ (Doppeltipp-Schutz, G5),
 * „Korrektur“ (F7).
 */
defineProps<{
  start: Pick<SchlangenEintrag, 'startNr' | 'titel' | 'boot' | 'geschaetzt' | 'vorab'>
  klasse: string
  ausserDerReihe?: boolean
  gesendet?: boolean
  korrektur?: 'korrektur' | 'vorschlag' | null
}>()
const { w } = useWkrText()
</script>

<template>
  <section
    class="wkr-karte"
    :class="{ 'wkr-karte--ausser': ausserDerReihe, 'wkr-karte--gesendet': gesendet, 'wkr-karte--korrektur': !!korrektur }"
    data-teil="karte"
    :data-startnr="start.startNr"
  >
    <p v-if="korrektur" class="wkr-karte-art" data-teil="korrektur">{{ w(korrektur === 'vorschlag' ? 'wkr.geraet.korrektur.vorschlagTitel' : 'wkr.geraet.korrektur.titel', { nr: start.startNr }) }}</p>
    <div class="wkr-karte-zeile">
      <span class="wkr-startnr" data-teil="startnr">{{ start.startNr }}</span>
      <span class="wkr-karte-angaben">
        <span data-teil="klasse">{{ klasse }}</span>
        <span class="wkr-karte-klein" data-teil="start-titel">{{ start.titel }}</span>
        <span v-if="start.boot" class="wkr-karte-klein" data-teil="boot">{{ w('wkr.geraet.boot', { boot: start.boot }) }}</span>
      </span>
    </div>
    <p v-if="gesendet" class="wkr-karte-marke wkr-karte-marke--gesendet" role="status" data-teil="gesendet">● {{ w('wkr.geraet.gesendet') }}</p>
    <p v-if="start.geschaetzt" class="wkr-karte-marke" data-teil="geschaetzt">{{ w('wkr.geraet.geschaetzt') }}</p>
    <p v-if="start.vorab" class="wkr-karte-marke" data-teil="vorab">{{ w('wkr.geraet.vorab') }}</p>
    <p v-if="ausserDerReihe && !gesendet" class="wkr-karte-marke" data-teil="ausser">{{ w('wkr.geraet.ausserDerReihe') }}</p>
  </section>
</template>
