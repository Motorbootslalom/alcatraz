<script setup lang="ts">
import type { Locale } from '../i18n'

/**
 * Flagge zu einer Sprache der Oberfläche. Als Zeichnung statt als
 * Flaggen-Emoji, weil Windows diese nur als Buchstaben („DE“, „GB“) zeigt.
 */
defineProps<{ locale: Locale }>()
</script>

<template>
  <svg v-if="locale === 'de'" class="flag" viewBox="0 0 5 3" aria-hidden="true">
    <rect width="5" height="3" fill="#ffce00" />
    <rect width="5" height="2" fill="#dd0000" />
    <rect width="5" height="1" fill="#000" />
  </svg>
  <svg v-else-if="locale === 'en'" class="flag" viewBox="0 0 60 36" aria-hidden="true">
    <rect width="60" height="36" fill="#012169" />
    <path d="M0 0 60 36M60 0 0 36" stroke="#fff" stroke-width="7.2" />
    <path d="M0 0 60 36M60 0 0 36" stroke="#c8102e" stroke-width="2.4" />
    <path d="M30 0v36M0 18h60" stroke="#fff" stroke-width="12" />
    <path d="M30 0v36M0 18h60" stroke="#c8102e" stroke-width="7.2" />
  </svg>
</template>
