<script setup lang="ts">
import type { SchlangenEintrag } from '../../geraete/erfassen'
import { useWkrText } from './texte'

/**
 * Starterkarte (W3.3, Plan §5.1): die Startnummer riesig, Klasse, Lauf bzw. Attempt, Boot – **nie ein Name** (F6;
 * die Sicht der Liste trägt keinen). Kennzeichen als Wort: „geschätzt (ohne Verbindung)“, „noch nicht gezeigt“
 * (Vorsteg vorab), „außer der Reihe“ (gewählt statt des Kopfs der Schlange), „● gesendet“ (Doppeltipp-Schutz, G5),
 * „Korrektur“ (F7). Parcours-Ampel (Nutzer 21.11.2026, P-03, AM9): kleiner Punkt mit Wort am gezeigten Start – grün
 * „Start frei“, rot „im Parcours“, frei „alle fertig“ (Farben nur --wkr-*, Zeichen UND Wort, bricht um statt abzuschneiden).
 */
defineProps<{
  start: Pick<SchlangenEintrag, 'startNr' | 'titel' | 'boot' | 'geschaetzt' | 'vorab'>
  klasse: string
  ausserDerReihe?: boolean
  gesendet?: boolean
  korrektur?: 'korrektur' | 'vorschlag' | null
  ampel?: 'gruen' | 'rot' | 'frei' | null
}>()
const { w } = useWkrText()
</script>

<template>
  <section
    class="wkr-starterkarte"
    :class="{ 'wkr-starterkarte--ausser': ausserDerReihe, 'wkr-starterkarte--gesendet': gesendet, 'wkr-starterkarte--korrektur': !!korrektur }"
    data-teil="karte"
    :data-startnr="start.startNr"
  >
    <p v-if="korrektur" class="wkr-starterkarte-art" data-teil="korrektur">{{ w(korrektur === 'vorschlag' ? 'wkr.geraet.korrektur.vorschlagTitel' : 'wkr.geraet.korrektur.titel', { nr: start.startNr }) }}</p>
    <div class="wkr-starterkarte-zeile">
      <span class="wkr-startnr" data-teil="startnr">{{ start.startNr }}</span>
      <span class="wkr-starterkarte-angaben">
        <span data-teil="klasse">{{ klasse }}</span>
        <span class="wkr-starterkarte-klein" data-teil="start-titel">{{ start.titel }}</span>
        <span v-if="start.boot" class="wkr-starterkarte-klein" data-teil="boot">{{ w('wkr.geraet.boot', { boot: start.boot }) }}</span>
      </span>
    </div>
    <p v-if="ampel" class="wkr-starterkarte-marke wkr-starterkarte-ampel" :data-ampel="ampel" data-teil="karten-ampel">
      <span class="wkr-starterkarte-ampel-licht" aria-hidden="true">●</span> {{ w(`wkr.geraet.ampel.${ampel}`) }}
    </p>
    <p v-if="gesendet" class="wkr-starterkarte-marke wkr-starterkarte-marke--gesendet" role="status" data-teil="gesendet">● {{ w('wkr.geraet.gesendet') }}</p>
    <p v-if="start.geschaetzt" class="wkr-starterkarte-marke" data-teil="geschaetzt">{{ w('wkr.geraet.geschaetzt') }}</p>
    <p v-if="start.vorab" class="wkr-starterkarte-marke" data-teil="vorab">{{ w('wkr.geraet.vorab') }}</p>
    <p v-if="ausserDerReihe && !gesendet" class="wkr-starterkarte-marke" data-teil="ausser">{{ w('wkr.geraet.ausserDerReihe') }}</p>
  </section>
</template>
