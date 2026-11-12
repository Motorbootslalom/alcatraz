<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../state/store'
import {
  formatStartersTsv,
  formatStartlistTsv,
  parseStartersTsv,
  startNrImportNote,
  type ImportResult,
} from '../import/tsv'
import { copyText } from '../lib/clipboard'
import { t, tn } from '../i18n'

/**
 * Austausch mit Excel über die Zwischenablage: Starterliste einfügen sowie
 * Starterliste und verzahnte Startliste zurückkopieren.
 */
const { state, dispatch } = useStore()
const open = ref(state.value.starters.length === 0)
const raw = ref('')
const result = ref<ImportResult | null>(null)
const copied = ref<'startlist' | 'starters' | null>(null)

// Fehlende klassenbasierte Nummern ergänzt der Import; klassische vergibt erst die Verzahnung.
const parse = (text: string) => parseStartersTsv(text, { assignMissing: state.value.startNrMode === 'klasse' })

const preview = computed(() => (raw.value.trim() ? parse(raw.value) : null))

function numbersNote(res: ImportResult): string {
  const note = startNrImportNote(res)
  return note === 'none' ? '' : t(`import.numbers.${note}`, { n: res.assignedNumbers })
}

function doImport(mode: 'replace' | 'merge') {
  const res = parse(raw.value)
  result.value = res
  if (res.imported === 0) return
  dispatch({ type: 'IMPORT_STARTERS', starters: res.starters, mode })
  raw.value = ''
}

async function copy(which: 'startlist' | 'starters') {
  const text = which === 'startlist' ? formatStartlistTsv(state.value) : formatStartersTsv(state.value)
  if (await copyText(text)) {
    copied.value = which
    setTimeout(() => (copied.value = null), 1500)
  }
}

function onRaw(e: Event) {
  raw.value = (e.target as HTMLTextAreaElement).value
  result.value = null
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
      </p>

      <div class="row" style="gap: 8px; margin-top: 4px">
        <button
          class="btn primary"
          :disabled="!preview || preview.imported === 0"
          :title="t('import.replaceTitle')"
          @click="doImport('replace')"
        >
          {{ t('import.replace') }}
        </button>
        <button
          class="btn"
          :disabled="!preview || preview.imported === 0"
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
          {{ t('import.done', { n: result.imported }) }} {{ numbersNote(result) }}
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
