<script setup lang="ts">
import { computed, onMounted, ref, toRaw, watch } from 'vue'
import { useStore } from '../state/store'
import { useEvent } from '../lib/event'
import { standAus } from '../persistenz/storage'
import { VERLAUF_GRENZEN, type Beschreibung, type VerlaufEintrag } from '../lib/verlauf'
import { vergissAuswahl } from '../lib/merken'
import { rundeVon } from '../lib/parallelSchluessel'
import { rundenName } from '../planung/parallelRunden'
import { formatDateTime, t, tn, type MessageKey } from '../i18n'
import type { ClassId } from '../types'
import { useKonfig } from '../lib/konfig'
import { liesListe } from '../wkr/liste'

/**
 * Verlauf: die letzten Stände aus dem zweiten Speicher (state/zweit.ts) – ansehen, einen
 * wiederherstellen, den jetzigen unter einem Namen merken. Steht bei den Dateien, weil es
 * dieselbe Frage beantwortet: Wie komme ich an einen früheren Stand? Gibt es den zweiten
 * Speicher nicht, steht hier nur das – die Anwendung läuft ohne ihn weiter.
 */
const { state, dispatch, zweit } = useStore()
const { classLabel } = useEvent()
const konfig = useKonfig({ oberflaeche: true })

const eintraege = ref<VerlaufEintrag[]>([])
const alle = ref(false)
const name = ref('')
const meldung = ref<{ ok: boolean; text: string } | null>(null)
/** So viele zeigt die Liste zuerst – der Rest auf Knopfdruck, damit die Einstellungen kurz bleiben. */
const ZUERST = 8

let liest = false
let nochmal = false
async function lies() {
  if (liest) {
    nochmal = true
    return
  }
  liest = true
  try {
    eintraege.value = await zweit.eintraege()
  } finally {
    liest = false
    if (nochmal) {
      nochmal = false
      void lies()
    }
  }
}
onMounted(lies)
watch([zweit.version, zweit.lage], lies)

const gezeigt = computed(() => (alle.value ? eintraege.value : eintraege.value.slice(0, ZUERST)))
/**
 * Der jetzige Stand: der jüngste Eintrag mit der jetzigen Folge-Nummer. Nur einer – ein gemerkter
 * Stand und der Eintrag, aus dem er stammt, tragen dieselbe Nummer.
 */
const jetzt = computed(() => eintraege.value.find((e) => e.folge === zweit.folge.value)?.id)
const tage = Math.round(VERLAUF_GRENZEN.alter / (24 * 3_600_000))

/** Eine Liste der WKR-Erfassung (Kennung, wkr/liste.ts) als Text: Position und Parcours bzw. Racecourse. */
function listenText(kennung: string | undefined): string {
  const liste = liesListe(kennung)
  if (!liste) return ''
  let titel = liste.typeId
  try {
    titel = konfig.value.getSheetDef(liste.typeId).title
  } catch {
    // Eine Liste, die es im jetzigen Aufbau nicht gibt, heißt nach ihrer Kennung.
  }
  const ort = liste.racecourse ?? state.value.parcoursList.find((p) => p.id === liste.bereich)?.name ?? ''
  return [titel, ort].filter(Boolean).join(' · ')
}

/** Was sich geändert hat – aus Art und Angaben, in der Sprache der Oberfläche. */
function was(b: Beschreibung): string {
  if (b.art === 'eingabeGeraet') return t(`history.what.${b.art}`, { device: b.geraet ?? '', list: listenText(b.liste) })
  if (b.art === 'wkrListe' || b.art === 'wkrAbschluss' || b.art === 'wkrPapierAb') return t(`history.what.${b.art}`, { list: listenText(b.liste) })
  if (b.art === 'eingabe') {
    // Im Parallelslalom ist der „Lauf“ der Attempt einer Runde (lib/verlauf.ts `runde`).
    const runde = rundeVon(`parallel:${b.runde ?? ''}`)
    const lauf = !b.lauf ? '' : !runde ? t('lists.wkr.runN', { n: b.lauf }) : b.lauf === 1 || b.lauf === 2 ? t(`parallel.attempt.${b.lauf}`) : `${t('parallel.attempt')} ${b.lauf}`
    const teile = [b.klasse ? classLabel(b.klasse as ClassId) : '', runde ? `${t('parallel.title')} ${rundenName(runde, t)}` : '', lauf].filter(Boolean)
    return [t('history.what.eingabe'), teile.join(', ')].filter(Boolean).join(' ')
  }
  if (b.art === 'rundeFest' || b.art === 'rundeGeloest') {
    const runde = rundeVon(`parallel:${b.runde ?? ''}`)
    return t(`history.what.${b.art}`, { round: runde ? rundenName(runde, t) : '', class: b.klasse ? classLabel(b.klasse as ClassId) : '' })
  }
  if (b.art === 'druckGeloest') {
    const runde = rundeVon(`parallel:${b.runde ?? ''}`)
    return t('history.what.druckGeloest', { round: runde ? rundenName(runde, t) : '' })
  }
  if (b.art === 'klasseGewechselt') return t('history.what.klasseGewechselt', { class: b.klasse ? classLabel(b.klasse as ClassId) : '' })
  if (b.art === 'reihenfolge') return b.klasse ? t('history.what.reihenfolge', { class: classLabel(b.klasse as ClassId) }) : t('history.what.reihenfolgeAlle')
  if (b.art === 'verlauf') {
    const time = formatDateTime(b.zeit ?? 0, true)
    return b.name ? t('history.what.verlaufName', { name: b.name, time }) : t('history.what.verlauf', { time })
  }
  if (b.art === 'abbruch') return t('history.what.abbruch', { time: formatDateTime(b.zeit ?? 0, true) })
  if (b.n !== undefined) return tn(`history.what.${b.art}` as MessageKey, b.n)
  return t(`history.what.${b.art}` as MessageKey)
}

