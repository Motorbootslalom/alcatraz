<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useStore } from '../state/store'
import { LISTEN_SPRACHEN, WKR_LEERZEILEN_MAX, WKR_TEILEN_AB_MAX, WKR_ZEILEN_JE_SEITE_MAX } from '../state/reducer'
import { streichlaeufeVon } from '../lib/ergebnis'
import { classColor } from '../domain/classes'
import { defaultKuerzel, normalizeName } from '../domain/kuerzel'
import { downloadText, filename, makeFile, parseFile, type FileKind } from '../persistenz/backup'
import { loadLegacyVerzahnung } from '../persistenz/storage'
import { BESCHRIFTUNGEN, sollgewichtOf } from '../config/catalog'
import { bietetEnglisch } from '../lib/listensprache'
import { useEvent } from '../lib/event'
import { useKonfig } from '../lib/konfig'
import { zusatzListen } from '../lib/listen'
import { originOf } from '../lib/origin'
import { verlustBeimErsetzen } from '../lib/eingabenVerlust'
import { formatDateTime, t, tn } from '../i18n'
import type { ClassId, OriginStyle, ErgebnisFassung, ErgebnisHerkunft, ErgebnisNamen, LaufzettelLayout, ListenSprache } from '../types'
import EigeneAufbautenPanel from '../components/EigeneAufbautenPanel.vue'
import WkrEinteilung from '../components/WkrEinteilung.vue'
import AppearancePanel from '../components/AppearancePanel.vue'
import SettingsNav from '../components/SettingsNav.vue'
import EingabenHinweis from '../components/EingabenHinweis.vue'
import RegelLaeufeHinweis from '../components/RegelLaeufeHinweis.vue'

/**
 * Alle Einstellungen an einem Ort: wie Listen aussehen, welche Kürzel gelten, wer an
 * welcher Liste sitzt (WKR-Einteilung), und die Dateien zum Aufheben
 * und Weitergeben (Sicherung, Vorlage, Teilnehmerdaten).
 */
const { state, dispatch } = useStore()
const { regelwerk, classLabel } = useEvent()
// Leerzeilen und Standardgewichte nur für die Klassen des Regelwerks.
const CLASSES = computed(() => regelwerk.value.klassen.map((id) => ({ id, color: classColor(id) })))
const ORIGIN_STYLES: OriginStyle[] = ['lang', 'kurz']
const ERGEBNIS_FASSUNGEN: ErgebnisFassung[] = ['aushang', 'intern']
const ERGEBNIS_NAMEN: ErgebnisNamen[] = ['voll', 'kurz', 'ohne']
const ERGEBNIS_HERKUNFT: ErgebnisHerkunft[] = ['aus', 'kurz', 'lang']
const dateiFeld = ref<HTMLInputElement | null>(null)
const inhalt = ref<HTMLElement | null>(null)

