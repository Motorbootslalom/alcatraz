<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useStore } from '../state/store'
import { WKR_LEERZEILEN_MAX } from '../state/reducer'
import { classColor } from '../domain/classes'
import { generateStarters } from '../domain/generate'
import { defaultKuerzel, normalizeName } from '../domain/kuerzel'
import { downloadText, filename, makeFile, parseFile, type FileKind } from '../persistenz/backup'
import { loadLegacyVerzahnung } from '../persistenz/storage'
import { sollgewichtOf } from '../config/catalog'
import { useEvent } from '../lib/event'
import { originOf } from '../lib/origin'
import { formatDateTime, t } from '../i18n'
import type { ClassId, OriginStyle, Starter } from '../types'
import EigeneAufbautenPanel from '../components/EigeneAufbautenPanel.vue'
import WkrEinteilung from '../components/WkrEinteilung.vue'
import AppearancePanel from '../components/AppearancePanel.vue'

/**
 * Alle Einstellungen an einem Ort: wie Listen aussehen, welche Kürzel gelten, wer an
 * welcher Liste sitzt (WKR-Einteilung mit Beispielansicht), und die Dateien zum Aufheben
 * und Weitergeben (Sicherung, Vorlage, Teilnehmerdaten).
 */
const { state, dispatch } = useStore()
const { regelwerk, classLabel } = useEvent()
// Beispieldaten nur für die Klassen des Regelwerks.
const CLASSES = computed(() => regelwerk.value.klassen.map((id) => ({ id, color: classColor(id) })))
const ORIGIN_STYLES: OriginStyle[] = ['lang', 'kurz']
const dateiFeld = ref<HTMLInputElement | null>(null)

// „Veranstaltung“ verweist mit `#/einstellungen?wkr` auf die WKR-Einteilung: dann dorthin
// rollen, statt den Abschnitt in der langen Seite suchen zu lassen.
onMounted(async () => {
  if (!location.hash.includes('?wkr')) return
  await nextTick()
  document.getElementById('wkr-einteilung')?.scrollIntoView?.({ block: 'start' })
})

// --- Kürzel der Herkunft ---------------------------------------------------
/**
 * Zeilen der Kürzel-Tabelle: jede Herkunft, die bei den Startern vorkommt, und
 * jeder eigene Eintrag – auch wenn gerade kein Starter dazu gehört.
 */
