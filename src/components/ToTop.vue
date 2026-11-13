<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { t } from '../i18n'

/** „Nach oben“ unten rechts – erst sichtbar, wenn man ein Stück gerollt hat (lange Listen, Einstellungen). */
const AB = 400
const sichtbar = ref(false)
const pruefen = () => (sichtbar.value = window.scrollY > AB)

function nachOben() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  pruefen()
  window.addEventListener('scroll', pruefen, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('scroll', pruefen))
</script>

<template>
  <button v-show="sichtbar" type="button" class="to-top no-print" :aria-label="t('app.toTop')" :title="t('app.toTop')" @click="nachOben">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 19V6M6 12l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</template>
