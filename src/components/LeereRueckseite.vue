<script setup lang="ts">
import { t } from '../i18n'

/**
 * Die leere Rückseite hinter einem Dokument mit ungerader Seitenzahl, wenn doppelseitig
 * gedruckt wird (lib/doppelseitig.ts): Das nächste Dokument beginnt damit auf einem neuen Blatt.
 * Im Druck ist die Seite wirklich leer – kein Kopf, keine Seitenzahl, kein Zeit-Feld. Am
 * Bildschirm steht ein blasses leeres Blatt mit dem Vermerk, damit man sieht, wo sie liegt;
 * der Vermerk gehört zur Bedienung (Sprache der Oberfläche) und wird nicht gedruckt.
 *
 * Die Klasse des Dokuments (`sheet-page`, `ergebnis-blatt` …) kommt als Attribut dazu: Über sie
 * erbt die Seite die Seitenart und damit das Format (hoch/quer) des Dokuments davor.
 */
</script>

<template>
  <section class="leere-rueckseite" data-leere-rueckseite aria-hidden="true">
    <p class="leere-rueckseite-vermerk">{{ t('lists.duplex.blank') }}</p>
  </section>
</template>
