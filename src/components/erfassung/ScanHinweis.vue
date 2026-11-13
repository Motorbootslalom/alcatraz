<script setup lang="ts">
import { computed } from 'vue'
import { t, type MessageKey } from '../../i18n'
import type { QrFehler } from '../../lib/qr'

/**
 * Hinweis nach einem Scan in der Erfassung: welches Blatt erkannt wurde – oder warum der Code
 * nicht passt. Vorbild: ScanHinweis.vue im Fehlerpunkte-Prototyp. Anders als dort wird ein
 * Blatt mit anderem Regelwerk oder Aufbau nur abgewiesen: Beides stellt man hier bewusst
 * unter „Veranstaltung“ um, nicht nebenbei beim Scannen.
 */
const props = defineProps<{
  code: string
  /** Erkannt: was gezeigt wird, in Worten (Liste oder „Laufzettel“, Parcours, Klasse, Lauf, Seite). */
  teile?: string[]
  /** Den Bogen gibt es so nicht mehr; gezeigt wird der, auf dem die Klasse jetzt steht. */
  geaendert?: boolean
  /** Nicht erkannt: der Grund; `bogen` = der Code ist gültig, aber es gibt keinen Bogen dazu. */
  fehler?: QrFehler | { art: 'bogen' }
  /** Namen und Zahlen für die Meldung: das Gedruckte, das Eingestellte, die Zahl der Läufe. */
  angaben?: { printed?: string; current?: string; own?: string; runs?: number }
}>()
defineEmits<{ schliessen: [] }>()

const meldung = computed(() => {
  const f = props.fehler
  if (!f) return ''
  return t(`scan.error.${f.art}` as MessageKey, { code: 'wert' in f ? f.wert : '', printed: '', current: '', own: '', runs: '', ...props.angaben })
})
</script>

<template>
  <div :class="['scan-hinweis', fehler ? 'scan-hinweis--fehler' : 'scan-hinweis--ok']" :role="fehler ? 'alert' : 'status'">
    <div class="scan-zeile">
      <p v-if="fehler" class="scan-text">
        <strong>{{ t('scan.notRecognised') }}</strong> {{ meldung }}
      </p>
      <p v-else class="scan-text">
        <strong>{{ teile?.[0] }}</strong
        ><template v-for="(teil, i) in teile?.slice(1)" :key="i"> · {{ teil }}</template>
      </p>
      <button type="button" class="btn sm" data-action="scan-schliessen" @click="$emit('schliessen')">{{ t('scan.close') }}</button>
    </div>
    <p v-if="geaendert" class="scan-text">{{ t('scan.changed') }}</p>
    <p class="scan-code">{{ code || t('scan.empty') }}</p>
  </div>
</template>
