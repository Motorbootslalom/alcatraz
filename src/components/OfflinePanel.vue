<script setup lang="ts">
import { computed, inject } from 'vue'
import { t, type MessageKey } from '../i18n'
import { bitteDauerhaft, neuLaden, offline, sucheNeueFassung } from '../lib/offline'
import { BUILD_COMMIT, BUILD_COMMIT_TIME, BUILD_TIME } from '../lib/build'
import { fassungsText, useUpdate } from '../lib/update'
import { storeKey } from '../state/store'

/**
 * „Ohne Internet“: ob das Programm vollständig auf dem Gerät liegt, ob eine neue Fassung wartet
 * und ob der Browser zugesagt hat, die Daten zu behalten. Die Stelle, an der man vor dem
 * Wettkampf nachsieht; die Fußzeile zeigt dasselbe in einem Wort (App.vue).
 */
const zeile = computed<MessageKey>(() => {
  if (offline.lage === 'bereit') return 'offline.state.bereit'
  if (offline.lage === 'vorbereiten') return 'offline.state.vorbereiten'
  return offline.grund === 'datei' ? 'offline.state.datei' : 'offline.state.nicht'
})
const erklaerung = computed(() =>
  offline.lage === 'nicht-verfuegbar'
    ? t(`offline.about.${offline.grund ?? 'browser'}`)
    : t(`offline.about.${offline.lage}`, { n: offline.dateien, commit: offline.fassung || BUILD_COMMIT || t('app.unknown') }),
)
// Zweiter Speicher (state/zweit.ts): ob eine Änderung auch einen harten Abbruch übersteht.
const zweit = inject(storeKey, null)?.zweit
// Welche Fassung läuft (die dieser Seite – dieselben Angaben wie in der Fußzeile) und welche bereitliegt.
const laeuft = computed(() => fassungsText(BUILD_COMMIT, BUILD_COMMIT_TIME, BUILD_TIME))
const bereit = computed(() => fassungsText(offline.neuFassung, offline.neuCommitZeit, offline.neuZeit))
const update = useUpdate()
const gut = computed(() => offline.lage === 'bereit' || offline.grund === 'datei')
</script>

<template>
  <div id="offline" class="panel offline-panel">
    <h2>{{ t('offline.title') }}</h2>
    <p class="offline-zeile" role="status">
      <span :class="['offline-punkt', gut ? 'gut' : offline.lage === 'vorbereiten' ? 'wartet' : 'aus']" aria-hidden="true" />
      <strong data-offline-lage>{{ t(zeile) }}</strong>
    </p>
    <p class="hint">{{ erklaerung }} {{ t('offline.dataNote') }}</p>

    <p v-if="offline.ersetzt" class="boat-banner warn" role="status">
      {{ t('offline.replaced.text') }}
      <button class="btn sm" data-action="offline-neu-laden" @click="neuLaden()">{{ t('offline.replaced.reload') }}</button>
    </p>
    <p v-else-if="offline.neu" class="boat-banner ok" role="status">
      {{ t('offline.update.text') }}
      {{ t('offline.update.note') }}
      <button class="btn sm primary" data-action="offline-uebernehmen" :disabled="offline.uebernimmt" @click="update()">
        {{ t(offline.uebernimmt ? 'offline.update.busy' : 'offline.update.take') }}
      </button>
    </p>
    <p v-else-if="offline.laedtNeu" class="note">{{ t('offline.update.loading') }}</p>

    <ul class="offline-fassungen" data-offline-fassungen>
      <li data-fassung="laeuft">{{ t('offline.version.running', { fassung: laeuft }) }}</li>
      <li v-if="offline.neu" data-fassung="bereit">
        <strong>{{ t('offline.version.ready', { fassung: bereit }) }}</strong>
      </li>
    </ul>
    <p v-if="offline.lage !== 'nicht-verfuegbar'" class="note">{{ t('offline.update.empty') }}</p>

    <!-- Ließ sich der Speicher nicht einrichten, ist derselbe Knopf ein neuer Versuch. -->
    <div v-if="offline.lage !== 'nicht-verfuegbar' || offline.grund === 'fehler'" class="row" style="align-items: center">
      <button class="btn sm" data-action="offline-suchen" :disabled="offline.suche === 'laeuft'" @click="sucheNeueFassung()">
        {{ t(offline.grund === 'fehler' ? 'offline.retry' : 'offline.search') }}
      </button>
      <span v-if="offline.suche" class="note" style="margin: 0" role="status">{{ t(`offline.search.${offline.suche}`) }}</span>
    </div>

    <ul v-if="offline.eindatei" class="file-list" style="margin-top: 14px">
      <li>
        <a class="btn" href="./alcatraz.html" download="alcatraz.html">{{ t('offline.single') }}</a>
        <span class="note">{{ t('offline.singleNote') }}</span>
      </li>
    </ul>

    <h3>{{ t('offline.persist.title') }}</h3>
    <p class="hint" data-offline-dauerhaft>
      <span :class="['offline-punkt', offline.dauerhaft === 'ja' ? 'gut' : 'aus']" aria-hidden="true" />{{ t(`offline.persist.${offline.dauerhaft}`) }}
      <button v-if="offline.dauerhaft === 'nein'" class="btn sm" data-action="offline-dauerhaft" @click="bitteDauerhaft()">{{ t('offline.persist.ask') }}</button>
    </p>
    <p v-if="offline.abgelehnt" class="note" role="status">{{ t('offline.persist.denied') }}</p>
    <p v-if="zweit" class="hint" data-offline-zweit :data-lage="zweit.lage.value">
      <span :class="['offline-punkt', zweit.lage.value === 'bereit' ? 'gut' : zweit.lage.value === 'pruefen' ? 'wartet' : 'aus']" aria-hidden="true" />{{
        t(`offline.second.${zweit.lage.value}`)
      }}
    </p>
    <p class="note">{{ t('offline.persist.backup') }}</p>
  </div>
</template>
