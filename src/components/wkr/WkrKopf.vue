<script setup lang="ts">
import type { WkrHinweis } from '../../wkr/sicht'
import { useWkrText } from './texte'

/**
 * Kopf der WKR-Maske (W3.3, Plan §5.1/§5.6): nur Anzeige – Liste · Bereich · Lauf (invers bei Attempt 2/Re-run),
 * Verbindung als Zeichen UND Wort, ⧗ wartende Zeilen. Darunter die Bänder, die der Wettkampfrichter sehen muss:
 * getrennt (rot, dauerhaft, ab WKR_ANNAHMEN.papierHinweisSek „Papierbogen ab Nr. x“), ohne Quittung nach
 * ohneQuittungMs, und ein Hinweis des Bedienrechners mit „Gesehen“. Kein Startername (F6) – die Sicht hat keinen.
 */
const props = defineProps<{
  titel: string
  bereich: string
  lauf: string | null
  /** Attempt 2 bzw. Re-run: Lauf-Zeile invers, damit niemand den falschen Versuch erfasst. */
  invers: boolean
  uebung: boolean
  verbunden: boolean
  /** Ohne Verbindung seit so vielen Sekunden (0 = verbunden). */
  getrenntSek: number
  wartend: number
  ohneQuittung: boolean
  /**
   * N2 (Feldtest 21.11.2026): Das Overlay nach dem Abschicken ging ohne Antwort weg – Startnummer der Zeile, deren
   * Bestätigung noch folgt. Liegt wie „Keine Bestätigung“ über dem Kopf (verschiebt keine Codes), tritt hinter ihr zurück.
   */
  bestaetigungFolgt?: string | null
  /** Ab `papierHinweisSek` ohne Verbindung: erster nicht abgeschickter Start. */
  papierAb: string | null
  hinweis: { id: number; code: WkrHinweis; startNr?: string } | null
}>()
const emit = defineEmits<{ gesehen: [id: number] }>()
const { w, wn } = useWkrText()

const minuten = () => Math.max(1, Math.round(props.getrenntSek / 60))
</script>

<template>
  <header class="wkr-kopf" data-teil="wkr-kopf" :data-verbunden="verbunden">
    <div class="wkr-kopf-zeile">
      <span v-if="uebung" class="wkr-uebung" data-teil="uebung">{{ w('wkr.geraet.uebung') }}</span>
      <span class="wkr-kopf-titel" data-teil="titel">{{ titel }} · {{ bereich }}</span>
      <span v-if="lauf" class="wkr-kopf-lauf" :class="{ 'wkr-invers': invers }" data-teil="lauf" :data-invers="invers || undefined">{{ lauf }}</span>
    </div>
    <div class="wkr-kopf-zeile wkr-kopf-stand">
      <span class="wkr-verbindung" data-teil="verbindung" :data-lage="uebung ? 'uebung' : verbunden ? 'verbunden' : 'getrennt'">
        <template v-if="uebung">{{ w('wkr.geraet.verbindung.uebung') }}</template>
        <template v-else-if="verbunden">● {{ w('wkr.geraet.verbindung.ja') }}</template>
        <template v-else>○ {{ w('wkr.geraet.verbindung.nein') }}</template>
      </span>
      <span v-if="wartend > 0" class="wkr-wartend" data-teil="wartend" :title="wn('wkr.geraet.wartend.titel', wartend)">⧗ {{ wartend }}</span>
    </div>

    <p v-if="!uebung && !verbunden" class="wkr-band wkr-band--rot" role="alert" data-teil="getrennt">
      {{ getrenntSek >= 60 ? wn('wkr.geraet.getrennt.seit', wartend, { min: minuten() }) : wn('wkr.geraet.getrennt', wartend) }}
      <b v-if="papierAb" class="wkr-band-zeile" data-teil="papier-ab">{{ w('wkr.geraet.getrennt.papier', { nr: papierAb }) }}</b>
    </p>
    <!-- Über dem Kopf statt darunter: Es kommt ohne Tipp und darf die Knöpfe nicht verschieben (Prüfbefund W3). -->
    <p v-else-if="ohneQuittung" class="wkr-band wkr-band--warn wkr-kopf-ueber" role="status" data-teil="ohne-quittung">{{ w('wkr.geraet.ohneQuittung') }}</p>
    <p v-else-if="bestaetigungFolgt" class="wkr-band wkr-band--hinweis wkr-kopf-ueber" role="status" data-teil="bestaetigung-folgt">
      {{ w('wkr.geraet.uebertragen.folgt', { nr: bestaetigungFolgt }) }}
    </p>

    <div v-if="hinweis" class="wkr-band wkr-band--hinweis" role="alert" data-teil="hinweis" :data-code="hinweis.code">
      <b>{{ w(`wkr.geraet.hinweis.${hinweis.code}`, { nr: hinweis.startNr ?? '–' }) }}</b>
      <button type="button" class="wkr-knopf" data-ziel="klein" data-action="gesehen" @click="emit('gesehen', hinweis.id)">{{ w('wkr.geraet.gesehen') }}</button>
    </div>
  </header>
</template>
