<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../state/store'
import { startNrPraefixe } from '../config/catalog'
import {
  ergaenzteNummern,
  formatStartersTsv,
  formatStartlistTsv,
  parseStartersTsv,
  startNrImportNote,
  type ImportResult,
} from '../import/tsv'
import { copyText } from '../lib/clipboard'
import { verlustBeimErsetzen } from '../lib/eingabenVerlust'
import { jahrgaengeText, pruefeKlassen, startendeJahrgaenge, type KlassenFehler } from '../import/klassenPruefung'
import { useEvent } from '../lib/event'
import { locale, t, tn } from '../i18n'
import { starterfeldFest } from '../lib/eingaben'
import StarterSperre from './StarterSperre.vue'
import type { ClassId } from '../types'

/**
 * Austausch mit Excel über die Zwischenablage: Starterliste einfügen sowie
 * Starterliste und verzahnte Startliste zurückkopieren.
 */
const { state, dispatch } = useStore()
const open = ref(state.value.starters.length === 0)
const raw = ref('')
const result = ref<ImportResult | null>(null)
/** Zur Meldung nach der Übernahme: neu dazugekommen und (nur beim Ergänzen) als schon vorhanden übergangen. */
const zahlen = ref({ uebernommen: 0, uebergangen: 0 })
const copied = ref<'startlist' | 'starters' | null>(null)
/**
 * Zeilen, deren Starter in einer anderen Klasse übernommen werden als in der Liste – je Zeile
 * die neue und die gelistete Klasse. Ein neuer Text beginnt ohne (die Zeilen sind andere).
 */
const umklassen = ref<Record<number, { klasse: ClassId; gelistet: ClassId; name: string }>>({})

// Fehlende klassenbasierte Nummern ergänzt der Import; klassische vergibt erst die Verzahnung.
// Beim Ergänzen schließen sie an die Nummern der Veranstaltung an (`vorhandene`), statt sie doppelt zu vergeben.
// Beim Ersetzen behält ein wiedererkannter Starter ohne Nummer seine bisherige (`bisherige`, 16.11.2026).
const parse = (text: string, mode: 'replace' | 'merge' = 'replace') =>
  parseStartersTsv(text, {
    assignMissing: state.value.startNrMode === 'klasse',
    landIstStaat: state.value.originMode === 'land',
    startNrPraefix: startNrPraefixe(state.value),
    klasseJeZeile: Object.fromEntries(Object.entries(umklassen.value).map(([zeile, u]) => [zeile, u.klasse])),
    ...(mode === 'merge' ? { vorhandene: state.value.starters } : { bisherige: state.value.starters }),
  })

const preview = computed(() => (raw.value.trim() ? parse(raw.value) : null))

// Sobald Ergebnisse erfasst sind, ist die Starterliste fest: Listen sind gedruckt, Werte hängen
// an den Startern. Ein Import geht erst wieder, wenn die erfassten Werte entfernt sind.
const gesperrt = computed(() => starterfeldFest(state.value))

// Klasse gegen Geburtsjahr: Fehler müssen in der Quelle behoben sein, bevor etwas übernommen wird.
const { regelwerk, classLabel } = useEvent()
const pruefung = computed(() => (preview.value ? pruefeKlassen(preview.value.starters, state.value.eventJahr, regelwerk.value.klassen) : null))
const klassenFehler = computed(() => pruefung.value?.fehler ?? [])
const darfNicht = computed(() => gesperrt.value || !preview.value || preview.value.imported === 0 || klassenFehler.value.length > 0)
const jahrgaenge = computed(() => jahrgaengeText(startendeJahrgaenge(state.value.eventJahr, regelwerk.value.klassen)))
const nameVon = (f: KlassenFehler) => [f.starter.vorname, f.starter.nachname].filter(Boolean).join(' ')

/**
 * Derselbe Vorschlag wie beim Hinzufügen von Hand (Entscheidung des Nutzers vom 15.11.2026):
 * Gehört der Jahrgang in eine andere Klasse, lässt sich der Starter dort übernehmen – je Zeile
 * ein Knopf, nie für alle auf einmal: Ist nur das Jahr der Veranstaltung falsch eingestellt,
 * passte sonst jeder Starter „in eine andere Klasse“. Die Liste in Excel bleibt, wie sie ist.
 */
function inKlasse(f: KlassenFehler, klasse: ClassId) {
  const i = preview.value?.starters.indexOf(f.starter) ?? -1
  const zeile = preview.value?.zeilen[i]
  if (zeile === undefined) return
  umklassen.value = { ...umklassen.value, [zeile]: { klasse, gelistet: f.starter.klasse, name: nameVon(f) } }
}
function zurueck(zeile: string) {
  const rest = { ...umklassen.value }
  delete rest[Number(zeile)]
  umklassen.value = rest
}