const shortRows = computed(() => {
  const names = new Map<string, string>()
  const add = (name: string) => {
    const key = normalizeName(name)
    if (key && !names.has(key)) names.set(key, name.trim())
  }
  for (const p of state.value.starters) add(originOf(p, state.value.originMode))
  Object.keys(state.value.originShort).forEach(add)
  const own = new Map(Object.entries(state.value.originShort).map(([name, short]) => [normalizeName(name), { name, short }]))
  return [...names]
    .map(([key, name]) => ({
      name: own.get(key)?.name ?? name,
      own: own.get(key)?.short ?? '',
      preset: defaultKuerzel(name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

// --- Wettkampfrichter-Listen ------------------------------------------------
const eigeneLeerzeilen = computed(() => Object.keys(state.value.wkrLeerzeilenKlasse).length)

/** Ein leeres oder unbrauchbares Feld heißt: wieder die allgemeine Zahl (bzw. die Vorgabe). */
function setzeLeerzeilen(klasse: ClassId | undefined, e: Event) {
  const n = parseInt((e.target as HTMLInputElement).value, 10)
  dispatch({ type: 'SET_WKR_LEERZEILEN', klasse, anzahl: Number.isNaN(n) ? null : n })
}

const newName = ref('')
const newShort = ref('')

function addShort() {
  if (!newName.value.trim() || !newShort.value.trim()) return
  dispatch({ type: 'SET_ORIGIN_SHORT', name: newName.value.trim(), short: newShort.value })
  newName.value = ''
  newShort.value = ''
}

// --- Dateien ---------------------------------------------------------------
const FILE_KINDS: FileKind[] = ['sicherung', 'vorlage', 'starter']
const message = ref<{ ok: boolean; text: string } | null>(null)

function download(kind: FileKind) {
  const now = new Date()
  // Der Dateiname folgt der Sprache der Oberfläche (Sicherung / Backup).
  const name = filename(kind, t(`files.download.${kind}`), state.value, now)
  downloadText(name, JSON.stringify(makeFile(kind, state.value, now.toISOString()), null, 2))
}

/** Eine Datei einspielen. Welche Art es ist, steht in der Datei; gefragt wird vor jedem Überschreiben. */
async function upload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const result = parseFile(await file.text())
  if (!result.ok) {
    message.value = { ok: false, text: t('files.invalid') }
    return
  }
  const time = result.savedAt ? formatDateTime(result.savedAt) : t('app.unknown')
  if (!confirm(t(`files.confirm.${result.kind}`, { time }))) return
  if (result.kind === 'sicherung') dispatch({ type: 'LOAD_STATE', state: result.state })
  else if (result.kind === 'vorlage') dispatch({ type: 'LOAD_STATE', state: result.apply(state.value) })
  else dispatch({ type: 'IMPORT_STARTERS', starters: result.starters, mode: 'replace' })
  message.value = { ok: true, text: t(`files.done.${result.kind}`) }
}

function reset() {
  if (confirm(t('backup.resetConfirm'))) dispatch({ type: 'RESET_ALL' })
}

// Stand aus dem Verzahnungs-Prototyp – nur anbieten, solange hier noch nichts liegt.
const legacy = computed(() => (state.value.starters.length === 0 ? loadLegacyVerzahnung() : null))

function takeLegacy() {
  if (legacy.value && confirm(t('backup.legacy.confirm'))) {
    dispatch({ type: 'LOAD_STATE', state: legacy.value })
  }
}

// --- Beispieldaten ---------------------------------------------------------
const counts = reactive<Partial<Record<ClassId, number>>>({})
const countOf = (id: ClassId) => counts[id] ?? 6

function setCount(id: ClassId, e: Event) {
  counts[id] = Math.max(0, Math.min(99, parseInt((e.target as HTMLInputElement).value, 10) || 0))
}

const total = computed(() => CLASSES.value.reduce((sum, c) => sum + countOf(c.id), 0))

function generate() {
  const existing = state.value.starters.length
  if (existing > 0 && !confirm(t('demo.confirm', { n: existing }))) return
  // Erfundene Starter entstehen hier und nicht im Reducer – der bleibt frei von Zufall.
  const origin = state.value.originMode === 'bundesland' ? 'bundesland' : 'verein'
  let starters: Starter[] = []
  for (const c of CLASSES.value) {
    if (countOf(c.id) > 0) {
      starters = starters.concat(generateStarters(c.id, countOf(c.id), state.value.eventJahr, origin, starters))
    }
  }
  dispatch({ type: 'CLEAR_ALL_STARTERS' })
  dispatch({ type: 'ADD_STARTERS', starters })
}
</script>

<template>
  <AppearancePanel />
  <div class="panel">
    <h2>{{ t('listopt.title') }}</h2>
    <div class="row" style="align-items: center; gap: 20px">
      <label class="boat-check">
        <input
          type="checkbox"
          :checked="state.showBirthdate"
          @change="dispatch({ type: 'SET_LIST_OPTIONS', patch: { showBirthdate: ($event.target as HTMLInputElement).checked } })"
        />
        {{ t('listopt.birthdate') }}
      </label>
      <div v-if="state.originMode !== 'none'" class="field">
        <label>{{ t('listopt.origin') }}</label>
        <div class="segmented">
          <button
            v-for="o in ORIGIN_STYLES"
            :key="o"
            type="button"
            :class="state.listOrigin === o ? 'active' : ''"
            :aria-pressed="state.listOrigin === o"
            @click="dispatch({ type: 'SET_LIST_OPTIONS', patch: { listOrigin: o } })"
          >
            {{ t(`listopt.origin.${o}`) }}
          </button>
        </div>
      </div>
    </div>
    <p class="note">{{ t('listopt.note') }}</p>

    <!-- Wettkampfrichter-Listen: Leerzeilen für Nachmeldungen, Beschreibung auf der Rückseite. -->
    <div class="subhead">{{ t('listopt.wkr.title') }}</div>
    <div class="row" style="align-items: flex-end; gap: 20px">
      <div class="field" style="width: 170px">
        <label for="wkr-leerzeilen">{{ t('listopt.wkr.blank') }}</label>
        <input
          id="wkr-leerzeilen"
          class="input"
          type="number"
          min="0"
          :max="WKR_LEERZEILEN_MAX"
          data-feld="wkr-leerzeilen"
          :value="state.wkrLeerzeilen"
          @change="setzeLeerzeilen(undefined, $event)"
        />
      </div>
      <p class="note" style="flex: 1; min-width: 220px; margin: 0">{{ t('listopt.wkr.blankHint') }}</p>
    </div>
    <details class="sub-details" :open="eigeneLeerzeilen > 0">
      <summary>{{ t('listopt.wkr.perClass') }} ({{ eigeneLeerzeilen }})</summary>
      <div class="setup-grid">
        <label v-for="c in CLASSES" :key="c.id" class="class-count">
          <span class="dot" :style="{ background: c.color }" />
          <span class="meta"><span class="name">{{ classLabel(c.id) }}</span></span>
          <input
            type="number"
            min="0"
            :max="WKR_LEERZEILEN_MAX"
            :class="state.wkrLeerzeilenKlasse[c.id] !== undefined ? 'own' : ''"
            :data-feld="`wkr-leerzeilen|${c.id}`"
            :value="state.wkrLeerzeilenKlasse[c.id] ?? state.wkrLeerzeilen"
            :aria-label="t('listopt.wkr.blankFor', { name: classLabel(c.id) })"
            @change="setzeLeerzeilen(c.id, $event)"
          />
        </label>
      </div>
      <div v-if="eigeneLeerzeilen > 0" class="row" style="justify-content: flex-end">
        <button class="btn sm" @click="dispatch({ type: 'SET_WKR_LEERZEILEN', anzahl: state.wkrLeerzeilen, alleKlassen: true })">
          {{ t('listopt.wkr.reset', { n: state.wkrLeerzeilen }) }}
        </button>
      </div>
    </details>
    <label class="boat-check" style="margin-top: 12px">
      <input
        type="checkbox"
        data-feld="wkr-rueckseite"
        :checked="state.wkrRueckseite"
        @change="dispatch({ type: 'SET_WKR_RUECKSEITE', rueckseite: ($event.target as HTMLInputElement).checked })"
      />
      {{ t('listopt.wkr.back') }}
    </label>
    <p class="note">{{ t('listopt.wkr.backHint') }}</p>

    <details v-if="state.originMode !== 'none'" class="sub-details">
      <summary>{{ t('short.title') }} ({{ shortRows.length }})</summary>
      <p class="hint">{{ t('short.hint') }}</p>
      <table class="starters short-table">
        <thead>
          <tr>
            <th>{{ t('short.name') }}</th>
            <th style="width: 150px">{{ t('short.short') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in shortRows" :key="row.name">
            <td>{{ row.name }}</td>
            <td>
              <input
                class="cell-input"
                :value="row.own"
                :placeholder="row.preset"
                :aria-label="t('short.shortFor', { name: row.name })"
                @change="dispatch({ type: 'SET_ORIGIN_SHORT', name: row.name, short: ($event.target as HTMLInputElement).value })"
              />
            </td>
          </tr>
          <tr>
            <td>
              <input v-model="newName" class="cell-input" :placeholder="t('short.newName')" :aria-label="t('short.newName')" @keyup.enter="addShort" />
            </td>
            <td>
              <input v-model="newShort" class="cell-input" :aria-label="t('short.short')" @keyup.enter="addShort" @change="addShort" />
            </td>
          </tr>
        </tbody>
      </table>
    </details>
  </div>

  <div class="panel">
    <h2>{{ t('weigh.standards') }}</h2>
    <p class="hint">{{ t('weigh.standardsHint', { rulebook: regelwerk.label }) }}</p>
    <div class="setup-grid">
      <label v-for="c in CLASSES" :key="c.id" class="class-count">
        <span class="dot" :style="{ background: c.color }" />
        <span class="meta"><span class="name">{{ classLabel(c.id) }}</span></span>
        <input
          type="number"
          min="0"
          max="200"
          :class="state.sollgewicht[c.id] !== undefined ? 'own' : ''"
          :value="sollgewichtOf(state.regelwerk, state.sollgewicht, c.id)"
          :aria-label="t('weigh.standardFor', { name: classLabel(c.id) })"
          :title="t('weigh.preset', { rulebook: regelwerk.label, kg: regelwerk.gewichte[c.id] ?? '–' })"
          @change="dispatch({ type: 'SET_SOLLGEWICHT', klasse: c.id, kg: parseFloat(($event.target as HTMLInputElement).value) || null })"
        />
      </label>
    </div>
    <div v-if="Object.keys(state.sollgewicht).length > 0" class="row" style="align-items: center">
      <span class="note" style="flex: 1; margin: 0">{{ t('weigh.ownNote', { rulebook: regelwerk.label }) }}</span>
      <button class="btn sm" @click="dispatch({ type: 'RESET_SOLLGEWICHT' })">{{ t('weigh.reset', { rulebook: regelwerk.label }) }}</button>
    </div>
  </div>

  <!-- Die Namen sind Daten der Veranstaltung (nur in der Sicherung, nie in der Vorlage);
       gepflegt werden sie trotzdem hier, bei den Listen und ihrer Beispielansicht. -->
  <WkrEinteilung />

  <EigeneAufbautenPanel />

  <div class="panel">
    <h2>{{ t('files.title') }}</h2>
    <p class="hint">{{ t('files.intro') }}</p>
    <ul class="file-list">
      <li v-for="k in FILE_KINDS" :key="k">
        <button class="btn" @click="download(k)">↓ {{ t(`files.download.${k}`) }}</button>
        <span class="note">{{ t(`files.about.${k}`) }}</span>
      </li>
    </ul>
    <div class="row" style="align-items: center; margin-top: 14px">
      <!-- Eine echte Schaltfläche: Ein Feld mit `hidden` ist mit der Tastatur nicht erreichbar. -->
      <button type="button" class="btn primary" data-action="upload-file" @click="dateiFeld?.click()">↑ {{ t('files.upload') }}</button>
      <input ref="dateiFeld" type="file" accept="application/json,.json" hidden @change="upload" />
      <span class="note" style="flex: 1; min-width: 220px">{{ t('files.uploadNote') }}</span>
      <button class="btn danger" @click="reset">{{ t('backup.reset') }}</button>
    </div>
    <p v-if="message" :class="['boat-banner', message.ok ? 'ok' : 'warn']" role="status">{{ message.text }}</p>
    <p v-if="legacy" class="boat-banner ok">
      {{ t('backup.legacy.text', { n: legacy.starters.length }) }}
      <button class="btn sm" @click="takeLegacy">{{ t('backup.legacy.button') }}</button>
    </p>
  </div>

  <details class="panel">
    <summary>{{ t('demo.title') }}</summary>
    <p class="hint">{{ t('demo.intro') }}</p>
    <div class="subhead">{{ t('demo.perClass') }}</div>
    <div class="setup-grid">
      <label v-for="c in CLASSES" :key="c.id" class="class-count">
        <span class="dot" :style="{ background: c.color }" />
        <span class="meta"><span class="name">{{ classLabel(c.id) }}</span></span>
        <input type="number" min="0" max="99" :value="countOf(c.id)" @input="setCount(c.id, $event)" />
      </label>
    </div>
    <div class="row" style="justify-content: flex-end">
      <button class="btn" :disabled="total === 0" @click="generate">{{ t('demo.generate') }}</button>
    </div>
  </details>
</template>
