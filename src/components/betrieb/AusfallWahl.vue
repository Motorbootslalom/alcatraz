<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { OeffentlicheSicht, SichtBereich, SichtStart } from '../../types'
import { t } from '../../i18n'
import AppDialog from '../AppDialog.vue'
import { punktVon, startZeile, type StartZeile } from './texte'

/**
 * „Wiederholung (Ausfall) …“ an der Start-Freigabe – nur am Bedienrechner (Nutzer 26.11.2026, R11-11; BETRIEB_ANNAHMEN
 * WH3): Die Wettkampfleitung hat für einen schon gezeigten Start eine Wiederholung entschieden. Die Wahl sind die
 * gezeigten, geltenden Starts der laufenden Läufe (`bereich.gefahren`, nur in der Sicht des Bedienrechners), der zuletzt
 * gezeigte zuerst – die ersten {@link ERSTE}, der Rest über die Startnummer. Rückfrage mit Startnummer, Lauf und Folgen;
 * erst „Werte verwerfen und wiederholen“ schickt `wiederholen` (BetriebView: WIEDERHOLUNG_AUSFALL, eine Action der
 * Erfassung – deshalb nicht über `sende`). Liest nur die Sicht.
 */
const props = defineProps<{
  sicht: OeffentlicheSicht
  bereich: SichtBereich
  gesperrt?: boolean
  /**
   * Starter-IDs ohne Wiederholung: abgemeldet (WH10 – das X käme beim Leeren nicht zurück). Ausgegraut mit Satz statt
   * einer Rückfrage, auf die still nichts geschähe (Prüfbefund 27.11.2026). Vom Bedienrechner; nie aus der Sicht.
   */
  nicht?: readonly string[]
}>()
const emit = defineEmits<{ wiederholen: [key: string]; fertig: [] }>()

/** So viele zeigt die Wahl ohne Suche: meist ist es der Start im Boot oder einer kurz davor. */
const ERSTE = 8

const suche = ref('')
const sucheFeld = ref<HTMLInputElement | null>(null)
onMounted(() => sucheFeld.value?.focus())

const klein = (x: string) => x.toLowerCase().replace(/\s+/g, '')
const alle = computed(() => (props.bereich.gefahren ?? []).map((s) => ({ s, z: startZeile(props.sicht, s), nicht: !!props.nicht?.includes(s.starter) })))
const zeilen = computed(() => {
  const q = klein(suche.value)
  if (!q) return alle.value.slice(0, ERSTE)
  return alle.value.filter(({ z }) => z.nummern.some((n) => klein(n).includes(q)) || klein(z.name).includes(q))
})

/** Der Start, für den die Rückfrage offen ist. */
const frage = ref<{ s: SichtStart; z: StartZeile } | null>(null)
const laufText = (s: SichtStart) => t('betrieb.lauf', { n: s.lauf })
/** Mit „Versuche nacheinander“ (ein Punkt, mehrere Läufe) bleibt die Vorsteg-Zeile – die Rückfrage sagt es (WH6). */
const vorstegBleibt = (s: SichtStart) => (punktVon(props.bereich, s.punkt)?.laeufe.length ?? 0) > 1

function ja() {
  const f = frage.value
  frage.value = null
  if (!f) return
  emit('wiederholen', f.s.key)
  suche.value = ''
  emit('fertig')
}
</script>

<template>
  <div class="betrieb-folge" data-teil="ausfall">
    <div class="row betrieb-folge-kopf">
      <input
        ref="sucheFeld"
        v-model="suche"
        class="input"
        type="search"
        data-feld="ausfall-suche"
        :placeholder="t('betrieb.ausfall.suche')"
        :aria-label="t('betrieb.ausfall.suche')"
        @keydown.esc="suche ? (suche = '') : emit('fertig')"
      />
    </div>
    <p class="note">{{ t('betrieb.ausfall.hint') }}</p>
    <p v-if="zeilen.length === 0" class="note" data-teil="ausfall-leer">{{ suche ? t('betrieb.ausfall.keine') : t('betrieb.ausfall.keiner') }}</p>
    <ol v-else class="betrieb-folge-liste">
      <li v-for="{ s, z, nicht: ohne } in zeilen" :key="z.key" :data-start="z.key">
        <span class="betrieb-start">
          <span class="class-badge sm" :style="{ background: z.farbe || 'var(--muted)' }">{{ z.klasse || '?' }}</span>
          <b>{{ z.startNr }}</b>
          <span v-if="z.name">{{ z.name }}</span>
          <span class="note">{{ z.was }}</span>
          <span v-if="ohne" class="note" data-teil="ausfall-abgemeldet">{{ t('betrieb.ausfall.abgemeldet') }}</span>
        </span>
        <span class="betrieb-zeilen-knoepfe">
          <button type="button" class="btn sm" data-action="ausfall-waehlen" :disabled="gesperrt || ohne" @click="frage = { s, z }">{{ t('betrieb.ausfall.knopf') }}</button>
        </span>
      </li>
    </ol>

    <AppDialog v-if="frage" :titel="t('betrieb.ausfall.frage', { nr: frage.z.startNr, lauf: laufText(frage.s) })" data-dialog="ausfall" @abbrechen="frage = null">
      <p>{{ t('betrieb.ausfall.text', { nr: frage.z.startNr, lauf: laufText(frage.s) }) }}</p>
      <p v-if="vorstegBleibt(frage.s)" class="note" data-teil="ausfall-vorsteg">{{ t('betrieb.ausfall.vorsteg') }}</p>
      <template #knoepfe>
        <button type="button" class="btn danger" data-action="ausfall-ja" @click="ja">{{ t('betrieb.ausfall.ja') }}</button>
        <button type="button" class="btn" data-action="ausfall-nein" autofocus @click="frage = null">{{ t('common.cancel') }}</button>
      </template>
    </AppDialog>
  </div>
</template>
