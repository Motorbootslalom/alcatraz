<script setup lang="ts">
/**
 * Der Fuß einer Seite einer Wertungsliste, etwa einen halben Zentimeter unter der Tabelle:
 * links – nur wenn auf der Seite ein Platz per Stichentscheid entstand – die Regel dazu in
 * Worten, daneben die Seitenzahl (nur bei mehreren Seiten) und rechts im Rahmen, wann sich die
 * Liste zuletzt geändert hat – nur der Zeitstempel (Datum, Uhrzeit mit Sekunden), ohne Wort
 * davor: Das Feld soll schmal bleiben, und was die Zeit meint, weiß am Aushang jeder. Für
 * Vorlesegeräte trägt es die Beschriftung unsichtbar. Vorbild: `.erg-stand` im Fehlerpunkte-Prototyp.
 *
 * Der Zeitpunkt steht hier und nicht im Seitenrand: Hängen zwei Fassungen aus, sagt er, welche
 * die neuere ist – ein Druckzeitpunkt änderte sich bei jedem Nachdruck. Er steht auf jeder
 * Seite der Liste; die Höhe des Fußes ist fest (lib/seiten.ts `ERGEBNIS_FUSS_MM`).
 *
 * Verlangt das Regelwerk es (UIM 960, Pkt. 5.2: „All results must be signed by the O.O.D. and
 * must show the time of posting.“), steht darunter eine zweite Zeile: links die
 * Unterschriftszeile des O.O.D., rechts ein leeres Feld für die Uhrzeit des Aushangs – beides
 * zum Eintragen von Hand, denn wann ausgehängt wird, weiß das Programm nicht. Der Zeitstempel
 * darüber bleibt die letzte Änderung. Der Fuß ist dann höher (`ERGEBNIS_FUSS_UNTERSCHRIFT_MM`).
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
  /**
   * Die Zeile für Unterschrift und Aushang: `wer` steht vor der Unterschriftszeile („O.O.D.“),
   * `aushang` vor dem leeren Feld („Time of posting“). Fehlt = keine Zeile.
   */
  unterschrift?: { wer: string; aushang: string }
}>()
</script>

<template>
  <div :class="['erg-fuss', { 'erg-fuss--unterschrift': unterschrift }]">
    <!-- Beides zugleich (Mannschaftswertung im Zwischenstand mit Stichentscheid): je eine der zwei kleinen Zeilen. -->
    <p v-if="stich" class="erg-stich-hinweis">
      <span data-hinweis="stich"><span class="erg-stich-zeichen" aria-hidden="true">*</span> {{ stich }}</span>
      <template v-if="hinweis"><br /><span data-hinweis="fuss">{{ hinweis }}</span></template>
    </p>
    <p v-else-if="hinweis" class="erg-stich-hinweis" data-hinweis="fuss">{{ hinweis }}</p>
    <span v-else />
    <p v-if="seitenzahl" class="listen-seitenzahl">{{ seitenzahl }}</p>
    <span v-else />
    <p v-if="stand" class="erg-stand"><span v-if="standLabel" class="sr-only">{{ standLabel }}: </span>{{ stand }}</p>
    <!-- Zum Eintragen von Hand: Unterschrift des O.O.D. und Uhrzeit des Aushangs. -->
    <div v-if="unterschrift" class="erg-unterschrift" data-feld="unterschrift">
      <span class="erg-unterschrift-wer"><span class="erg-unterschrift-text">{{ unterschrift.wer }}</span><span class="erg-unterschrift-linie" /></span>
      <span class="erg-unterschrift-aushang" data-feld="aushang-zeit"><span class="erg-unterschrift-text">{{ unterschrift.aushang }}</span><span class="erg-unterschrift-feld" /></span>
    </div>
  </div>
</template>