function numbersNote(res: ImportResult): string {
  const note = startNrImportNote(res)
  if (note === 'none') return ''
  const teile = note === 'kept' ? [] : [t(`import.numbers.${note}`, { n: ergaenzteNummern(res) })]
  // Beim Ersetzen: Starter ohne Nummer, die ihre bisherige behielten.
  if (res.nummerBehalten > 0) teile.push(tn('import.numbers.kept', res.nummerBehalten))
  // Nummern, die nur wegfielen, weil die Zeile in einer anderen Klasse übernommen wird.
  const weg = res.nummerEntfallen
  if (weg.anzahl > 0) teile.push(tn('import.numbers.moved', weg.anzahl, { values: weg.werte.join(', ') }))
  return teile.join(', ')
}
/** Nicht erkannte Angaben zum Geschlecht: Die Zeilen kommen herein, das Feld bleibt leer. */
function geschlechtNote(res: ImportResult): string {
  const u = res.geschlechtUnbekannt
  return u.anzahl === 0 ? '' : tn('import.sexUnknown', u.anzahl, { values: u.werte.join(', ') })
}
/** Nicht lesbare Geburtsdaten (31.02.2019, Monat/Tag): Die Zeilen kommen herein, das Feld bleibt leer. */
function datumNote(res: ImportResult): string {
  const u = res.datumUnlesbar
  return u.anzahl === 0 ? '' : tn('import.dateUnreadable', u.anzahl, { values: u.werte.join(', ') })
}

function doImport(mode: 'replace' | 'merge') {
  if (darfNicht.value) return
  const res = parse(raw.value, mode)
  if (res.imported === 0) {
    result.value = res
    return
  }
  // Ersetzen nimmt den nicht wiedererkannten Startern ihre erfassten Werte – dann erst fragen.
  const verlust = mode === 'replace' ? verlustBeimErsetzen(state.value, res.starters, res.nummerVomImport) : undefined
  if (verlust && verlust.zahl > 0 && !confirm(t('entries.replaceConfirm') + verlust.text)) return
  const vorher = state.value.starters.length
  dispatch({ type: 'IMPORT_STARTERS', starters: res.starters, mode, nummerVomImport: res.nummerVomImport })
  // Die Meldung zählt, was wirklich dazukam (16.11.2026): Beim Ergänzen übergeht der Reducer Starter,
  // die schon in ihrer Klasse stehen – die nennt sie eigens.
  const dazu = mode === 'merge' ? state.value.starters.length - vorher : res.imported
  zahlen.value = { uebernommen: dazu, uebergangen: res.imported - dazu }
  result.value = res
  raw.value = ''
  umklassen.value = {}
}

async function copy(which: 'startlist' | 'starters') {
  const text = which === 'startlist' ? formatStartlistTsv(state.value) : formatStartersTsv(state.value, locale.value)
  if (await copyText(text)) {
    copied.value = which
    setTimeout(() => (copied.value = null), 1500)
  }
}

function onRaw(e: Event) {
  raw.value = (e.target as HTMLTextAreaElement).value
  result.value = null
  umklassen.value = {}
}
</script>

