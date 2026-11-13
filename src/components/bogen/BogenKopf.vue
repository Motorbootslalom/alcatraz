<script setup lang="ts">
import type { BogenSeite } from '../../lib/bogen'

/**
 * Kopf eines Bogens: Veranstaltung, Liste, Klasse, Lauf, Parcours und der Name des
 * Wettkampfrichters. Vorbild: SheetHeader.vue im Fehlerpunkte-Prototyp (dort mit QR-Code;
 * der kommt mit der Erfassung).
 *
 * `wkrPflege`: Das Namensfeld ist am Bildschirm ein Eingabefeld und meldet jede Änderung –
 * wohin sie geschrieben wird, entscheidet der Aufrufer. Ohne Pflege steht der Name als Text.
 */
defineProps<{
  seite: BogenSeite
  wkrPflege?: boolean
  /** Beschriftung des Namensfelds für Vorleseprogramme (Sprache der Oberfläche). */
  wkrLabel?: string
}>()
const emit = defineEmits<{ wkr: [name: string] }>()
</script>

<template>
  <div class="bogen-kopf">
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
      <label class="bk-wkr">
        <span class="bk-wkr-label">{{ seite.texte.wkr }}</span>
        <span class="bk-wkr-feld">
          <input
            v-if="wkrPflege"
            class="bk-wkr-input"
            autocomplete="off"
            :value="seite.wkr"
            :placeholder="seite.texte.wkrPlatzhalter"
            :aria-label="wkrLabel"
            @input="emit('wkr', ($event.target as HTMLInputElement).value)"
          />
          <span v-else class="bk-wkr-input bk-wkr-text">{{ seite.wkr || ' ' }}</span>
          <!-- Die Bezeichnung unter der Linie: Im Druck sähe ein Platzhalter wie ein Name aus. -->
          <span class="bk-wkr-unter">{{ seite.texte.wkrPlatzhalter }}</span>
        </span>
      </label>
    </div>
  </div>
</template>
