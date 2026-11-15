<script setup lang="ts">
import { computed, useId, watchEffect } from 'vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { useEvent } from '../lib/event'
import { klassenErgebnis, streichlaeufeVon, type AbstandArt, type KlassenErgebnis } from '../lib/ergebnis'
import { ERGEBNIS_ORDNUNG as ORDNUNG, ERGEBNIS_UMFANG as UMFANG, ergebnisBlaetter, type ErgebnisOrdnung as Ordnung } from '../lib/ergebnisBlaetter'
import { klassenInStartfolge } from '../lib/wkrListen'
import { t, tn } from '../i18n'
import { adresse } from '../lib/router'
import type { ClassId, ErgebnisFassung } from '../types'
import ErgebnisStapel from './ErgebnisStapel.vue'
import EingabenHinweis from './EingabenHinweis.vue'
import RegelLaeufeHinweis from './RegelLaeufeHinweis.vue'

/**
 * Die Ergebnislisten unter „Listen“: je Klasse jeder Lauf und die Gesamtliste, gerechnet aus
 * den erfassten Werten (lib/ergebnis.ts). Die Bildschirmansicht ist die Druckansicht;
 * gedruckt wird, was die Auswahl zeigt. Vorbild: ErgebnisListen.vue im Fehlerpunkte-Prototyp.
 *
 * Gewertet wird immer je Klasse – auch bei der Clubmeisterschaft. Klassen ohne Starter oder
 * ohne Eingaben haben keine Liste.
 */
const emit = defineEmits<{
  /** Wie viele Listen die Auswahl zeigt und wie sie heißt (für Fenstertitel und Dateiname). */
  stand: [stand: { anzahl: number; auswahl: string }]
}>()

const { state } = useStore()
const konfig = useKonfig()
const { classes, classLabel, parallel, regelwerk } = useEvent()
const id = useId()
// Die Blätter selbst zeichnet ErgebnisStapel.vue (in der Sprache der Liste); hier steht die Bedienung.
// „beide“: je Liste erst die nach Startnummer (zum Prüfen gegen die Wettkampfrichter-Listen,
// die in dieser Reihenfolge abgeheftet sind), dann die nach Platz (für den Aushang) – die
// beiden Arbeitsschritte des Laufzettels in einem Druck, in der Reihenfolge, in der sie anfallen.
const istOrdnung = (x: unknown): x is Ordnung => (ORDNUNG as readonly unknown[]).includes(x)
const ABSTAND = ['', 'davor', 'erster'] as const

// Die Gesamtliste hat ihre eigene Reihenfolge (`ordnungGesamt`): Sie wird zum Prüfen gern
// doppelt gedruckt, auch wenn die Läufe nur nach Platz gebraucht werden – oder umgekehrt.
const wahl = merke<{ klasse?: ClassId; lauf?: number; umfang: (typeof UMFANG)[number]; ordnung: Ordnung; ordnungGesamt?: Ordnung; abstand: '' | AbstandArt; fassung: ErgebnisFassung }>('listen.ergebnis', {
  // Zuerst die Fassung für den Aushang: Sie ist die, die am ehesten ohne Nachdenken gedruckt wird.
  fassung: 'aushang',
  umfang: 'alles',
  ordnung: 'platz',
  ordnungGesamt: 'platz',
  abstand: '',
}, { ueberNeuladen: true })
// Eine gemerkte Auswahl aus der Zeit vor dem eigenen Feld kennt `ordnungGesamt` nicht: Dann gilt die Vorgabe.
const ordnungLauf = computed<Ordnung>(() => (istOrdnung(wahl.value.ordnung) ? wahl.value.ordnung : 'platz'))
const ordnungGesamt = computed<Ordnung>(() => (istOrdnung(wahl.value.ordnungGesamt) ? wahl.value.ordnungGesamt : 'platz'))

