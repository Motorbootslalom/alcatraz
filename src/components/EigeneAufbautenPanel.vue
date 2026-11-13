<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { aufbauOf, DEFAULT_AUFBAU, manoeverAufbauten } from '../config/catalog'
import type { Meldung } from '../config/eigene'
import { downloadText, fileStamp } from '../persistenz/backup'
import { BUILD_COMMIT } from '../lib/build'
import { t, tn, type MessageKey } from '../i18n'
import AufbauAssistent from './AufbauAssistent.vue'

/**
 * Eigene Aufbauten des Veranstalters: anlegen und ändern über den Assistenten, löschen,
 * als YAML-Datei weitergeben und einspielen. Sie liegen im Stand der Veranstaltung und
 * reisen deshalb in Sicherung und Vorlage mit; gewählt wird unter „Veranstaltung“.
 */
const { state, dispatch } = useStore()
const konfig = useKonfig()

const eigene = computed(() => state.value.eigeneAufbauten)
const verdeckt = computed(() => new Set(konfig.value.verdeckteEigene.map((a) => a.id)))
// Was die Prüfung ablehnt (z. B. aus einer beschädigten Sicherung): Kennung → Meldungen.
const abgelehnt = computed(() => new Map(konfig.value.abgelehnteEigene.map((a) => [a.id, a.fehler])))
/** Nutzbar ist ein eigener Aufbau, den weder ein mitgelieferter verdeckt noch die Prüfung ablehnt. */
const nutzbar = (id: string) => !verdeckt.value.has(id) && !abgelehnt.value.has(id)
const vorlagen = computed(() => manoeverAufbauten(eigene.value))

// --- Assistent -------------------------------------------------------------
const assistent = ref<{ modus: 'neu' | 'bearbeiten'; aufbauId: string } | null>(null)
const vorlageId = ref(state.value.aufbau)
// Die gemerkte Vorlage kann verschwinden (gelöscht, Sicherung eingespielt). Dann gilt die
// Vorgabe, statt dass das Feld leer steht und „Ableiten“ einen leeren Assistenten öffnet.
const vorlageWahl = computed(() => (vorlagen.value.some((a) => a.id === vorlageId.value) ? vorlageId.value : DEFAULT_AUFBAU))
const dateiFeld = ref<HTMLInputElement | null>(null)

function oeffne(modus: 'neu' | 'bearbeiten', aufbauId: string) {
  meldung.value = null
  assistent.value = { modus, aufbauId }
}

// --- Meldungen der Prüfung -------------------------------------------------
// Eigene Meldungen sind übersetzt; die Befunde aus config/validate.ts bleiben im deutschen Wortlaut.
const ISSUE_KEYS: Record<string, MessageKey> = {
  YAML: 'own.issue.YAML',
  KEIN_AUFBAU: 'own.issue.KEIN_AUFBAU',
  POSITIONEN_ABSCHNITT: 'own.issue.POSITIONEN_ABSCHNITT',
  AUFBAU_ID: 'own.issue.AUFBAU_ID',
  AUFBAU_NAME: 'own.issue.AUFBAU_NAME',
  AUFBAU_VORHANDEN: 'own.issue.AUFBAU_VORHANDEN',
  AUFBAU_LEER: 'own.issue.AUFBAU_LEER',
  POSITION_ID: 'own.issue.POSITION_ID',
  POSITION_VORHANDEN: 'own.issue.POSITION_VORHANDEN',
  AUFBAU_DISZIPLIN: 'own.issue.AUFBAU_DISZIPLIN',
  DEFEKT: 'own.issue.DEFEKT',
  EN_TITEL_FEHLT: 'own.issue.EN_TITEL_FEHLT',
}
const meldungText = (m: Meldung) => (ISSUE_KEYS[m.code] ? t(ISSUE_KEYS[m.code], m.params) : m.message)

// Nur Daten, kein fertiger Satz: Der Text entsteht in der Vorlage und wechselt mit der Sprache.
const meldung = ref<{ ok: boolean; namen: string[]; fehler: Meldung[]; hinweise: Meldung[] } | null>(null)

// --- Datei -----------------------------------------------------------------
function download(id: string) {
  // Ortszeit wie bei den Sicherungen: `toISOString` rechnet in UTC und nennt kurz nach Mitternacht den Vortag.
  const text = konfig.value.aufbauAlsYaml(id, { datum: fileStamp(new Date()).slice(0, 10), version: BUILD_COMMIT || 'dev' })
  if (text) downloadText(`aufbau-${id}.yaml`, text, 'text/yaml')
}

/** YAML-Datei einspielen: Übernommen wird nur, was die Prüfung besteht; vor dem Ersetzen wird gefragt. */
async function upload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const ergebnis = konfig.value.pruefeEigeneAufbauten(await file.text())
  if (ergebnis.aufbauten.length === 0) {
    meldung.value = { ok: false, namen: [], fehler: ergebnis.fehler, hinweise: [] }
    return
  }
  const neu = new Map(ergebnis.aufbauten.map((a) => [a.id, a]))
  const ersetzt = eigene.value.filter((a) => neu.has(a.id))
  if (ersetzt.length > 0 && !confirm(t('own.replaceConfirm', { names: ersetzt.map((a) => a.name).join(', ') }))) return
  // Vorhandene behalten ihren Platz, neue kommen ans Ende.
  const aufbauten = [
    ...eigene.value.map((a) => neu.get(a.id) ?? a),
    ...ergebnis.aufbauten.filter((a) => !ersetzt.some((x) => x.id === a.id)),
  ]
  dispatch({ type: 'SET_EIGENE_AUFBAUTEN', aufbauten })
  meldung.value = { ok: true, namen: ergebnis.aufbauten.map((a) => a.name), fehler: [], hinweise: ergebnis.hinweise }
}

