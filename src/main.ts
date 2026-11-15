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
import { starteOffline } from './lib/offline'

createApp(App).provide(storeKey, createStore()).mount('#app')

// Offline-Speicher für das Programm: nach dem ersten Bild, damit er den Start nicht bremst.
void starteOffline()
