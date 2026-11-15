<script setup lang="ts">
import { computed, toRaw } from 'vue'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { useEvent } from '../lib/event'
import { OHNE_LAUF, verborgeneEinzelheiten, verborgeneZellen, type VerborgenerWert } from '../lib/eingaben'
import { zeitAnzeige, zeitRoh } from '../lib/ergebnisText'
import { merke } from '../lib/merken'
import { parseTime } from '../lib/time'
import { t, tn } from '../i18n'

/**
 * Warnt, wenn im Stand erfasste Werte liegen, die keine Liste mehr zeigt (lib/eingaben.ts
 * `verborgeneZellen`): nach einem Wechsel des Aufbaus oder der Klasse, oder wenn die Zahl der
 * Läufe verringert wurde. Solche Werte können weiter in die Wertung eingehen, ohne dass man
 * sie in der Erfassung sieht – deshalb steht der Hinweis überall, wo erfasst, gewertet oder
 * eingestellt wird, und bietet an, sie zu entfernen.
 *
 * Zugeklappt nennt er nur die Zahl. „Einzelheiten“ zeigt je Starter jeden Wert mit Lauf, Liste
 * und Feld, ob er in der Wertung mitzählt und warum ihn keine Liste mehr zeigt
 * (`verborgeneEinzelheiten`) – wer entfernen soll, muss sehen können, was.
 */
const { state, dispatch } = useStore()
const konfig = useKonfig({ oberflaeche: true })
const { classLabel } = useEvent()

// Gerechnet wird bei jeder Eingabe, über alle erfassten Werte. Am Stand vorbei gelesen: Er wird
// mit jeder Action als Ganzes ersetzt (`state.value` genügt als Abhängigkeit), und durch die
// reaktive Hülle kostete das bei einem großen Feld spürbar Zeit je Tastendruck.
const roh = computed(() => toRaw(state.value))
const zellen = computed(() => verborgeneZellen(roh.value, konfig.value))
const starter = computed(() => new Set(zellen.value.map((z) => z.starter)).size)

// Der Hinweis steht in mehreren Ansichten; wer ihn aufklappt und die Ansicht wechselt, um
// nachzusehen, findet ihn dort wieder offen. Gerechnet wird nur, solange er offen ist.
const offen = merke('hinweis.verborgen.offen', false)
const gruppen = computed(() => (offen.value && zellen.value.length > 0 ? verborgeneEinzelheiten(roh.value, konfig.value) : []))
/** Bis zu so vielen Startern stehen ihre Werte gleich offen da. */
const OFFEN_BIS = 6
const zaehlend = computed(() => gruppen.value.reduce((n, g) => n + g.werte.filter((w) => w.zaehlt).length, 0))

const listenName = (w: VerborgenerWert) => (w.liste === undefined ? '–' : konfig.value.getSheetDef(w.liste).title)
const laufText = (w: VerborgenerWert) => (w.lauf === OHNE_LAUF ? t('entries.hidden.noRun') : t('lists.wkr.runN', { n: w.lauf }))
// Ein Feld, das das eingestellte Regelwerk nicht kennt, hat keine Überschrift mehr – nur die
// Kennung, unter der der Wert gespeichert ist. Sie steht dabei, aber als solche bezeichnet.
const feldText = (w: VerborgenerWert) => (w.art === 'erfasst' ? t('entries.hidden.done') : (w.feld?.label ?? t('entries.hidden.unknownField', { id: w.zelle.feld })))
/** Der Wert, wie ihn die Erfassung zeigt: Zeiten als „mm:ss,00 (ss,00)“, der Haken als Haken. */
function wertText(w: VerborgenerWert): string {
  if (w.art === 'erfasst') return '✓'
  if (w.feld?.kind !== 'time') return w.zelle.wert
  const zeit = parseTime(w.zelle.wert)
  return zeit ? zeitAnzeige(zeit.centis) : zeitRoh(w.zelle.wert)
}
const grundText = (w: VerborgenerWert) => t(`entries.hidden.reason.${w.grund}`, { runs: Math.max(1, state.value.laufCount), discipline: w.disziplin })