// „Veranstaltung“ verweist mit `#/einstellungen?wkr` auf die WKR-Einteilung: dann dorthin
// rollen, statt den Abschnitt in der langen Seite suchen zu lassen.
onMounted(async () => {
  // Ebenso `?wertung` aus den Ergebnislisten.
  const ziel = location.hash.includes('?wkr') ? 'wkr-einteilung' : location.hash.includes('?wertung') ? 'wertung' : location.hash.includes('?ergebnislisten') ? 'ergebnislisten' : ''
  if (!ziel) return
  await nextTick()
  document.getElementById(ziel)?.scrollIntoView?.({ block: 'start' })
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

/** Seitenaufteilung: Ein leeres oder unbrauchbares Feld heißt automatisch bzw. „immer teilen“. */
function setzeSeiten(feld: 'zeilenJeSeite' | 'teilenAb', e: Event) {
  const n = parseInt((e.target as HTMLInputElement).value, 10)
  dispatch({ type: 'SET_WKR_SEITEN', patch: { [feld]: Number.isNaN(n) ? null : n } })
  // Der Reducer rundet auf (1 bis 4 → 5); das Feld soll zeigen, was gilt.
  ;(e.target as HTMLInputElement).value = String(feld === 'zeilenJeSeite' ? state.value.wkrZeilenJeSeite : state.value.wkrTeilenAb)
}

// --- Listen der Veranstaltung: zusammengelegte Liste und zusätzliche Listen -------------
const konfig = useKonfig({ einsprachig: true })
const aufbau = computed(() => konfig.value.getAufbau(state.value.aufbau))
/** „Tor 5 + Parcours“ gibt es nur in Aufbauten, die beide Listen haben. */
const kombiListe = computed(() => {
  const kombi = aufbau.value.kombi
  return kombi && konfig.value.getSheetDef(kombi.positionId).title
})
/**
 * Der Name wie in der WKR-Einteilung: der Titel der Liste (in der Listensprache) – der
 * ausführliche aus dem Menü nur, wenn sich mehrere den Titel teilen („Parcours“ mit und ohne Start/Ziel).
 */
const zusatz = computed(() => {
  const k = konfig.value
  const titel = [...aufbau.value.order, ...aufbau.value.zusatz].map((id) => k.getSheetDef(id).title)
  return zusatzListen(k, state.value).map((z) => {
    const def = k.getSheetDef(z.id)
    return { ...z, name: titel.filter((x) => x === def.title).length > 1 ? def.menuLabel : def.title }
  })
})
const LAUFZETTEL_LAYOUTS: LaufzettelLayout[] = ['seite', 'liste']

// --- Sprache der Listen ----------------------------------------------------
// Wählbar nur, wenn das Regelwerk Englisch anbietet (UIM); die Wahl bleibt sonst stehen.
const spracheWaehlbar = computed(() => bietetEnglisch(state.value.regelwerk))

const newName = ref('')
const newShort = ref('')

function addShort() {
  if (!newName.value.trim() || !newShort.value.trim()) return
  dispatch({ type: 'SET_ORIGIN_SHORT', name: newName.value.trim(), short: newShort.value })
  newName.value = ''
  newShort.value = ''
}

// --- Wertung ---------------------------------------------------------------
/** Was sich wählen lässt: die Regel, und jede Zahl, bei der noch ein Lauf zählt. */
const streichWahl = computed(() => ['auto', ...Array.from({ length: Math.max(1, state.value.laufCount) }, (_, i) => String(i))])
const streichlaeufe = computed(() => streichlaeufeVon(state.value.laufCount, state.value.streichlaeufe))
const streichText = (wert: string) =>
  wert === 'auto' ? t('scoring.drop.auto') : wert === '0' ? t('scoring.drop.none') : tn('scoring.drop.n', Number(wert))
function setzeStreichlaeufe(e: Event) {
  const wert = (e.target as HTMLSelectElement).value
  dispatch({ type: 'SET_STREICHLAEUFE', streichlaeufe: wert === 'auto' ? 'auto' : Number(wert) })
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
  // Sind schon Ergebnisse erfasst, ist die Starterliste fest (wie beim Einfügen aus Excel).
  if (result.kind === 'starter' && Object.keys(state.value.eingaben).length > 0) {
    message.value = { ok: false, text: t('import.locked') + ' ' + t('nav.einstellungen') }
    return
  }
  const time = result.savedAt ? formatDateTime(result.savedAt) : t('app.unknown')
  // Mit den Startern gingen ihre erfassten Werte: Die Rückfrage sagt, wie viele betroffen sind.
  const verlust = result.kind === 'starter' ? verlustBeimErsetzen(state.value, result.starters).text : ''
  if (!confirm(t(`files.confirm.${result.kind}`, { time }) + verlust)) return
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
</script>

<template>
  <!-- Links die Sprungleiste, rechts die Blöcke; schmal steht die Leiste als Zeile darüber. -->
  <div class="settings-layout">
  <SettingsNav :inhalt="inhalt" />
  <div ref="inhalt" class="settings-main">
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

    <div class="row" style="align-items: flex-end; gap: 20px; margin-top: 12px">
      <div class="field" style="min-width: 240px">
        <label for="listen-sprache">{{ t('listopt.language') }}</label>
        <select
          id="listen-sprache"
          class="input"
          data-feld="listen-sprache"
          :disabled="!spracheWaehlbar"
          :value="state.listenSprache"
          @change="dispatch({ type: 'SET_LISTEN_SPRACHE', sprache: ($event.target as HTMLSelectElement).value as ListenSprache })"
        >
          <option v-for="s in LISTEN_SPRACHEN" :key="s" :value="s">{{ t(`listopt.language.${s}`) }}</option>
        </select>
      </div>
      <p class="note" data-hinweis="listen-sprache" style="flex: 1; min-width: 220px; margin: 0">
        {{ spracheWaehlbar ? t('listopt.language.hint') : t('listopt.language.unavailable', { rulebook: regelwerk.label }) }}
      </p>
    </div>

    <!-- Laufzettel: wie im Prototyp eine Zeile je Seite, oder dichter eine Zeile je Liste. -->
    <div class="row" style="align-items: flex-end; gap: 20px; margin-top: 12px">
      <div class="field" style="min-width: 240px">
        <label for="laufzettel-layout">{{ t('listopt.runsheet') }}</label>
        <select
          id="laufzettel-layout"
          class="input"
          data-feld="laufzettel-layout"
          :value="state.laufzettelLayout"
          @change="dispatch({ type: 'SET_LAUFZETTEL_LAYOUT', layout: ($event.target as HTMLSelectElement).value as LaufzettelLayout })"
        >
          <option v-for="l in LAUFZETTEL_LAYOUTS" :key="l" :value="l">{{ t(`listopt.runsheet.${l}`) }}</option>
        </select>
      </div>
      <p class="note" style="flex: 1; min-width: 220px; margin: 0">{{ t('listopt.runsheet.hint') }}</p>
    </div>

    <div id="ergebnislisten" class="subhead">{{ t('listopt.results.title') }}</div>
    <p class="hint">{{ t('listopt.results.hint') }}</p>
    <div v-for="f in ERGEBNIS_FASSUNGEN" :key="f" class="row" style="align-items: flex-end; margin-bottom: 10px" :data-fassung="f">
      <b style="width: 90px; padding-bottom: 8px">{{ t(`results.version.${f}`) }}</b>
      <div v-if="f === 'aushang'" class="field">
        <label>{{ t('listopt.results.names') }}</label>
        <div class="segmented">
          <button
            v-for="n in ERGEBNIS_NAMEN"
            :key="n"
            type="button"
            :data-namen="n"
            :class="state.ergebnisListen.aushang.namen === n ? 'active' : ''"
            :aria-pressed="state.ergebnisListen.aushang.namen === n"
            @click="dispatch({ type: 'SET_ERGEBNIS_LISTEN', fassung: 'aushang', patch: { namen: n } })"
          >
            {{ t(`listopt.results.names.${n}`) }}
          </button>
        </div>
      </div>
      <div v-if="state.originMode !== 'none'" class="field">
        <label>{{ t('event.origin') }}</label>
        <div class="segmented">
          <button
            v-for="h in ERGEBNIS_HERKUNFT"
            :key="h"
            type="button"
            :data-herkunft="h"
            :class="state.ergebnisListen[f].herkunft === h ? 'active' : ''"
            :aria-pressed="state.ergebnisListen[f].herkunft === h"
            @click="dispatch({ type: 'SET_ERGEBNIS_LISTEN', fassung: f, patch: { herkunft: h } })"
          >
            {{ t(`listopt.results.origin.${h}`) }}
          </button>
        </div>
      </div>
      <span v-if="f === 'intern'" class="note" style="margin: 0; padding-bottom: 8px">{{ t('listopt.results.internNames') }}</span>
    </div>

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

  <!-- Der Rennleiter entscheidet, wie viele Läufe gestrichen werden (z. B. bei zwei Läufen einer oder keiner). -->
  <div id="wertung" class="panel">
    <h2>{{ t('scoring.title') }}</h2>
    <p class="hint">{{ t('scoring.hint', { runs: state.laufCount }) }}</p>
    <RegelLaeufeHinweis />
    <div class="row" style="align-items: flex-end; gap: 20px">
      <div class="field" style="min-width: 260px">
        <label for="streichlaeufe">{{ t('scoring.drop') }}</label>
        <select id="streichlaeufe" class="input" data-feld="streichlaeufe" :value="String(state.streichlaeufe)" @change="setzeStreichlaeufe">
          <option v-for="w in streichWahl" :key="w" :value="w">{{ streichText(w) }}</option>
          <!-- Eine Zahl, die zur jetzigen Zahl der Läufe nicht mehr passt, bleibt sichtbar. -->
          <option v-if="!streichWahl.includes(String(state.streichlaeufe))" :value="String(state.streichlaeufe)">{{ streichText(String(state.streichlaeufe)) }}</option>
        </select>
      </div>
      <p class="note" data-hinweis="streichlaeufe" role="status" style="flex: 1; min-width: 220px; margin: 0">
        {{ tn('scoring.now', state.laufCount - streichlaeufe, { runs: state.laufCount }) }}
      </p>
    </div>
    <p class="note">{{ t('scoring.note') }}</p>
    <EingabenHinweis />
  </div>

  <!-- Alles zu den Wettkampfrichter-Listen an einer Stelle: wie sie gedruckt werden und wer an
       welcher sitzt. Vor den Standardgewichten, die aus dem Regelwerk kommen und selten geändert werden. -->
  <div class="panel" id="wkr-listen">
    <h2>{{ t('listopt.wkr.title') }}</h2>
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
    <!-- Seitenaufteilung: automatisch nach Messung oder fest (wie im Prototyp „Zeilen / Seite“ und „Teilen ab“). -->
    <div class="row" style="align-items: flex-end; gap: 20px; margin-top: 12px">
      <div class="field" style="width: 230px">
        <label for="wkr-zeilen-je-seite">{{ t('listopt.wkr.rows') }}</label>
        <input
          id="wkr-zeilen-je-seite"
          class="input"
          type="number"
          min="0"
          :max="WKR_ZEILEN_JE_SEITE_MAX"
          data-feld="wkr-zeilen-je-seite"
          :value="state.wkrZeilenJeSeite"
          @change="setzeSeiten('zeilenJeSeite', $event)"
        />
      </div>
      <div class="field" style="width: 230px">
        <label for="wkr-teilen-ab">{{ t('listopt.wkr.splitFrom') }}</label>
        <input
          id="wkr-teilen-ab"
          class="input"
          type="number"
          min="0"
          :max="WKR_TEILEN_AB_MAX"
          data-feld="wkr-teilen-ab"
          :disabled="state.wkrZeilenJeSeite === 0"
          :value="state.wkrTeilenAb"
          @change="setzeSeiten('teilenAb', $event)"
        />
      </div>
    </div>
    <p class="note">{{ t('listopt.wkr.rowsHint') }}</p>
    <p v-if="state.eventKind === 'club'" class="note" data-hinweis="wkr-seiten-club">{{ t('listopt.wkr.rowsClub') }}</p>

    <div class="row" style="align-items: flex-end; gap: 20px; margin-top: 12px">
      <div class="field" style="min-width: 240px">
        <label for="wkr-beschriftung">{{ t('listopt.wkr.sides') }}</label>
        <!-- Die Namen der Schemata stehen in der Konfiguration (einstellungen.yaml), wie die der Aufbauten. -->
        <select
          id="wkr-beschriftung"
          class="input"
          data-feld="wkr-beschriftung"
          :value="state.beschriftung"
          @change="dispatch({ type: 'SET_BESCHRIFTUNG', beschriftung: ($event.target as HTMLSelectElement).value })"
        >
          <option v-for="b in BESCHRIFTUNGEN" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
      </div>
      <p class="note" style="flex: 1; min-width: 220px; margin: 0">{{ t('listopt.wkr.sidesHint') }}</p>
    </div>

    <!-- Welche Listen die Veranstaltung über den Aufbau hinaus hat (lib/listen.ts). -->
    <template v-if="kombiListe">
      <label class="boat-check" style="margin-top: 12px">
        <input
          type="checkbox"
          data-feld="wkr-tor5-mit-parcours"
          :checked="state.tor5MitParcours"
          @change="dispatch({ type: 'SET_TOR5_MIT_PARCOURS', on: ($event.target as HTMLInputElement).checked })"
        />
        {{ t('listopt.wkr.combo') }}
      </label>
      <p class="note">{{ t('listopt.wkr.comboHint', { list: kombiListe }) }}</p>
    </template>
    <fieldset v-if="zusatz.length > 0" class="zusatz-listen" data-feld="wkr-zusatzlisten">
      <legend>{{ t('listopt.wkr.extra') }}</legend>
      <label v-for="z in zusatz" :key="z.id" class="boat-check">
        <input
          type="checkbox"
          :data-liste="z.id"
          :checked="z.an"
          @change="dispatch({ type: 'SET_ZUSATZ_LISTE', liste: z.id, an: ($event.target as HTMLInputElement).checked })"
        />
        {{ z.name }}
        <span v-if="z.vorgabe" class="note zusatz-vorgabe">{{ t('listopt.wkr.extraPreset', { rulebook: regelwerk.label }) }}</span>
      </label>
    </fieldset>
    <p v-if="zusatz.length > 0" class="note">{{ t('listopt.wkr.extraHint', { setup: aufbau.name }) }}</p>

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
    <!-- Nur bei der Clubmeisterschaft stehen mehrere Klassen auf einem Bogen. -->
    <template v-if="state.eventKind === 'club'">
      <label class="boat-check" style="margin-top: 12px">
        <input
          type="checkbox"
          data-feld="wkr-club-gemeinsam"
          :checked="state.wkrClubGemeinsam"
          @change="dispatch({ type: 'SET_WKR_CLUB_GEMEINSAM', gemeinsam: ($event.target as HTMLInputElement).checked })"
        />
        {{ t('listopt.wkr.clubJoint') }}
      </label>
      <p class="note">{{ t('listopt.wkr.clubJointHint') }}</p>
    </template>
  </div>

  <!-- Die Namen sind Daten der Veranstaltung (nur in der Sicherung, nie in der Vorlage);
       gepflegt werden sie trotzdem hier, bei den Listen. -->
  <WkrEinteilung />

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
  </div>
  </div>
</template>
