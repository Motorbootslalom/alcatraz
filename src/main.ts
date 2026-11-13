import { createApp } from 'vue'
import App from './App.vue'
import { createStore, storeKey } from './state/store'
import './styles/app.css'
import './styles/themes.css'
import './styles/print.css'
import './styles/bogen.css'
import './lib/theme'

createApp(App).provide(storeKey, createStore()).mount('#app')