function entfernen() {
  if (!confirm(t('entries.hidden.confirm', { n: zellen.value.length }))) return
  dispatch({ type: 'SET_EINGABEN', zellen: zellen.value.map((z) => ({ ...z, wert: '' })) })
}
</script>

<template>
  <div v-if="zellen.length > 0" class="boat-banner warn no-print verborgen" role="alert" data-hinweis="verborgene-eingaben">
    <p class="verborgen-kurz">
      {{ tn('entries.hidden', zellen.length, { n: starter, cells: zellen.length }) }}
      <button type="button" class="btn" data-action="verborgene-entfernen" @click="entfernen">{{ t('entries.hidden.remove') }}</button>
    </p>
    <button type="button" class="verborgen-schalter" data-action="verborgene-einzelheiten" :aria-expanded="offen" @click="offen = !offen">
      <span aria-hidden="true">{{ offen ? '▾' : '▸' }}</span> {{ t('entries.hidden.details') }}
    </button>
    <div v-if="offen" class="verborgen-einzeln">
      <p class="verborgen-erklaerung">{{ zaehlend === 0 ? t('entries.hidden.explainNone') : tn('entries.hidden.explain', zaehlend) }}</p>
      <!-- Bei vielen Startern (etwa nach weniger Läufen) zunächst nur die Zeile je Starter: Sie sagt, wie viel dort liegt und ob etwas mitzählt. -->
      <details v-for="g in gruppen" :key="g.starterId" class="verborgen-starter" :data-starter="g.starterId" :open="gruppen.length <= OFFEN_BIS">
        <summary>
          <template v-if="g.starter">
            <!-- Die Leerzeichen zeichnen nichts (Flex), stehen aber im Text: vorgelesen und kopiert bleiben die Angaben getrennt. -->
            <span class="verborgen-nr">{{ g.starter.startNr || '–' }}</span>{{ ' ' }}
            <span class="verborgen-name">{{ [g.starter.nachname, g.starter.vorname].filter(Boolean).join(', ') }}</span>{{ ' ' }}
            <span class="verborgen-klasse">{{ classLabel(g.starter.klasse) }}</span>
          </template>
          <span v-else class="verborgen-name">{{ t('entries.hidden.noStarter') }}</span>
          {{ ' ' }}
          <span class="verborgen-zahl">
            {{ tn('entries.hidden.values', g.werte.length) }}<template v-if="g.werte.some((w) => w.zaehlt)">
              · <span class="verborgen-marke verborgen-marke--zaehlt">{{ tn('entries.hidden.countsN', g.werte.filter((w) => w.zaehlt).length) }}</span></template
            >
          </span>
        </summary>
        <table class="verborgen-tabelle">
          <thead>
            <tr>
              <th scope="col">{{ t('lists.wkr.run') }}</th>
              <th scope="col">{{ t('lists.wkr.list') }}</th>
              <th scope="col">{{ t('entries.hidden.field') }}</th>
              <th scope="col">{{ t('entries.hidden.value') }}</th>
              <th scope="col">{{ t('entries.hidden.scoring') }}</th>
              <th scope="col">{{ t('entries.hidden.reason') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="w in g.werte" :key="`${w.zelle.lauf}|${w.zelle.feld}`" :data-feld="w.zelle.feld" :data-zaehlt="w.zaehlt ? 'ja' : 'nein'" :data-grund="w.grund">
              <td :data-titel="t('lists.wkr.run')">{{ laufText(w) }}</td>
              <td :data-titel="t('lists.wkr.list')">{{ listenName(w) }}</td>
              <td :data-titel="t('entries.hidden.field')">{{ feldText(w) }}</td>
              <td :data-titel="t('entries.hidden.value')" class="verborgen-wert">{{ wertText(w) }}</td>
              <td :data-titel="t('entries.hidden.scoring')">
                <span :class="['verborgen-marke', { 'verborgen-marke--zaehlt': w.zaehlt }]">{{ t(w.zaehlt ? 'entries.hidden.counts' : 'entries.hidden.stored') }}</span>
              </td>
              <td :data-titel="t('entries.hidden.reason')">{{ grundText(w) }}</td>
            </tr>
          </tbody>
        </table>
      </details>
    </div>
  </div>
</template>
