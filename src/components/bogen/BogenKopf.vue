<script setup lang="ts">
import type { BogenSeite } from '../../lib/bogen'
import QrCode from '../QrCode.vue'

/**
 * Kopf eines Bogens: Veranstaltung, Liste, Klasse, Lauf, Parcours und der Name des
 * Wettkampfrichters. Vorbild: SheetHeader.vue im Fehlerpunkte-Prototyp. Oben rechts
 * steht der QR-Code der Druckseite (lib/qr.ts) – über dem Kopf schwebend, damit er keine
 * Höhe kostet und die Seitenaufteilung bleibt, wie sie ohne ihn war.
 *
 * Der Name steht immer als Text da, auch in der Beispielansicht: Gepflegt wird er nur in der
 * WKR-Einteilung (Entscheidung des Nutzers vom 15.11.2026). Ohne Namen bleibt die Linie leer,
 * darunter „Name Wettkampfrichter*in“ – wie auf dem Papier.
 */
defineProps<{ seite: BogenSeite }>()
</script>

<template>
  <div :class="['bogen-kopf', { 'bogen-kopf--qr': seite.qr }]">
    <QrCode v-if="seite.qr" class="bk-qr" :inhalt="seite.qr" />
    <div class="bk-leiste">
      <!-- Ohne Namen der Veranstaltung behält die Leiste ihre Höhe. -->
      <span class="bk-titel">{{ seite.eventName || ' ' }}</span>
    </div>
    <div class="bk-rumpf">
      <div class="bk-links">
        <div class="bk-zelle bk-liste">{{ seite.titel }}</div>
        <div class="bk-zelle">{{ seite.klassenText }}</div>
        <div v-if="seite.laufText" class="bk-zelle">{{ seite.laufText }}</div>
        <div v-if="seite.parcours" class="bk-zelle bk-parcours">{{ seite.parcours }}</div>
      </div>
      <div class="bk-wkr">
        <span class="bk-wkr-label">{{ seite.texte.wkr }}</span>
        <span class="bk-wkr-feld">
          <span class="bk-wkr-input bk-wkr-text">{{ seite.wkr || ' ' }}</span>
          <!-- Die Bezeichnung unter der Linie, auch ohne Namen: Dort trägt man ihn von Hand ein. -->
          <span class="bk-wkr-unter">{{ seite.texte.wkrPlatzhalter }}</span>
        </span>
      </div>
    </div>
  </div>
</template>
