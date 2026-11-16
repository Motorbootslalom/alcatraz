<script setup lang="ts">
import { t } from '../i18n'
// Der Wortlaut kommt aus dem Paket selbst: Er bleibt richtig, wenn das Paket erneuert wird.
import mit from '../../node_modules/country-flag-icons/LICENSE?raw'
import ParcoursNachweis from './ParcoursNachweis.vue'

/**
 * Lizenzvermerke fremder Bestandteile, die in der Anwendung stecken. Die MIT-Lizenz der
 * Staatenflaggen verlangt, Urheber- und Erlaubnisvermerk mit jeder Kopie weiterzugeben – die
 * Ein-Datei-Fassung wird ohne README weitergereicht, also steht der Vermerk in der App selbst.
 * Die Parcours-Zeichnungen stehen hier ebenso (Entscheidung 16.11.2026): Diese Stelle genügt als
 * Namensnennung, auch für Bilder der Bögen in der Doku, deren Quellenzeile abgeschnitten ist.
 * tweetnacl (Verschlüsselung im Gerätebetrieb, ab Etappe E5 der Tafel, 16.11.2026) ist gemeinfrei (Unlicense) und
 * verlangt keinen Vermerk; genannt wird es trotzdem, damit hier jeder fremde Bestandteil steht.
 */
</script>

<template>
  <details id="lizenzen" class="panel">
    <summary>{{ t('licences.title') }}</summary>
    <p class="hint">{{ t('licences.flags.countries') }}</p>
    <pre class="lizenz-text" lang="en">{{ mit.trim() }}</pre>
    <p class="hint">{{ t('licences.flags.states') }}</p>
    <p class="hint" data-lizenz="tweetnacl">{{ t('licences.tweetnacl') }}</p>
    <p class="hint">{{ t('licences.parcours') }}</p>
    <ParcoursNachweis />
  </details>
</template>