// Druckreihenfolge wie bei allen Listen: erst Parcours, dann die Klassen in der Reihenfolge,
// in der sie laut Verzahnung zuerst starten (lib/wkrListen.ts) – nicht E, 1, 2 …
const startfolge = computed(() => klassenInStartfolge(state.value))
const alle = computed<KlassenErgebnis[]>(() => {
  const rang = (k: ClassId) => {
    const i = startfolge.value.indexOf(k)
    return i < 0 ? startfolge.value.length : i
  }
  return [...classes.value].sort((a, b) => rang(a.id) - rang(b.id)).flatMap((c) => klassenErgebnis(state.value, konfig.value, c.id) ?? [])
})
const klassen = computed(() => alle.value.map((e) => e.klasse))
const laeufe = computed(() => [...new Set(alle.value.flatMap((e) => e.laeufe.map((l) => l.lauf)))].sort((a, b) => a - b))
// Eine Wahl, die es nicht (mehr) gibt, gilt als „alle“.
const klasse = computed(() => (wahl.value.klasse !== undefined && klassen.value.includes(wahl.value.klasse) ? wahl.value.klasse : undefined))
const lauf = computed(() => (wahl.value.umfang !== 'gesamt' && wahl.value.lauf !== undefined && laeufe.value.includes(wahl.value.lauf) ? wahl.value.lauf : undefined))

const blaetter = computed(() =>
  ergebnisBlaetter(alle.value, { klassen: klasse.value === undefined ? undefined : [klasse.value], lauf: lauf.value, umfang: wahl.value.umfang, ordnungLauf: ordnungLauf.value, ordnungGesamt: ordnungGesamt.value }),
)

// Zwei Fassungen: „Aushang“ (öffentlich) und „Intern“. Was jede zeigt, steht in den
// Einstellungen: Namen voll, gekürzt oder gar nicht (nur Aushang); Herkunft nicht, als
// Kürzel oder ausgeschrieben.
const FASSUNGEN: ErgebnisFassung[] = ['aushang', 'intern']
const abstand = computed(() => wahl.value.abstand || undefined)
const streichlaeufe = computed(() => streichlaeufeVon(state.value.laufCount, state.value.streichlaeufe))
// Was bei gleichen Punkten entscheidet, legt das Regelwerk fest (lib/ergebnis.ts) – hier in Worten.
const stichText = computed(() => {
  const kriterien = regelwerk.value.stichentscheid
  return kriterien.length === 0 ? t('results.tie.none') : [...kriterien.map((k) => t(`results.tie.${k}`)), t('results.tie.shared')].join(' ')
})

/** Die Auswahl in Worten, für Fenstertitel und Dateiname – in der Sprache der Oberfläche. */
const auswahlText = computed(() => {
  const gezeigt = [...new Set(blaetter.value.flatMap((b) => (b.liste ? [b.liste.lauf] : [])))].sort((a, b) => a - b)
  const laufText =
    gezeigt.length === 0 ? '' : gezeigt.length === 1 ? t('lists.wkr.runN', { n: gezeigt[0] }) : t('results.runs', { runs: gezeigt.join(', ') })
  return [
    klasse.value !== undefined ? classLabel(klasse.value) : klassen.value.length > 1 ? t('results.allClasses') : klassen.value.map((k) => classLabel(k)).join(''),
    laufText,
    blaetter.value.some((b) => !b.liste) ? t('results.overall') : '',
  ]
    .filter(Boolean)
    .join(' - ')
})
watchEffect(() => emit('stand', { anzahl: blaetter.value.length, auswahl: auswahlText.value }))

function setze(feld: 'klasse' | 'lauf' | 'umfang' | 'ordnung' | 'ordnungGesamt' | 'abstand', e: Event) {
  const wert = (e.target as HTMLSelectElement).value
  wahl.value = { ...wahl.value, [feld]: feld === 'klasse' || feld === 'lauf' ? (wert === '' ? undefined : feld === 'lauf' ? Number(wert) : wert) : wert }
}
</script>

