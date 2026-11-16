<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, watchEffect } from 'vue'
import './styles/zuschauer.css'
import type { AppState, ZuschauerSicht } from './types'
import { useLeseStore } from './state/leseStore'
import { sichtOeffentlich, sichtZuschauer } from './betrieb/sicht'
import { vollbild } from './lib/router'
import { folgeBedienfenster } from './lib/anzeigeFenster'
import { useUhr } from './lib/uhr'
import { tIn } from './i18n'
import ZuschauerListe from './components/zuschauer/ZuschauerListe.vue'

/**
 * Eigene Wurzel für die Zuschauerliste (`#/zuschauer[/<bereich>]`, englisch `#/spectators`; Etappe E3, Plan vom
 * 16.11.2026; src/main.ts wählt sie vor jedem Store). Wie die Anzeigetafel (src/AnzeigeApp.vue): ohne Kopf, Reiter,
 * Banner und Fuß, ohne Handscanner und Offline-Start, mit dem Nur-Lese-Store (state/leseStore.ts) – dieses Fenster
 * schreibt nie in den Stand. Gemerkt wird nur der Klassenfilter, im Speicher des Fensters (lib/merken.ts).
 *
 * Sie liest allein die Zuschauersicht (betrieb/sicht.ts `sichtZuschauer`, aus der öffentlichen abgeleitet) – genau
 * das, was ab E6 ein fremdes Handy über den Zuschauer-Link bekommt. Lokal ist sie für einen weiteren Bildschirm in
 * diesem Browser gedacht; die Seite ist schmal genug fürs Handy.
 */
const store = useLeseStore()

/**
 * Die Sicht nach INHALT stabilisiert (wie AnzeigeApp.vue): Eine Eingabe im Bedienfenster bringt hier einen neuen
 * Stand, aber meist dieselbe Zuschauersicht – dann bleibt die alte, und Vue rechnet nichts neu. Den Namen der
 * Veranstaltung trägt sie nur in der Kopfzeile (`kopf`): Mit eigener Kopfzeile ändert das Tippen des Namens sie nicht;
 * ohne (Vorgabe: Name und Jahr) steht er in `kopf` und wird gezeigt – dann zeichnet sie mit Recht neu.
 */
let text = ''
function sichtZu(stand: AppState): ZuschauerSicht {
  const s = sichtZuschauer(sichtOeffentlich(stand, { logos: false }))
  text = JSON.stringify(s)
  return s
}
const sicht = shallowRef(sichtZu(store.state.value))
watch(
  () => store.state.value,
  (stand) => {
    const vorher = text
    const neu = sichtZu(stand)
    if (text !== vorher) sicht.value = neu
  },
)

// Die Uhr für die Wartezeiten: am Bedienrechner ohne Versatz. Minuten genügen – ein Takt von 5 s reicht.
const jetzt = useUhr(5000)

// Welcher Bereich: `#/zuschauer/<bereich>` zeigt nur ihn – gibt es ihn (noch) nicht, alle.
const ort = ref(vollbild())
const beiAdresse = () => (ort.value = vollbild())
const bereiche = computed(() => {
  const b = ort.value?.bereich
  return b && sicht.value.bereiche.some((x) => x.id === b) ? [b] : undefined
})

// Fenstertitel in der Sprache der Liste: „Startfolge – Musterpokal 2026“.
watchEffect(() => {
  document.title = [tIn(sicht.value.sprache, 'zuschauer.titel'), sicht.value.kopf].filter(Boolean).join(' – ')
  document.documentElement.lang = sicht.value.sprache
})

let opener: (() => void) | undefined
onMounted(() => {
  document.documentElement.classList.add('zuschauer-fenster')
  window.addEventListener('hashchange', beiAdresse)
  // Rückfall, wo das storage-Ereignis nicht trägt (file://): Das Bedienfenster stößt an (lib/anzeigeFenster.ts).
  opener = folgeBedienfenster(store.lies)
})
onBeforeUnmount(() => {
  document.documentElement.classList.remove('zuschauer-fenster')
  window.removeEventListener('hashchange', beiAdresse)
  opener?.()
})
</script>

<template>
  <main class="zuschauer-app">
    <h1 class="zuschauer-kopf">{{ sicht.kopf || tIn(sicht.sprache, 'zuschauer.titel') }}</h1>
    <ZuschauerListe :sicht="sicht" :jetzt="jetzt" :bereiche="bereiche" />
  </main>
</template>