async function merke() {
  const text = name.value.trim()
  if (!text) return
  const ok = await zweit.merke(text)
  meldung.value = ok ? { ok: true, text: t('history.keep.done', { name: text }) } : { ok: false, text: t('history.keep.failed') }
  if (ok) name.value = ''
}

/** Über denselben Weg wie eine Sicherung: prüfen und ergänzen (`migrate`), dann als Ganzes laden. */
async function stelleWiederHer(e: VerlaufEintrag) {
  const time = formatDateTime(e.zeit, true)
  if (!confirm(t('history.confirm', { time, what: e.name ? `„${e.name}“` : was(e.was) }))) return
  const stand = standAus(await zweit.stand(e.id))
  if (!stand) {
    meldung.value = { ok: false, text: t('history.gone') }
    return
  }
  // Der Betrieb am Wettkampftag bleibt, wie er jetzt ist: Wer eine Erfassung zurücknimmt, soll die
  // Anzeigetafel nicht auf einen früheren Starter zurückspringen lassen. Der Reducer kann das nicht
  // unterscheiden (LOAD_STATE übernimmt den Stand) – deshalb hier (Plan vom 16.11.2026). Nur in derselben
  // Veranstaltung (gleiche Kennung): Ein Eintrag von vor dem Laden einer anderen Sicherung bringt seinen
  // eigenen Betrieb mit – sonst gälten deren Läufe als begonnen, und ihre Meldung stünde auf der Tafel
  // (BETRIEB_ANNAHMEN.speicherorte, Prüfung E1 vom 16.11.2026).
  const jetzt = toRaw(state.value)
  const betrieb = stand.kennung === jetzt.kennung ? jetzt.betrieb : stand.betrieb
  dispatch({ type: 'LOAD_STATE', state: { ...stand, betrieb } }, { art: 'verlauf', zeit: e.zeit, ...(e.name ? { name: e.name } : {}) })
  // Ein anderer Stand, vielleicht eine andere Veranstaltung: Die gemerkte Auswahl gilt nicht mehr.
  vergissAuswahl()
  meldung.value = { ok: true, text: t('history.done', { time }) }
}

async function loesche(e: VerlaufEintrag) {
  if (!confirm(t('history.deleteConfirm', { name: e.name ?? '' }))) return
  await zweit.loesche(e.id)
}
</script>

<template>
  <div id="verlauf" class="verlauf" :data-lage="zweit.lage.value">
    <h3 class="subhead">{{ t('history.title') }}</h3>
    <p v-if="zweit.lage.value !== 'bereit'" :class="zweit.lage.value === 'pruefen' ? 'note' : 'boat-banner warn'" role="status" data-hinweis="zweiter-speicher">
      {{ t(`history.state.${zweit.lage.value}`) }}
    </p>
    <template v-if="zweit.lage.value === 'bereit' || zweit.lage.value === 'gestoert'">
      <p class="hint">{{ t('history.intro') }}</p>
      <form class="row verlauf-merken" @submit.prevent="merke">
        <div class="field" style="flex: 1; min-width: 200px; max-width: 360px">
          <label for="verlauf-name">{{ t('history.keep.label') }}</label>
          <input id="verlauf-name" v-model="name" class="input" maxlength="60" :placeholder="t('history.keep.placeholder')" data-feld="verlauf-name" />
        </div>
        <button type="submit" class="btn" :disabled="!name.trim()" data-action="verlauf-merken">{{ t('history.keep.button') }}</button>
      </form>
      <p v-if="meldung" :class="['boat-banner', meldung.ok ? 'ok' : 'warn']" role="status" data-hinweis="verlauf-meldung">{{ meldung.text }}</p>

      <p v-if="eintraege.length === 0" class="note">{{ t('history.empty') }}</p>
      <ul v-else class="verlauf-liste">
        <li v-for="e in gezeigt" :key="e.id" :class="{ gemerkt: e.name !== undefined }" :data-art="e.was.art" :data-eintrag="e.id">
          <span class="verlauf-zeit">{{ formatDateTime(e.zeit, true) }}</span>
          <span class="verlauf-was">
            <strong v-if="e.name !== undefined">{{ e.name }}</strong>
            <template v-else>{{ was(e.was) }}</template>
            <span v-if="e.name !== undefined" class="verlauf-marke">{{ t('history.kept') }}</span>
            <span v-if="e.anzahl > 1" class="note">{{ tn('history.changes', e.anzahl) }}</span>
            <span v-if="e.id === jetzt" class="verlauf-marke jetzt" data-marke="jetzt">{{ t('history.current') }}</span>
          </span>
          <span class="verlauf-groesse note">{{ t('history.size', { kb: Math.max(1, Math.round(e.groesse / 1000)) }) }}</span>
          <span class="verlauf-knoepfe">
            <button type="button" class="btn sm" :disabled="e.folge === zweit.folge.value" data-action="verlauf-wiederherstellen" @click="stelleWiederHer(e)">
              {{ t('history.restore') }}
            </button>
            <button v-if="e.name !== undefined" type="button" class="btn sm danger" data-action="verlauf-loeschen" @click="loesche(e)">{{ t('history.delete') }}</button>
          </span>
        </li>
      </ul>
      <button v-if="!alle && eintraege.length > ZUERST" type="button" class="btn sm" data-action="verlauf-mehr" @click="alle = true">
        {{ t('history.more', { n: eintraege.length - ZUERST }) }}
      </button>
      <p class="note">{{ t('history.keep.note', { n: VERLAUF_GRENZEN.anzahl, days: tage }) }} {{ t('history.privacy') }}</p>
    </template>
  </div>
</template>
