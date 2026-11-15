<script setup lang="ts">
/**
 * Der Fuß einer Seite einer Ergebnisliste, etwa einen halben Zentimeter unter der Tabelle:
 * links – nur wenn auf der Seite ein Platz per Stichentscheid entstand – die Regel dazu in
 * Worten, daneben die Seitenzahl (nur bei mehreren Seiten) und rechts im Rahmen, wann sich die
 * Liste zuletzt geändert hat – nur der Zeitstempel (Datum, Uhrzeit mit Sekunden), ohne Wort
 * davor: Das Feld soll schmal bleiben, und was die Zeit meint, weiß am Aushang jeder. Für
 * Vorlesegeräte trägt es die Beschriftung unsichtbar. Vorbild: `.erg-stand` im Fehlerpunkte-Prototyp.
 *
 * Der Zeitpunkt steht hier und nicht im Seitenrand: Hängen zwei Fassungen aus, sagt er, welche
 * die neuere ist – ein Druckzeitpunkt änderte sich bei jedem Nachdruck. Er steht auf jeder
 * Seite der Liste; die Höhe des Fußes ist fest (lib/seiten.ts `ERGEBNIS_FUSS_MM`).
 */
defineProps<{
  /** Der Zeitstempel der letzten Änderung, schon als Text; leer = unbekannt, dann steht kein Feld da. */
  stand?: string
  /** Was der Zeitstempel ist („Letzte Änderung“) – unsichtbar, für Vorlesegeräte. */
  standLabel?: string
  /** Die Erklärung zum Zeichen am Platz; leer = auf dieser Seite gibt es keinen Stichentscheid. */
  stich?: string
  /** Ein Hinweis ohne Zeichen an derselben Stelle (Pokalauswertung: „Zwischenstand – es fehlen …“). */
  hinweis?: string
  /** „Seite 1 / 2“; leer bei einer Liste mit nur einer Seite. */
  seitenzahl?: string
}>()
</script>

<template>
  <div class="erg-fuss">
    <p v-if="stich" class="erg-stich-hinweis"><span class="erg-stich-zeichen" aria-hidden="true">*</span> {{ stich }}</p>
    <p v-else-if="hinweis" class="erg-stich-hinweis" data-hinweis="fuss">{{ hinweis }}</p>
    <span v-else />
    <p v-if="seitenzahl" class="listen-seitenzahl">{{ seitenzahl }}</p>
    <span v-else />
    <p v-if="stand" class="erg-stand"><span v-if="standLabel" class="sr-only">{{ standLabel }}: </span>{{ stand }}</p>
  </div>
</template>
