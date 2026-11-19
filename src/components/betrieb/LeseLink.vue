<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { t } from '../../i18n'
import { copyText } from '../../lib/clipboard'
import QrCode from '../QrCode.vue'

/**
 * Ein Lese-Link des Gerätebetriebs (E6, Betrieb → Geräte): Titel, wofür, QR-Code, der Link zum Markieren, „Link
 * kopieren“ und „Öffnen“ (zum Ausprobieren in einem neuen Tab). Was der Link trägt, steht in geraete/paket.ts – er
 * enthält den Schlüssel seiner Gruppe; wer ihn hat, kann lesen, nicht schreiben.
 */
const props = defineProps<{ art: 'anzeige' | 'zuschauer'; url: string }>()

const kopiert = ref<'' | 'ja' | 'nein'>('')
let takt: ReturnType<typeof setTimeout> | undefined

async function kopiere(): Promise<void> {
  clearTimeout(takt)
  kopiert.value = (await copyText(props.url)) ? 'ja' : 'nein'
  // „Kopiert.“ nur kurz; „ging nicht“ bleibt, bis es gelingt – dann muss jemand von Hand kopieren.
  if (kopiert.value === 'ja') takt = setTimeout(() => (kopiert.value = ''), 4000)
}

// Ein neuer Link (Zuschauer-Link erneuert): Was über den alten gesagt war, gilt nicht mehr.
watch(
  () => props.url,
  () => {
    clearTimeout(takt)
    kopiert.value = ''
  },
)
onBeforeUnmount(() => clearTimeout(takt))

function markiere(e: Event): void {
  ;(e.target as HTMLInputElement).select()
}
</script>

<template>
  <div class="lese-link" :data-link="art">
    <h3>{{ t(`geraete.link.${art}`) }}</h3>
    <p class="note">{{ t(`geraete.link.${art}.hint`) }}</p>
    <QrCode :inhalt="url" />
    <input class="input lese-link-text" readonly :value="url" :aria-label="t('geraete.link.text', { art: t(`geraete.link.${art}`) })" spellcheck="false" @focus="markiere" />
    <div class="row lese-link-knoepfe">
      <button type="button" class="btn" data-action="link-kopieren" @click="kopiere">{{ t('geraete.link.kopieren') }}</button>
      <a class="btn" :href="url" target="_blank" rel="noopener" data-action="link-oeffnen" :title="t('geraete.link.oeffnen.title')">{{ t('geraete.link.oeffnen') }}</a>
      <slot />
    </div>
    <p v-if="kopiert" class="note" role="status" data-teil="kopiert">{{ t(kopiert === 'ja' ? 'geraete.link.kopiert' : 'geraete.link.nichtKopiert') }}</p>
  </div>
</template>
