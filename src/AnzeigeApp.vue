<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, watchEffect } from 'vue'
import './styles/anzeige.css'
import type { AppState, OeffentlicheSicht } from './types'
import { useLeseStore } from './state/leseStore'
import { sichtOeffentlich } from './betrieb/sicht'
import { vollbild } from './lib/router'
import { folgeBedienfenster } from './lib/anzeigeFenster'
import { useTafelFenster } from './lib/tafelFenster'
import { useWachBleiben } from './lib/wachBleiben'
import { tIn } from './i18n'
import AnzeigeTafel from './components/anzeige/AnzeigeTafel.vue'

/**
 * Eigene Wurzel für das Fenster der Anzeigetafel (`#/anzeige[/<bereich>]`; src/main.ts wählt sie vor jedem
 * Store). Ohne Kopf, Reiter, Banner und Fuß, ohne Handscanner und ohne Offline-Start – und mit dem
 * Nur-Lese-Store (state/leseStore.ts): Dieses Fenster schreibt nie, es gibt neben dem Bedienfenster
 * keinen zweiten Schreiber (Plan vom 16.11.2026).
 */
const store = useLeseStore()

/**
 * Die Sicht nach INHALT stabilisiert: Jede Eingabe im Bedienfenster liefert hier einen neuen Stand, aber
 * meist dieselbe Sicht. Nur wenn sich ihr Text ändert, wird sie ersetzt – sonst bliebe das DOM zwar
 * gleich, doch Vue rechnete die Tafel neu und lib/fit.ts mäße jede Zeile nach. So rührt eine Eingabe im
 * anderen Fenster die Tafel gar nicht an.
 *
 * Verglichen wird ohne `veranstaltung`: Den Namen braucht nur die Start-Freigabe (Meldungsvorlagen), die Tafel
 * zeigt ihn nicht – und EventView schickt ihn bei jedem Tastendruck. Mit eigener Kopfzeile zeichnete das Tippen
 * des Namens sonst die Tafel bei jedem Zeichen neu (lib/fit.ts misst dann jede Zeile nach).
 */
let text = ''
function sichtZu(stand: AppState): OeffentlicheSicht {
  const s = sichtOeffentlich(stand)
  text = JSON.stringify({ ...s, veranstaltung: '' })
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

// Welcher Bereich: `#/anzeige/<bereich>` zeigt nur ihn – gibt es ihn (noch) nicht, die gemeinsame Tafel.
const ort = ref(vollbild())
const beiAdresse = () => (ort.value = vollbild())
const bereiche = computed(() => {
  const b = ort.value?.bereich
  return b && sicht.value.bereiche.some((x) => x.id === b) ? [b] : undefined
})

// Eigener Fenstertitel, in der Sprache der Tafel: Er steht in der Taskleiste des zweiten Bildschirms.
watchEffect(() => {
  const name = bereiche.value ? sicht.value.bereiche.find((b) => b.id === bereiche.value![0])?.name : ''
  document.title = [tIn(sicht.value.sprache, 'anzeige.titel'), name, sicht.value.kopf].filter(Boolean).join(' – ')
})

// Taste F / Doppelklick = Vollbild, Mauszeiger weg nach kurzer Ruhe – wie auf einem Gerät mit Lese-Link (E6).
const { zeigerWeg, vollbildUmschalten } = useTafelFenster()
// Bildschirm wach halten, solange das Fenster offen ist (E8, 20.11.2026): Eine Tafel, die nach Minuten dunkel wird,
// nützt am Steg nichts. Ohne API (file://, alter Browser) still – am Bedienrechner hilft dann die Energieeinstellung.
useWachBleiben()

let opener: (() => void) | undefined
onMounted(() => {
  document.documentElement.classList.add('anzeige-fenster')
  window.addEventListener('hashchange', beiAdresse)
  // Rückfall, wo das storage-Ereignis nicht trägt (file://): Das Bedienfenster stößt an (lib/anzeigeFenster.ts).
  opener = folgeBedienfenster(store.lies)
})
onBeforeUnmount(() => {
  document.documentElement.classList.remove('anzeige-fenster')
  window.removeEventListener('hashchange', beiAdresse)
  opener?.()
})
</script>

<template>
  <div class="anzeige-app" :class="{ 'zeiger-weg': zeigerWeg }" @dblclick="vollbildUmschalten">
    <AnzeigeTafel :sicht="sicht" :bereiche="bereiche" />
  </div>
</template>
