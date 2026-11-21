import { createApp, type Component } from 'vue'
import App from './App.vue'
import AnzeigeApp from './AnzeigeApp.vue'
import ZuschauerApp from './ZuschauerApp.vue'
import GeraetApp from './GeraetApp.vue'
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
import type { VollbildArt } from './lib/adressen'
import { verbindeAnzeigen } from './lib/anzeigeFenster'
import { geraeteHostKey, starteGeraeteHost } from './geraete/host'

// Die Wurzel folgt der Adresse – und zwar VOR jedem Store: Die Fenster der Anzeigetafel (`#/anzeige`) und der
// Zuschauerliste (`#/zuschauer`) dürfen nie den vollen Store anlegen, der beim Start schreibt (Kennung, zweiter
// Speicher); ein fremdes Gerät mit Lese-Link (`#/sehen/<paket>`, E6) hat gar keinen Store – es berührt den Stand
// einer Veranstaltung nie. Wechselt die Adresse später auf eine andere Wurzel (Anzeigetafel, Zuschauerliste,
// Gerät, gewöhnliche Ansicht), lädt das Fenster neu und wählt sie so. Lese-Link, Koppel-Link (`#/koppeln/<paket>`,
// E7) und gekoppeltes Gerät (`#/geraet`) sind EINE Wurzel: GeraetApp ersetzt den Koppel-Link selbst durch `#/geraet`
// (das Paket mit dem QR-Token soll nicht in der Adresse bleiben) – ein Neuladen dabei verlöre die Anmeldung.
// Die Übung der WKR-Maske (`#/uebung`, W3.4, G13) gehört ebenfalls dazu: ohne Store, ohne Netz, und der Verweis
// „Üben ohne Verbindung“ im Koppel-Formular wechselt so ohne Neuladen.
const wurzel = (art: VollbildArt | null) => (art === 'sehen' || art === 'koppeln' || art === 'geraet' || art === 'uebung' ? 'geraet' : art)
const fenster = wurzel(vollbild()?.art ?? null)
window.addEventListener('hashchange', () => {
  if (wurzel(vollbild()?.art ?? null) !== fenster) location.reload()
})

if (fenster === 'anzeige') starteNurLesen(AnzeigeApp)
else if (fenster === 'zuschauer') starteNurLesen(ZuschauerApp)
else if (fenster === 'geraet') starteGeraet()
else starteBedienung()

/**
 * Anzeigetafel (src/AnzeigeApp.vue) bzw. Zuschauerliste (src/ZuschauerApp.vue): nur lesen – kein Offline-Start,
 * kein Handscanner, kein Kopf; der Nur-Lese-Store schreibt nie (state/leseStore.ts).
 */
function starteNurLesen(wurzel: Component) {
  createApp(wurzel).provide(leseStoreKey, createLeseStore()).mount('#app')
}

/**
 * Ein fremdes Gerät mit Lese-Link (src/GeraetApp.vue, E6) oder gekoppelt für die Start-Freigabe (E7): ohne Store, ohne Handscanner, ohne Kopf. Der
 * Offline-Speicher bleibt (Neuladen ohne Netz zeigt die abgelegte Sicht), übernimmt eine neue Fassung aber nie von
 * selbst – nur gezielt, wenn der Bedienrechner eine neuere spricht (Plan §4, F7; GeraetApp.vue `aktualisiere`).
 */
function starteGeraet() {
  createApp(GeraetApp).mount('#app')
  void starteOffline(offlineBrowser())
}

function starteBedienung() {
  const store = createStore()
  // Gerätebetrieb (E6): verbindet sich erst, wenn unter Betrieb → Geräte ein Raum geöffnet ist (geraete/host.ts) –
  // bis dahin verlässt nichts den Browser.
  const geraete = starteGeraeteHost(store)
  createApp(App).provide(storeKey, store).provide(geraeteHostKey, geraete).mount('#app')

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
