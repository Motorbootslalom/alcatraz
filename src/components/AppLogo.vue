<script setup lang="ts">
/**
 * Das Zeichen der Anwendung: ein A als Boje, von einer Welle durchschnitten.
 * Die Farben kommen aus der Umgebung (`color`, `--logo-accent`, `--logo-ground`),
 * damit es auf jedem Grund sitzt.
 */
</script>

<template>
  <svg class="app-logo" viewBox="0 0 100 100" aria-hidden="true">
    <path d="M50 10 L88 88 H70 L50 44 L30 88 H12 Z" fill="currentColor" />
    <path d="M6 68 q 11 -10 22 0 t 22 0 t 22 0 t 22 0" fill="none" stroke="var(--logo-ground)" stroke-width="13" />
    <path
      d="M6 68 q 11 -10 22 0 t 22 0 t 22 0 t 22 0"
      fill="none"
      stroke="var(--logo-accent)"
      stroke-width="6"
      stroke-linecap="round"
    />
  </svg>
</template>
