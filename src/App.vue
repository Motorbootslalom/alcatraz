<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, watch, watchEffect } from 'vue'
import { useStore } from './state/store'
import { navigate, useRoute, VIEWS } from './lib/router'
import { hoereAufScanner } from './lib/scanner'
import { meldeScan } from './lib/scan'
import { BUILD_COMMIT, BUILD_COMMIT_TIME, BUILD_TIME } from './lib/build'
import { formatDateTime, t, tn } from './i18n'
import AppLogo from './components/AppLogo.vue'
import LocaleSelect from './components/LocaleSelect.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import ToTop from './components/ToTop.vue'
import EventView from './views/EventView.vue'
import StartersView from './views/StartersView.vue'
import VerzahnungView from './views/VerzahnungView.vue'
import WeighingView from './views/WeighingView.vue'
import ListsView from './views/ListsView.vue'
import ErfassungView from './views/ErfassungView.vue'
import SettingsView from './views/SettingsView.vue'

const { state, saved, stelleHer } = useStore()

// Der Fenstertitel folgt der Sprache – er ist auch der vorgeschlagene Name beim Speichern als PDF.
watchEffect(() => {
  document.title = [state.value.eventName, 'Alcatraz', t('app.subtitle')].filter(Boolean).join(' – ')
})
const view = useRoute()

// Wie weit man in einer Ansicht gerollt war, gilt beim Zurückkommen wieder – zusammen mit der
// Auswahl, die sich die Ansichten selbst merken (lib/merken.ts). Die Position wird laufend
// notiert, weil beim Wechsel schon die neue Ansicht im Fenster steht.
const rollStand = new Map<string, number>()
window.addEventListener('scroll', () => rollStand.set(view.value, window.scrollY), { passive: true })
watch(view, async (neu) => {
  const ziel = rollStand.get(neu) ?? 0
  await nextTick()
  // Ein Verweis mit Sprungziel (`#/einstellungen?wkr`) rollt selbst dorthin.
  if (!location.hash.includes('?')) window.scrollTo({ top: ziel })
})

// Handscanner: Er tippt den QR-Code eines Bogens oder Laufzettels wie eine Tastatur – in
// jeder Ansicht, auch ohne Klick in ein Feld. Der Code führt in die Erfassung, die ihn
// auswertet (views/ErfassungView.vue); nur ihr Scan-Feld liest selbst.
let scannerAb: (() => void) | undefined
onMounted(() => {
  scannerAb = hoereAufScanner(
    (code) => {
      meldeScan(code)
      if (view.value !== 'erfassung') navigate('erfassung')
    },
    (el) => el instanceof HTMLElement && el.hasAttribute('data-scan-feld'),
    undefined,
    // Die ersten Zeichen eines Scans treffen das Feld, in dem der Cursor steht (eine Zelle
    // der Erfassung, die Auswahlliste des Aufbaus …): Der Stand von davor gilt wieder.
    { merke: () => state.value, stelleHer },
  )
})
onBeforeUnmount(() => scannerAb?.())

function commitLabel(): string {
  if (!BUILD_COMMIT) return t('app.unknown')
  const time = formatDateTime(BUILD_COMMIT_TIME)
  return time ? `${BUILD_COMMIT} (${time})` : BUILD_COMMIT
}
</script>

<template>
  <div class="app">
    <header class="topbar no-print">
      <div class="topbar-inner">
        <div class="brand">
          <AppLogo />
          <h1>Alcatraz</h1>
          <span class="sub">{{ t('app.subtitle') }}</span>
        </div>
        <div class="topbar-spacer" />
        <div class="event-line">
          <template v-if="state.eventName">{{ state.eventName }} · {{ state.eventJahr }} · </template>
          {{ tn('app.starters', state.starters.length) }}
        </div>
        <ThemeToggle />
        <LocaleSelect />
      </div>
      <nav class="tabs">
        <a
          v-for="v in VIEWS"
          :key="v"
          :href="`#/${v}`"
          :class="['tab', view === v ? 'active' : '', v === 'einstellungen' ? 'settings' : '']"
          :aria-current="view === v ? 'page' : undefined"
        >
          <svg v-if="v === 'einstellungen'" class="gear" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7.3 7.3 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.4h-4a.5.5 0 0 0-.5.4l-.4 2.6a7.3 7.3 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6L4.600 11a7.500 7.500 0 0 0 0 2l-2.100 1.600a.5.5 0 0 0-.1.6l2 3.5c.1.2.4.3.6.2l2.500-1c.5.4 1.100.7 1.700 1l.4 2.600c0 .200.200.400.500.400h4c.3 0 .5-.2.5-.4l.4-2.600a7.300 7.300 0 0 0 1.700-1l2.500 1c.2.100.500 0 .600-.200l2-3.500a.5.5 0 0 0-.1-.6L19.400 13ZM12 15.500a3.500 3.500 0 1 1 0-7 3.500 3.500 0 0 1 0 7Z"
            />
          </svg>
          {{ t(`nav.${v}`) }}
        </a>
      </nav>
    </header>

    <p v-if="!saved" class="boat-banner warn no-print" role="alert">{{ t('app.notSaved') }}</p>

    <main>
      <EventView v-if="view === 'veranstaltung'" />
      <StartersView v-else-if="view === 'starter'" />
      <WeighingView v-else-if="view === 'verwiegung'" />
      <VerzahnungView v-else-if="view === 'verzahnung'" />
      <ListsView v-else-if="view === 'listen'" />
      <ErfassungView v-else-if="view === 'erfassung'" />
      <SettingsView v-else-if="view === 'einstellungen'" />
    </main>

    <ToTop />

    <footer class="version-footer no-print">
      {{ t('app.footer', { commit: commitLabel(), time: formatDateTime(BUILD_TIME) || t('app.unknown') }) }}
    </footer>
  </div>
</template>
