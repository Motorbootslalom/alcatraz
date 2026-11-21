<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MessageKey } from '../../i18n'
import type { EntwurfEintrag, ZuletztZeile } from '../../geraete/erfassen'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'
import { stufeZeichen, useWkrText } from './texte'

/**
 * „Zuletzt“ (W3.3, Plan §5.5, F7): Leiste der letzten eigenen Zeilen (Nummer + Stufenzeichen, ≤ zuletztLeiste) und
 * „Entw. n“; ein Tipp öffnet die Liste dahinter, jede Zeile mit „Korrigieren“. Darüber die Bänder, die eine Antwort
 * brauchen: Rückfrage („Bedienrechner: Start 23 steht dort anders (15)“ – nur `steht` dieser Zellen, F11) mit
 * Korrigieren/„So lassen“, Ablehnung als Satz (`geraete.ablehnung.<grund>`), und 6 s nach dem Abschicken
 * „Rückgängig“ (G8: wartet die Zeile noch, kommt sie zurück; sonst öffnet er die Korrektur).
 */
const props = defineProps<{
  zeilen: ZuletztZeile[]
  /** Zellwerte einer Zeile als Text (WkrMaske kennt den Aufbau). */
  text: (z: ZuletztZeile) => string
  entwuerfe: EntwurfEintrag[]
  /** Nach dem Abschicken (≤ rueckgaengigMs): die eben gesendete Zeile. */
  rueckgaengig: { z: number; sn: string } | null
  /** Rückfragen/Ablehnungen, die der Wettkampfrichter mit „So lassen“ weggelegt hat. */
  erledigt: ReadonlySet<number>
}>()
const emit = defineEmits<{ korrigiere: [z: number]; soLassen: [z: number]; rueckgaengig: []; entwurf: [e: EntwurfEintrag] }>()
const { w } = useWkrText()

const offen = ref(false)
const leiste = computed(() => props.zeilen.slice(0, WKR_ANNAHMEN.zuletztLeiste))
const nr = (z: ZuletztZeile) => z.sn ?? '?'
const baender = computed(() => props.zeilen.filter((z) => !props.erledigt.has(z.z) && (z.stufe.stufe === 'rueckfrage' || z.stufe.stufe === 'abgelehnt')))

function grundText(z: ZuletztZeile): string {
  if (z.stufe.stufe !== 'abgelehnt') return ''
  return z.stufe.grund === 'verworfen' ? w('wkr.geraet.verworfen') : w(`geraete.ablehnung.${z.stufe.grund}` as MessageKey)
}
function stehtText(z: ZuletztZeile): string {
  return z.stufe.stufe === 'rueckfrage' ? z.stufe.zellen.map((c) => c.steht || '–').join(', ') : ''
}
const stufeWort = (z: ZuletztZeile) => w(`wkr.geraet.stufe.${z.stufe.stufe}`)
</script>

<template>
  <div class="wkr-zuletzt" data-teil="zuletzt">
    <div
      v-for="z in baender"
      :key="z.z"
      class="wkr-band"
      :class="z.stufe.stufe === 'abgelehnt' ? 'wkr-band--rot' : 'wkr-band--warn'"
      role="alert"
      :data-teil="z.stufe.stufe === 'rueckfrage' ? 'rueckfrage' : 'abgelehnt'"
      :data-z="z.z"
    >
      <b v-if="z.stufe.stufe === 'rueckfrage'">{{ w('wkr.geraet.rueckfrage', { nr: nr(z), steht: stehtText(z) }) }}</b>
      <b v-else>{{ w('wkr.geraet.abgelehnt', { nr: nr(z), grund: grundText(z) }) }}</b>
      <span class="wkr-reihe">
        <button type="button" class="wkr-knopf" data-ziel="klein" data-action="band-korrigieren" @click="emit('korrigiere', z.z)">{{ w('wkr.geraet.korrigieren') }}</button>
        <button type="button" class="wkr-knopf" data-ziel="klein" data-action="so-lassen" @click="emit('soLassen', z.z)">{{ w('wkr.geraet.soLassen') }}</button>
      </span>
    </div>

    <!-- Leiste und „Rückgängig“ in einer Zeile fester Höhe: Das Verschwinden nach 6 s verschiebt nichts (Prüfbefund W3). -->
    <div v-if="rueckgaengig || leiste.length > 0 || entwuerfe.length > 0" class="wkr-zuletzt-kopf">
      <button v-if="leiste.length > 0 || entwuerfe.length > 0" type="button" class="wkr-knopf wkr-zuletzt-leiste" data-ziel="klein" data-action="zuletzt" :aria-expanded="offen" @click="offen = !offen">
        <span class="wkr-zuletzt-leiste-titel">{{ w('wkr.geraet.zuletzt') }}</span>
        <span v-for="z in leiste" :key="z.z" class="wkr-zuletzt-leiste-zeile" data-teil="leiste-zeile" :data-stufe="z.stufe.stufe">{{ nr(z) }} {{ stufeZeichen(z.stufe) }}</span>
        <span v-if="entwuerfe.length > 0" class="wkr-zuletzt-leiste-zeile" data-teil="entwuerfe">{{ w('wkr.geraet.entwuerfe', { n: entwuerfe.length }) }}</span>
      </button>
      <span v-if="rueckgaengig" class="wkr-rueckgaengig" role="status" data-teil="rueckgaengig-band" :title="w('wkr.geraet.gesendetNr', { nr: rueckgaengig.sn })">
        <span>● {{ rueckgaengig.sn }}</span>
        <button type="button" class="wkr-knopf" data-ziel="klein" data-action="rueckgaengig" @click="emit('rueckgaengig')">{{ w('wkr.geraet.rueckgaengig') }}</button>
      </span>
    </div>

    <div v-if="offen" class="wkr-zuletzt-liste" data-teil="zuletzt-liste">
      <div v-for="z in zeilen" :key="z.z" class="wkr-zuletzt-zeile" :data-z="z.z" :data-stufe="z.stufe.stufe">
        <span class="wkr-zuletzt-nr">{{ nr(z) }}</span>
        <span class="wkr-zuletzt-text">
          <b>{{ stufeZeichen(z.stufe) }} {{ stufeWort(z) }}</b>
          <span v-if="z.teil"> · {{ w(z.teil === 'ab' ? 'wkr.geraet.steg.ab' : 'wkr.geraet.steg.an') }}</span>
          <br />{{ text(z) }}
        </span>
        <button type="button" class="wkr-knopf" data-ziel="klein" data-action="korrigieren" @click="(offen = false), emit('korrigiere', z.z)">{{ w('wkr.geraet.korrigieren') }}</button>
      </div>
      <div v-for="e in entwuerfe" :key="`${e.s}|${e.teil ?? ''}`" class="wkr-zuletzt-zeile" data-teil="entwurf" :data-start="e.s">
        <span class="wkr-zuletzt-nr">{{ e.sn ?? '?' }}</span>
        <span class="wkr-zuletzt-text"><b>{{ w('wkr.geraet.entwurf') }}</b></span>
        <button type="button" class="wkr-knopf" data-ziel="klein" data-action="entwurf-oeffnen" @click="(offen = false), emit('entwurf', e)">{{ w('wkr.geraet.oeffnen') }}</button>
      </div>
    </div>
  </div>
</template>
