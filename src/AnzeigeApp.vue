<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, watchEffect } from 'vue'
import './styles/anzeige.css'
import type { AppState, OeffentlicheSicht } from './types'
import { useLeseStore } from './state/leseStore'
import { sichtOeffentlich } from './betrieb/sicht'
import { vollbild } from './lib/router'
import { folgeBedienfenster } from './lib/anzeigeFenster'
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

async function vollbildUmschalten(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  } catch {
    // Ohne Geste des Nutzers verweigert der Browser das Vollbild – dann eben per F11.
  }
}

function beiTaste(e: KeyboardEvent): void {
  if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) void vollbildUmschalten()
}

// Der Mauszeiger verschwindet nach kurzer Ruhe – auf der Tafel hat er nichts verloren.
const zeigerWeg = ref(true)
let zeigerTakt: ReturnType<typeof setTimeout> | undefined
function beiMaus(): void {
  zeigerWeg.value = false
  clearTimeout(zeigerTakt)
  zeigerTakt = setTimeout(() => (zeigerWeg.value = true), 2500)
}

let opener: (() => void) | undefined
onMounted(() => {
  document.documentElement.classList.add('anzeige-fenster')
  window.addEventListener('keydown', beiTaste)
  window.addEventListener('mousemove', beiMaus)
  window.addEventListener('hashchange', beiAdresse)
  // Rückfall, wo das storage-Ereignis nicht trägt (file://): Das Bedienfenster stößt an (lib/anzeigeFenster.ts).
  opener = folgeBedienfenster(store.lies)
})
onBeforeUnmount(() => {
  document.documentElement.classList.remove('anzeige-fenster')
  window.removeEventListener('keydown', beiTaste)
  window.removeEventListener('mousemove', beiMaus)
  window.removeEventListener('hashchange', beiAdresse)
  clearTimeout(zeigerTakt)
  opener?.()
})
</script>

<template>
  <div class="anzeige-app" :class="{ 'zeiger-weg': zeigerWeg }" @dblclick="vollbildUmschalten">
    <AnzeigeTafel :sicht="sicht" :bereiche="bereiche" />
  </div>
</template>
