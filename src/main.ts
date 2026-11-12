import { createApp } from 'vue'
import App from './App.vue'
import { createStore, storeKey } from './state/store'
import './styles/app.css'
import './styles/print.css'

createApp(App).provide(storeKey, createStore()).mount('#app')