// --- Löschen und Wählen ----------------------------------------------------
function loesche(id: string) {
  const aufbau = eigene.value.find((a) => a.id === id)
  if (!aufbau) return
  const gewaehlt = state.value.aufbau === id && nutzbar(id)
  const frage = [
    t('own.deleteConfirm', { name: aufbau.name }),
    ...(gewaehlt ? [t('own.deleteConfirmActive', { fallback: aufbauOf(DEFAULT_AUFBAU).name })] : []),
  ].join('\n\n')
  if (!confirm(frage)) return
  meldung.value = null
  // Der Reducer setzt die Wahl auf die Vorgabe zurück, wenn es den gewählten nicht mehr gibt.
  dispatch({ type: 'SET_EIGENE_AUFBAUTEN', aufbauten: eigene.value.filter((a) => a.id !== id) })
}
</script>

<template>
  <div class="panel own-setups">
    <h2>{{ t('own.title') }}</h2>

    <AufbauAssistent
      v-if="assistent"
      :key="assistent.modus + assistent.aufbauId"
      :modus="assistent.modus"
      :aufbau-id="assistent.aufbauId"
      @schliessen="assistent = null"
    />

    <template v-else>
      <p class="hint">{{ t('own.intro') }}</p>

      <table v-if="eigene.length > 0" class="starters own-table">
        <thead>
          <tr>
            <th>{{ t('own.name') }}</th>
            <th>{{ t('own.lists') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in eigene" :key="a.id" :data-aufbau="a.id" :class="{ 'own-rejected': abgelehnt.has(a.id) }">
            <td>
              {{ a.name }}
              <span v-if="state.aufbau === a.id && nutzbar(a.id)" class="own-active">{{ t('own.active') }}</span>
              <div v-if="verdeckt.has(a.id)" class="note">{{ t('own.shadowed') }}</div>
              <!-- Die Zeile bleibt, damit sich der Aufbau herunterladen und löschen lässt. -->
              <div v-if="abgelehnt.has(a.id)" class="boat-banner warn" role="alert">
                {{ t('own.rejected') }}
                <ul>
                  <li v-for="f in abgelehnt.get(a.id)" :key="f.code + f.message">{{ meldungText(f) }}</li>
                </ul>
              </div>
            </td>
            <td>{{ tn('own.listCount', a.positionen.length) }}</td>
            <td class="own-actions">
              <button
                v-if="state.aufbau !== a.id && nutzbar(a.id)"
                type="button"
                class="btn sm"
                data-action="use"
                @click="dispatch({ type: 'SET_AUFBAU', aufbau: a.id })"
              >
                {{ t('own.use') }}
              </button>
              <button v-if="nutzbar(a.id)" type="button" class="btn sm" data-action="edit" @click="oeffne('bearbeiten', a.id)">
                {{ t('own.edit') }}
              </button>
              <button type="button" class="btn sm" data-action="download" @click="download(a.id)">↓ {{ t('own.download') }}</button>
              <button type="button" class="btn sm danger" data-action="delete" @click="loesche(a.id)">{{ t('own.delete') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="note">{{ t('own.empty') }}</p>

      <div class="row" style="align-items: flex-end; margin-top: 14px">
        <button type="button" class="btn primary" data-action="new" @click="oeffne('neu', '')">+ {{ t('own.new') }}</button>
        <div class="field">
          <label for="own-vorlage">{{ t('own.deriveFrom') }}</label>
          <select id="own-vorlage" class="input" :value="vorlageWahl" @change="vorlageId = ($event.target as HTMLSelectElement).value">
            <option v-for="a in vorlagen" :key="a.id" :value="a.id">
              {{ a.eigen ? t('event.setupOwn', { name: a.name }) : a.name }}
            </option>
          </select>
        </div>
        <button type="button" class="btn" data-action="derive" @click="oeffne('neu', vorlageWahl)">{{ t('own.derive') }}</button>
        <!-- Eine echte Schaltfläche: Ein Feld mit `hidden` ist mit der Tastatur nicht erreichbar. -->
        <button type="button" class="btn" style="margin-left: auto" data-action="upload" @click="dateiFeld?.click()">
          ↑ {{ t('own.upload') }}
        </button>
        <input ref="dateiFeld" type="file" accept=".yaml,.yml,text/yaml,application/x-yaml" hidden @change="upload" />
      </div>

      <div v-if="meldung" :class="['boat-banner', meldung.ok ? 'ok' : 'warn']" role="status">
        {{ meldung.ok ? tn('own.uploaded', meldung.namen.length, { names: meldung.namen.join(', ') }) : t('own.uploadFailed') }}
        <ul v-if="meldung.fehler.length > 0">
          <li v-for="f in meldung.fehler" :key="f.code + f.message">{{ meldungText(f) }}</li>
        </ul>
        <template v-if="meldung.hinweise.length > 0">
          <div>{{ t('own.hints') }}</div>
          <ul>
            <li v-for="h in meldung.hinweise" :key="h.code + h.message">{{ meldungText(h) }}</li>
          </ul>
        </template>
      </div>
      <p class="note">{{ t('own.note') }}</p>
    </template>
  </div>
</template>
