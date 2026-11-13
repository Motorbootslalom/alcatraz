<script setup lang="ts">
import { computed, useId, watchEffect } from 'vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { useEvent } from '../lib/event'
import { klassenErgebnis, streichlaeufeVon, type AbstandArt, type KlassenErgebnis, type LaufListe } from '../lib/ergebnis'
import { originLabelKey, originText } from '../lib/origin'
import { t, tn } from '../i18n'
import type { ClassId, Starter, ErgebnisFassung } from '../types'
import ErgebnisGesamtBlatt from './ergebnis/ErgebnisGesamtBlatt.vue'
import ErgebnisLaufBlatt from './ergebnis/ErgebnisLaufBlatt.vue'
import EingabenHinweis from './EingabenHinweis.vue'

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
const { classes, classLabel, parallel } = useEvent()
const id = useId()

const UMFANG = ['alles', 'laeufe', 'gesamt'] as const
const ORDNUNG = ['platz', 'nummer'] as const
const ABSTAND = ['', 'davor', 'erster'] as const

const wahl = merke<{ klasse?: ClassId; lauf?: number; umfang: (typeof UMFANG)[number]; ordnung: (typeof ORDNUNG)[number]; abstand: '' | AbstandArt; fassung: ErgebnisFassung }>('listen.ergebnis', {
  // Zuerst die Fassung für den Aushang: Sie ist die, die am ehesten ohne Nachdenken gedruckt wird.
  fassung: 'aushang',
  umfang: 'alles',
  ordnung: 'platz',
  abstand: '',
})

const alle = computed<KlassenErgebnis[]>(() => classes.value.flatMap((c) => klassenErgebnis(state.value, konfig.value, c.id) ?? []))
const klassen = computed(() => alle.value.map((e) => e.klasse))
const laeufe = computed(() => [...new Set(alle.value.flatMap((e) => e.laeufe.map((l) => l.lauf)))].sort((a, b) => a - b))
// Eine Wahl, die es nicht (mehr) gibt, gilt als „alle“.
const klasse = computed(() => (wahl.value.klasse !== undefined && klassen.value.includes(wahl.value.klasse) ? wahl.value.klasse : undefined))
const lauf = computed(() => (wahl.value.umfang !== 'gesamt' && wahl.value.lauf !== undefined && laeufe.value.includes(wahl.value.lauf) ? wahl.value.lauf : undefined))

interface Blatt {
  key: string
  ergebnis: KlassenErgebnis
  /** Die Liste des Laufs; `undefined` = die Gesamtliste. */
  liste?: LaufListe
}

const blaetter = computed<Blatt[]>(() =>
  alle.value
    .filter((e) => klasse.value === undefined || e.klasse === klasse.value)
    .flatMap((e) => [
      ...(wahl.value.umfang === 'gesamt' ? [] : e.laeufe.filter((l) => lauf.value === undefined || l.lauf === lauf.value).map((l): Blatt => ({ key: `${e.klasse}/${l.lauf}`, ergebnis: e, liste: l }))),
      // Die Gesamtliste steht hinter den Läufen ihrer Klasse – nicht, wenn nur ein einzelner Lauf gewählt ist.
      ...(wahl.value.umfang === 'laeufe' || lauf.value !== undefined ? [] : [{ key: `${e.klasse}/gesamt`, ergebnis: e }]),
    ]),
)

const eventName = computed(() => [state.value.eventName, state.value.eventJahr].filter(Boolean).join(' '))
// Zwei Fassungen: „Aushang“ (öffentlich) und „Intern“. Was jede zeigt, steht in den
// Einstellungen: Namen voll, gekürzt oder gar nicht (nur Aushang); Herkunft nicht, als
// Kürzel oder ausgeschrieben.
const FASSUNGEN: ErgebnisFassung[] = ['aushang', 'intern']
const namen = computed(() => (wahl.value.fassung === 'aushang' ? state.value.ergebnisListen.aushang.namen : 'voll'))
const herkunftArt = computed(() => state.value.ergebnisListen[wahl.value.fassung].herkunft)
const herkunft = computed(() =>
  state.value.originMode === 'none' || herkunftArt.value === 'aus'
    ? undefined
    : {
        titel: t(originLabelKey(state.value.originMode)),
        text: herkunftText,
        // Ohne Kürzel steht der volle Name da: Die Spalte wird dann so breit wie der längste (in Grenzen).
        zeichen: Math.max(0, ...state.value.starters.map((p) => herkunftText(p).length)),
      },
)
const herkunftText = (p: Starter) => originText(p, state.value.originMode, herkunftArt.value === 'lang' ? 'lang' : 'kurz', state.value.originShort)
const abstand = computed(() => wahl.value.abstand || undefined)
const streichlaeufe = computed(() => streichlaeufeVon(state.value.laufCount, state.value.streichlaeufe))

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

function setze(feld: 'klasse' | 'lauf' | 'umfang' | 'ordnung' | 'abstand', e: Event) {
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
      <div class="field">
        <label :for="`${id}-ordnung`">{{ t('results.order') }}</label>
        <select :id="`${id}-ordnung`" class="input" data-feld="erg-ordnung" :value="wahl.ordnung" @change="setze('ordnung', $event)">
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
      <a href="#/einstellungen?wertung">{{ t('nav.einstellungen') }}</a
      >.
    </p>
    <p class="note">
      {{ t(`results.versionNote.${wahl.fassung}`) }} <a href="#/einstellungen?ergebnislisten">{{ t('nav.einstellungen') }}</a
      >.
    </p>
    <p v-if="parallel" class="note">{{ t('results.parallel') }}</p>
    <EingabenHinweis />
  </div>

  <div v-if="alle.length === 0" class="panel empty no-print">
    {{ t('results.empty') }} <a href="#/erfassung">{{ t('nav.erfassung') }}</a>
  </div>
  <div v-else-if="blaetter.length === 0" class="panel empty no-print">{{ t('results.nothing') }}</div>

  <div class="ergebnis-stapel">
    <template v-for="b in blaetter" :key="b.key">
      <ErgebnisGesamtBlatt
        v-if="!b.liste"
        :klasse-text="classLabel(b.ergebnis.klasse)"
        :event-name="eventName"
        :laeufe="b.ergebnis.gesamt.laeufe"
        :zeilen="wahl.ordnung === 'platz' ? b.ergebnis.gesamt.nachPlatz : b.ergebnis.gesamt.nachNummer"
        :mit-knoten="b.ergebnis.gesamt.mitKnoten"
        :abstand="abstand"
        :herkunft="herkunft"
        :namen="namen"
      />
      <ErgebnisLaufBlatt
        v-else
        :klasse-text="classLabel(b.ergebnis.klasse)"
        :lauf-text="t('lists.wkr.runN', { n: b.liste.lauf })"
        :event-name="eventName"
        :gruppen="b.liste.gruppen"
        :zeilen="wahl.ordnung === 'platz' ? b.liste.nachPlatz : b.liste.nachNummer"
        :abstand="abstand"
        :herkunft="herkunft"
        :namen="namen"
      />
    </template>
  </div>
</template>
