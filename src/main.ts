import { createApp } from 'vue'
import App from './App.vue'
import { createStore, storeKey } from './state/store'
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
import './lib/theme'
import { offlineBrowser, starteOffline } from './lib/offline'
import { standLeer } from './lib/eingaben'

const store = createStore()
createApp(App).provide(storeKey, store).mount('#app')

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
