<script setup lang="ts">
import { dark, toggleDark } from '../lib/theme'
import { t } from '../i18n'

/** Hell/Dunkel im Kopf: ein Klick, weil man das je nach Licht am Steg öfter wechselt. */
</script>

<template>
  <button
    type="button"
    class="lang-button theme-toggle"
    :aria-label="dark ? t('theme.toLight') : t('theme.toDark')"
    :title="dark ? t('theme.toLight') : t('theme.toDark')"
    :aria-pressed="dark"
    @click="toggleDark"
  >
    <!-- Gezeigt wird, wohin der Klick führt: Sonne im Dunkeln, Mond im Hellen. -->
    <svg v-if="dark" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      <g stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M12 2.5v2.5M12 19v2.500M2.500 12H5M19 12h2.500M5.300 5.300l1.800 1.800M16.900 16.900l1.800 1.800M5.300 18.700l1.800-1.800M16.900 7.100l1.800-1.800" />
      </g>
    </svg>
    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M20.500 14.500A8.500 8.500 0 0 1 9.500 3.500a8.500 8.500 0 1 0 11 11Z" />
    </svg>
  </button>
</template>
