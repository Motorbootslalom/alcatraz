<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useStore } from '../state/store'
import { useEvent } from '../lib/event'
import { classColor } from '../domain/classes'
import { bereichsGrenzen, GROESSEN_GRUPPEN, liesFehlende, type GroessenGruppe, type StartNrBereich } from '../domain/startnrBereiche'
import { startNrBereicheOf, startNrPraefixe } from '../config/catalog'
import { t } from '../i18n'
import type { ClassId } from '../types'

/**
 * Einstellungen → Startnummern nach Westengröße (Wunsch des Nutzers vom 19.11.2026): je Klasse
 * die Nummernbereiche der Größengruppen (Vorgabe aus dem Regelwerk, änderbar) und die Nummern
 * der fehlenden Westen. Vergeben wird im Reiter „Starter“; hier stehen nur die Regeln.
 */
const { state, dispatch } = useStore()
const { regelwerk, classLabel } = useEvent()
const id = useId()

const zeilen = computed(() =>
  regelwerk.value.klassen.map((k) => ({
    klasse: k,
    color: classColor(k),
    eigen: state.value.startNrBereiche[k] !== undefined,
    bereiche: startNrBereicheOf(state.value, k),
  })),
)

/** „S-M“ wird als „S–M“ gezeigt; im Stand und im YAML steht der einfache Bindestrich. */
const gruppeText = (g: GroessenGruppe) => g.replace('-', '–')

function setze(klasse: ClassId, bereiche: StartNrBereich[] | null) {
  dispatch({ type: 'SET_START_NR_BEREICHE', klasse, bereiche })
}

function aendere(klasse: ClassId, liste: readonly StartNrBereich[], i: number, patch: Partial<StartNrBereich>) {
  setze(klasse, liste.map((b, j) => (j === i ? { ...b, ...patch } : b)))
}

/** Ein neuer Bereich schließt an den letzten an (gleiche Länge, nächste Gruppe), sonst beginnt er bei der ersten Nummer der Klasse. */
function neu(klasse: ClassId, liste: readonly StartNrBereich[]) {
  const letzter = liste[liste.length - 1]
  const praefixe = startNrPraefixe(state.value)
  const g = letzter ? bereichsGrenzen(letzter, klasse, praefixe) : null
  const prefix = praefixe[klasse] ?? klasse
  const nr = (n: number) => prefix + String(n).padStart(2, '0')
  const gruppe = letzter ? (GROESSEN_GRUPPEN[Math.min(GROESSEN_GRUPPEN.indexOf(letzter.gruppe) + 1, GROESSEN_GRUPPEN.length - 1)] as GroessenGruppe) : 'S-M'
  const naechster: StartNrBereich = g ? { von: nr(g.bis + 1), bis: nr(g.bis + 1 + (g.bis - g.von)), gruppe } : { von: nr(1), bis: nr(30), gruppe }
  setze(klasse, [...liste, naechster])
}

const unlesbar = (klasse: ClassId, b: StartNrBereich) => bereichsGrenzen(b, klasse, startNrPraefixe(state.value)) === null

// Fehlende Nummern: Das Feld zeigt den Stand, bis jemand tippt; erst beim Verlassen geht es hinaus.
const fehlendText = ref(state.value.fehlendeStartNr.join(', '))
watch(
  () => state.value.fehlendeStartNr,
  (n) => (fehlendText.value = n.join(', ')),
)
const unbekannt = ref<string[]>([])
function fehlendUebernehmen() {
  const { nummern, unbekannt: rest } = liesFehlende(fehlendText.value, regelwerk.value.klassen, startNrPraefixe(state.value))
  unbekannt.value = rest
  dispatch({ type: 'SET_FEHLENDE_START_NR', nummern })
  fehlendText.value = nummern.join(', ')
}
</script>

<template>
  <div id="startnummern" class="panel">
    <h2>{{ t('listopt.startnr.title') }}</h2>
    <p class="hint">{{ t('listopt.startnr.hint') }}</p>
    <table class="startnr-bereiche" data-teil="startnr-bereiche">
      <tbody>
        <tr v-for="z in zeilen" :key="z.klasse" :data-klasse="z.klasse">
          <th scope="row">
            <span class="dot" :style="{ background: z.color }" />
            {{ classLabel(z.klasse) }}
          </th>
          <td>
            <span v-if="z.bereiche.length === 0" class="note">{{ t('listopt.startnr.keine') }}</span>
            <div v-for="(b, i) in z.bereiche" :key="i" class="startnr-bereich" :data-bereich="i">
              <input
                class="input"
                :class="{ own: z.eigen, invalid: unlesbar(z.klasse, b) }"
                data-feld="von"
                :value="b.von"
                :aria-label="`${t('listopt.startnr.von')} – ${classLabel(z.klasse)}`"
                @change="aendere(z.klasse, z.bereiche, i, { von: ($event.target as HTMLInputElement).value })"
              />
              <span>–</span>
              <input
                class="input"
                :class="{ own: z.eigen, invalid: unlesbar(z.klasse, b) }"
                data-feld="bis"
                :value="b.bis"
                :aria-label="`${t('listopt.startnr.bis')} – ${classLabel(z.klasse)}`"
                @change="aendere(z.klasse, z.bereiche, i, { bis: ($event.target as HTMLInputElement).value })"
              />
              <select
                class="input"
                data-feld="gruppe"
                :value="b.gruppe"
                :aria-label="`${t('listopt.startnr.gruppe')} – ${classLabel(z.klasse)}`"
                @change="aendere(z.klasse, z.bereiche, i, { gruppe: ($event.target as HTMLSelectElement).value as GroessenGruppe })"
              >
                <option v-for="g in GROESSEN_GRUPPEN" :key="g" :value="g">{{ gruppeText(g) }}</option>
              </select>
              <button type="button" class="btn sm" data-action="bereich-entfernen" :aria-label="t('listopt.startnr.entfernen')" :title="t('listopt.startnr.entfernen')" @click="setze(z.klasse, z.bereiche.filter((_, j) => j !== i))">✕</button>
              <span v-if="unlesbar(z.klasse, b)" class="note" data-teil="unlesbar">{{ t('listopt.startnr.unlesbar') }}</span>
            </div>
          </td>
          <td class="startnr-knoepfe">
            <button type="button" class="btn sm" data-action="bereich-neu" @click="neu(z.klasse, z.bereiche)">{{ t('listopt.startnr.neu') }}</button>
            <button v-if="z.eigen" type="button" class="btn sm" data-action="bereich-vorgabe" @click="setze(z.klasse, null)">
              {{ t('listopt.startnr.vorgabe', { rulebook: regelwerk.label }) }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="field">
      <label :for="`${id}-fehlend`">{{ t('listopt.startnr.fehlend') }}</label>
      <input :id="`${id}-fehlend`" v-model="fehlendText" class="input" data-feld="fehlende-startnr" placeholder="512, 517, 623" @change="fehlendUebernehmen" />
      <p class="note">{{ t('listopt.startnr.fehlend.hint') }}</p>
      <p v-if="unbekannt.length > 0" class="note startnr-warn" data-teil="fehlend-unbekannt">{{ t('listopt.startnr.fehlend.unbekannt', { werte: unbekannt.join(', ') }) }}</p>
    </div>
  </div>
</template>
