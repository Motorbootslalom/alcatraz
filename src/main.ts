import { createApp, type Component } from 'vue'
import App from './App.vue'
import AnzeigeApp from './AnzeigeApp.vue'
import ZuschauerApp from './ZuschauerApp.vue'
import { createStore, storeKey } from './state/store'
import { createLeseStore, leseStoreKey } from './state/leseStore'
import './styles/app.css'
import './styles/themes.css'
import './styles/blatt.css'
import './styles/print.css'
import './styles/bogen.css'
import './styles/erfassung.css'
import './styles/ergebnis.css'
import './styles/pokal.css'
import './styles/laufzettel.css'
import './styles/aushang.css'
import './styles/logos.css'
import './lib/theme'
import { offlineBrowser, starteOffline } from './lib/offline'
import { standLeer } from './lib/eingaben'
import { vollbild } from './lib/router'
import { verbindeAnzeigen } from './lib/anzeigeFenster'

// Die Wurzel folgt der Adresse – und zwar VOR jedem Store: Die Fenster der Anzeigetafel (`#/anzeige`) und der
// Zuschauerliste (`#/zuschauer`) dürfen nie den vollen Store anlegen, der beim Start schreibt (Kennung, zweiter
// Speicher). Wechselt die Adresse später auf eine andere Wurzel (Anzeigetafel, Zuschauerliste, gewöhnliche
// Ansicht), lädt das Fenster neu und wählt sie so.
const fenster = vollbild()?.art ?? null
window.addEventListener('hashchange', () => {
  if ((vollbild()?.art ?? null) !== fenster) location.reload()
})

if (fenster === 'anzeige') starteNurLesen(AnzeigeApp)
else if (fenster === 'zuschauer') starteNurLesen(ZuschauerApp)
else starteBedienung()

/**
 * Anzeigetafel (src/AnzeigeApp.vue) bzw. Zuschauerliste (src/ZuschauerApp.vue): nur lesen – kein Offline-Start,
 * kein Handscanner, kein Kopf; der Nur-Lese-Store schreibt nie (state/leseStore.ts).
 */
function starteNurLesen(wurzel: Component) {
  createApp(wurzel).provide(leseStoreKey, createLeseStore()).mount('#app')
}

function starteBedienung() {
  const store = createStore()
  createApp(App).provide(storeKey, store).mount('#app')

  // Die Anzeigetafeln, die dieses Fenster geöffnet hat, nach jeder Änderung anstoßen – Rückfall, wo das
  // storage-Ereignis zwischen Fenstern nicht trägt (file://; lib/anzeigeFenster.ts).
  verbindeAnzeigen(() => store.state.value)

  // Hat jemand in diesem Fenster schon etwas angefasst? Dann lädt es nicht mehr von selbst neu.
  let beruehrt = false
  for (const art of ['pointerdown', 'keydown'] as const) window.addEventListener(art, () => (beruehrt = true), { capture: true, passive: true })

  // Offline-Speicher für das Programm: nach dem ersten Bild, damit er den Start nicht bremst – und
  // nach dem Abgleich mit dem zweiten Speicher: Erst dann steht fest, ob der Stand wirklich leer
  // ist (nach einem harten Abbruch kann er aus dem zweiten Speicher zurückkommen).
  void store.zweit
    .eintraege()
    .catch(() => [])
    .then(() =>
      starteOffline({
        ...offlineBrowser(),
        // Eine neue Fassung von selbst nur bei leerem Stand: beim Öffnen immer; wird sie erst
        // später fertig geladen, nur solange noch niemand im Fenster gearbeitet hat.
        darfVonSelbst: (beimStart) => standLeer(store.state.value) && (beimStart || !beruehrt),
      }),
    )
}