<template>
  <div class="panel">
    <div class="export-head">
      <button class="btn ghost sm" :aria-expanded="open" @click="open = !open">
        {{ open ? '▾' : '▸' }} {{ t('import.toggle') }}
      </button>
      <span style="flex: 1" />
      <button class="btn sm" :title="t('import.copyStartersTitle')" @click="copy('starters')">
        {{ copied === 'starters' ? t('common.copied') : t('import.copyStarters') }}
      </button>
      <button class="btn sm" :title="t('import.copyStartlistTitle')" @click="copy('startlist')">
        {{ copied === 'startlist' ? t('common.copied') : t('import.copyStartlist') }}
      </button>
    </div>

    <div v-if="open" style="margin-top: 12px">
      <StarterSperre data-hinweis="import-gesperrt" />
      <p class="hint">{{ t('import.hint') }}</p>
      <label class="subhead" for="import-raw" style="display: block; margin-bottom: 6px">
        {{ t('import.label') }}
      </label>
      <textarea
        id="import-raw"
        class="export-text"
        :value="raw"
        rows="8"
        :placeholder="t('import.placeholder')"
        @input="onRaw"
      />
      <p class="note" style="margin-top: 6px">{{ t('import.columns') }}</p>

      <p v-if="preview" class="note">
        {{ t('import.preview', { n: preview.imported }) }} ·
        {{ preview.usedHeader ? t('import.header') : t('import.fixed') }}
        <template v-if="preview.skipped.length > 0"> · {{ tn('import.skipped', preview.skipped.length) }}</template>
        <template v-if="numbersNote(preview)"><br />{{ numbersNote(preview) }}</template>
        <template v-if="geschlechtNote(preview)"><br /><span data-hinweis="geschlecht-unbekannt">{{ geschlechtNote(preview) }}</span></template>
        <template v-if="datumNote(preview)"><br /><span data-hinweis="datum-unlesbar">{{ datumNote(preview) }}</span></template>
      </p>

      <div v-if="Object.keys(umklassen).length > 0" class="note" data-hinweis="umgeklasst" role="status">
        {{ tn('import.moved', Object.keys(umklassen).length) }}
        <ul style="margin: 4px 0 0; padding-left: 18px">
          <li v-for="(u, zeile) in umklassen" :key="zeile">
            {{ t('import.movedItem', { name: u.name, listed: classLabel(u.gelistet), class: classLabel(u.klasse) }) }}
            <button type="button" class="btn ghost sm" data-action="umklassen-zurueck" :title="t('import.movedUndoTitle', { name: u.name, listed: classLabel(u.gelistet) })" @click="zurueck(String(zeile))">
              {{ t('import.movedUndo') }}
            </button>
          </li>
        </ul>
      </div>

      <div v-if="klassenFehler.length > 0" class="boat-banner warn" data-hinweis="klassen-fehler" role="alert">
        {{ tn('import.classErrors', klassenFehler.length) }}
        <ul style="margin: 6px 0 0; padding-left: 18px">
          <li v-for="f in klassenFehler" :key="f.starter.id">
            {{
              t(f.passend.length > 0 ? 'import.classError' : 'import.classErrorNone', {
                name: nameVon(f),
                class: classLabel(f.starter.klasse),
                year: f.jahr,
                from: f.erlaubt[0],
                to: f.erlaubt[1],
                fits: f.passend.map((k) => classLabel(k)).join(', '),
                years: jahrgaenge,
              })
            }}
            <button
              v-for="k in f.passend"
              :key="k"
              type="button"
              class="btn sm"
              data-action="in-klasse-uebernehmen"
              :data-klasse="k"
              :disabled="gesperrt"
              :title="t('import.takeInClassTitle', { name: nameVon(f), class: classLabel(k), listed: classLabel(f.starter.klasse) })"
              @click="inKlasse(f, k)"
            >
              {{ t('import.takeInClass', { class: classLabel(k) }) }}
            </button>
          </li>
        </ul>
        <p style="margin: 6px 0 0">{{ t('import.classErrorsFix', { year: state.eventJahr }) }}</p>
      </div>
      <p v-else-if="pruefung && pruefung.ohneDatum > 0" class="note" data-hinweis="ohne-datum">{{ tn('import.noBirthdate', pruefung.ohneDatum) }}</p>

      <div class="row" style="gap: 8px; margin-top: 4px">
        <button
          class="btn primary"
          :disabled="darfNicht"
          :title="t('import.replaceTitle')"
          @click="doImport('replace')"
        >
          {{ t('import.replace') }}
        </button>
        <button
          class="btn"
          :disabled="darfNicht"
          :title="t('import.mergeTitle')"
          @click="doImport('merge')"
        >
          {{ t('import.merge') }}
        </button>
      </div>

      <div
        v-if="result"
        :class="['boat-banner', result.imported > 0 ? 'ok' : 'warn']"
        style="margin-top: 12px"
        role="status"
      >
        <template v-if="result.imported > 0">
          {{ t('import.done', { n: zahlen.uebernommen }) }} {{ numbersNote(result) }}
          <template v-if="zahlen.uebergangen > 0"><br /><span data-hinweis="uebergangen">{{ tn('import.duplicates', zahlen.uebergangen) }}</span></template>
          <!-- Je Hinweis eine Zeile wie in der Vorschau. Die ist nach der Übernahme weg (Textfeld leer) –
               ohne den Datumshinweis hier stünde nirgends mehr, welche Daten leer blieben. -->
          <template v-if="geschlechtNote(result)"><br /><span data-hinweis="geschlecht-unbekannt">{{ geschlechtNote(result) }}</span></template>
          <template v-if="datumNote(result)"><br /><span data-hinweis="datum-unlesbar">{{ datumNote(result) }}</span></template>
        </template>
        <template v-else>{{ t('import.none') }}</template>
        <template v-if="result.skipped.length > 0">
          {{ ' ' }}{{ tn('import.skipped', result.skipped.length) }}:
          <ul style="margin: 6px 0 0; padding-left: 18px">
            <li v-for="s in result.skipped.slice(0, 6)" :key="s.line">
              {{ t('import.line', { line: s.line, reason: t(`import.skip.${s.reason}`, { value: s.value }) }) }}
            </li>
            <li v-if="result.skipped.length > 6">{{ t('import.more', { n: result.skipped.length - 6 }) }}</li>
          </ul>
        </template>
      </div>
    </div>
  </div>
</template>