<template>
  <div class="panel no-print ergebnis-wahl">
    <p class="hint">{{ t('results.hint') }}</p>
    <div class="row">
      <div class="field">
        <label>{{ t('results.version') }}</label>
        <div class="segmented" role="group" :aria-label="t('results.version')">
          <button
            v-for="f in FASSUNGEN"
            :key="f"
            type="button"
            :data-fassung="f"
            :class="wahl.fassung === f ? 'active' : ''"
            :aria-pressed="wahl.fassung === f"
            @click="wahl.fassung = f"
          >
            {{ t(`results.version.${f}`) }}
          </button>
        </div>
      </div>
      <div class="field">
        <label :for="`${id}-klasse`">{{ t('lists.class') }}</label>
        <select :id="`${id}-klasse`" class="input" data-feld="erg-klasse" :value="klasse ?? ''" @change="setze('klasse', $event)">
          <option value="">{{ t('lists.wkr.all') }}</option>
          <option v-for="k in klassen" :key="k" :value="k">{{ classLabel(k) }}</option>
        </select>
      </div>
      <div class="field">
        <label :for="`${id}-umfang`">{{ t('results.scope') }}</label>
        <select :id="`${id}-umfang`" class="input" data-feld="erg-umfang" :value="wahl.umfang" @change="setze('umfang', $event)">
          <option v-for="u in UMFANG" :key="u" :value="u">{{ t(`results.scope.${u}`) }}</option>
        </select>
      </div>
      <div v-if="wahl.umfang !== 'gesamt'" class="field">
        <label :for="`${id}-lauf`">{{ t('lists.wkr.run') }}</label>
        <select :id="`${id}-lauf`" class="input" data-feld="erg-lauf" :value="lauf ?? ''" @change="setze('lauf', $event)">
          <option value="">{{ t('lists.wkr.all') }}</option>
          <option v-for="l in laeufe" :key="l" :value="l">{{ t('lists.wkr.runN', { n: l }) }}</option>
        </select>
      </div>
      <div v-if="wahl.umfang !== 'gesamt'" class="field">
        <label :for="`${id}-ordnung`">{{ t('results.order') }}</label>
        <select :id="`${id}-ordnung`" class="input" data-feld="erg-ordnung" :value="ordnungLauf" @change="setze('ordnung', $event)">
          <option v-for="o in ORDNUNG" :key="o" :value="o">{{ t(`results.order.${o}`) }}</option>
        </select>
      </div>
      <!-- Nur wenn eine Gesamtliste gedruckt wird: nicht bei „nur Läufe“ und nicht bei einem einzelnen Lauf. -->
      <div v-if="wahl.umfang !== 'laeufe' && lauf === undefined" class="field">
        <label :for="`${id}-ordnung-gesamt`">{{ t('results.orderOverall') }}</label>
        <select :id="`${id}-ordnung-gesamt`" class="input" data-feld="erg-ordnung-gesamt" :value="ordnungGesamt" @change="setze('ordnungGesamt', $event)">
          <option v-for="o in ORDNUNG" :key="o" :value="o">{{ t(`results.order.${o}`) }}</option>
        </select>
      </div>
      <div class="field">
        <label :for="`${id}-abstand`">{{ t('results.gap') }}</label>
        <select :id="`${id}-abstand`" class="input" data-feld="erg-abstand" :value="wahl.abstand" @change="setze('abstand', $event)">
          <option v-for="a in ABSTAND" :key="a" :value="a">{{ t(`results.gap.${a || 'none'}`) }}</option>
        </select>
      </div>
      <p class="note ergebnis-zahl" role="status">{{ tn('results.count', blaetter.length) }}</p>
    </div>
    <p class="note">
      {{ tn('results.rules', streichlaeufe, { runs: state.laufCount }) }} {{ t('results.rulesOpen') }}
      <a :href="adresse('einstellungen', { ziel: 'wertung' })">{{ t('nav.einstellungen') }}</a
      >.
    </p>
    <!-- Der Stichentscheid kommt aus dem Regelwerk; hier steht, was es festlegt. -->
    <p class="note" data-hinweis="stich">{{ stichText }}</p>
    <RegelLaeufeHinweis />
    <p class="note">
      {{ t(`results.versionNote.${wahl.fassung}`) }} <a :href="adresse('einstellungen', { ziel: 'ergebnislisten' })">{{ t('nav.einstellungen') }}</a
      >.
    </p>
    <p v-if="parallel" class="note">{{ t('results.parallel') }}</p>
    <EingabenHinweis />
  </div>

  <div v-if="alle.length === 0" class="panel empty no-print">
    {{ t('results.empty') }} <a :href="adresse('erfassung')">{{ t('nav.erfassung') }}</a>
  </div>
  <div v-else-if="blaetter.length === 0" class="panel empty no-print">{{ t('results.nothing') }}</div>

  <ErgebnisStapel :blaetter="blaetter" :fassung="wahl.fassung" :abstand="abstand" />
</template>
