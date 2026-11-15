<script setup lang="ts">
import { t } from '../i18n'
// Der Wortlaut kommt aus dem Paket selbst: Er bleibt richtig, wenn das Paket erneuert wird.
import mit from '../../node_modules/country-flag-icons/LICENSE?raw'

/**
 * Lizenzvermerke fremder Bestandteile, die in der Anwendung stecken. Die MIT-Lizenz der
 * Staatenflaggen verlangt, Urheber- und Erlaubnisvermerk mit jeder Kopie weiterzugeben – die
 * Ein-Datei-Fassung wird ohne README weitergereicht, also steht der Vermerk in der App selbst.
 */
</script>

<template>
  <details id="lizenzen" class="panel">
    <summary>{{ t('licences.title') }}</summary>
    <p class="hint">{{ t('licences.flags.countries') }}</p>
    <pre class="lizenz-text" lang="en">{{ mit.trim() }}</pre>
    <p class="hint">{{ t('licences.flags.states') }}</p>
  </details>
</template>
