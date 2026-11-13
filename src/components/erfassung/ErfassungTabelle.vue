<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useStore } from '../../state/store'
import { useKonfig } from '../../lib/konfig'
import { bogenSeiten, defFuerKlasse, type BogenBlattSpalte, type BogenModellZeile } from '../../lib/bogen'
import { codeEntries, normalizeCodeCell, parseCodeEntry } from '../../lib/codes'
import { allowedSet, sanitizeBuoy, sanitizeCodeInput, sanitizeDisq } from '../../lib/disq'
import { erfasstKennung, feldVon, felderJeKennung, laufSchluessel, listenFelder, listenLauf, werteVon, type EingabeZelle, type Feld } from '../../lib/eingaben'
import { zeileErfasst, zeileHatWerte, zeilenHinweise, type Hinweis } from '../../lib/erfassung'
import { gridNavKeyDown } from '../../lib/gridnav'
import { scoreRow, summenText, formatDisqs } from '../../lib/scoring'
import type { WkrBogen } from '../../lib/wkrListen'
import { t, tn } from '../../i18n'
import type { Column, TrennerDesign } from '../../types'
import BogenLegende from '../bogen/BogenLegende.vue'
import ZeitZelle from './ZeitZelle.vue'

/**
 * Ein Wettkampfrichter-Bogen zum Abtippen: dieselben Spalten und dieselbe Zeilenreihenfolge
 * wie auf dem Papier (das Modell kommt aus lib/bogen.ts), aber als Eingabetabelle für den
 * Bildschirm – ohne A4-Maße, damit sie auch am Telefon bedienbar bleibt (die Tabelle rollt
 * quer, die Startnummer bleibt stehen). Vorbild: SheetPage.vue im Fehlerpunkte-Prototyp.
 *
 * Jede Zelle schreibt sofort in den Stand: Lauf-Schlüssel, Starter-ID und Feld-Kennung
 * benennen sie (lib/eingaben.ts). Leerzeilen gibt es hier nicht – wer nachgemeldet ist, wird
 * unter „Starter“ angelegt und hat dann seine Zeile.
 */
const props = defineProps<{ bogen: WkrBogen }>()

const { state, dispatch } = useStore()
const konfig = useKonfig()

const seite = computed(
  () => bogenSeiten(konfig.value, props.bogen.auftrag, { klassenBloecke: props.bogen.optionen.klassenBloecke, leerzeilen: 0, leerzeilenJeKlasse: {} })[0],
)
const basisDef = computed(() => konfig.value.getSheetDef(props.bogen.typeId))
const schluessel = computed(() =>
  laufSchluessel(konfig.value.getAufbau(state.value.aufbau).disziplin, listenLauf(basisDef.value, props.bogen.lauf)),
)
const listen = computed(() => konfig.value.aufbauOrder(state.value.aufbau, false))
const hatSub = (col: Column) => !!col.sub && col.sub.length > 0
const leafKey = (leaf: BogenBlattSpalte) => (leaf.subIndex === undefined ? leaf.colKey : `${leaf.colKey}#${leaf.subIndex}`)
const sep = (links?: TrennerDesign, rechts?: TrennerDesign) => (links ? ` erf-sep-${links}` : '') + (rechts ? ` erf-sepr-${rechts}` : '')
const totalCols = computed(() => 2 + (seite.value.zeigtKlasse ? 1 : 0) + seite.value.leaves.length)

interface Zeile {
  row: BogenModellZeile
  klasse: string
  werte: Readonly<Record<string, string>>
  /** Je Blatt-Spalte das Feld; `undefined` bei Σ und bei Spalten, die die Klasse nicht hat. */
  felder: (Feld | undefined)[]
  summen: string[]
  disqTitel?: string
  /** Disq-Buchstaben aus Bojen- und Fehler-Zellen: stehen blass in der leeren Disq-Zelle. */
  autoDisq: string
  erfasst: boolean
  hatWerte: boolean
  hinweise: Hinweis[]
}

const zeilen = computed<Zeile[]>(() =>
  seite.value.rows.map((row): Zeile => {
    const klasse = row.klasse ?? props.bogen.klassen[0]
    if (row.zwischen !== undefined) {
      return { row, klasse, werte: {}, felder: [], summen: [], autoDisq: '', erfasst: false, hatWerte: false, hinweise: [] }
    }
    const typeId = props.bogen.typeId
    const werte = werteVon(state.value.eingaben, schluessel.value, row.key)
    const felder = seite.value.leaves.map((leaf, li) => (row.cells[li].gilt ? feldVon(konfig.value, typeId, klasse, leaf.colKey, leaf.subIndex) : undefined))
    const listenfelder = listenFelder(konfig.value, typeId, klasse)
    const jeZelle = new Map(listenfelder.map((f) => [f.zelle, f.kennung]))
    // scoreRow fragt Zellschlüssel „<Zeile>:<Zelle>“; die Zeile ist hier leer.
    const score = scoreRow(defFuerKlasse(basisDef.value, klasse), '', (key) => werte[jeZelle.get(key.slice(1)) ?? ''] ?? '')
    return {
      row,
      klasse,
      werte,
      felder,
      summen: seite.value.leaves.map((leaf, li) => (leaf.kind === 'sum' && row.cells[li].gilt ? summenText(score, leaf.colKey) : '')),
      disqTitel: score.disqs.length ? formatDisqs(score.disqs) : undefined,
      autoDisq: [...new Set(score.disqs.filter((d) => !basisDef.value.columns.some((c) => c.kind === 'disq' && c.label === d.where)).map((d) => d.code))].join(', '),
      erfasst: zeileErfasst(listenfelder, werte, typeId),
      hatWerte: zeileHatWerte(listenfelder, werte),
      hinweise: zeilenHinweise(listenfelder, werte, felderJeKennung(konfig.value, klasse, listen.value), typeId),
    }
  }),
)

const starterZeilen = computed(() => zeilen.value.filter((z) => z.row.zwischen === undefined && konfig.value.positionAllowsClass(props.bogen.typeId, z.klasse)))
const fortschritt = computed(() => ({ erfasst: starterZeilen.value.filter((z) => z.erfasst).length, gesamt: starterZeilen.value.length }))
const offen = computed(() => starterZeilen.value.filter((z) => !z.erfasst))
const mitHinweis = computed(() => starterZeilen.value.filter((z) => z.hinweise.length > 0))
const hatZeit = computed(() => seite.value.leaves.some((l) => l.kind === 'time'))
const hatDisq = computed(() => seite.value.leaves.some((l) => l.kind === 'disq'))

// Was beim Verlassen einer Fehler-Zelle verworfen wurde – sonst verschwände ein Tippfehler unbemerkt.
const meldung = ref('')
watch(
  () => props.bogen.id,
  () => (meldung.value = ''),
)

function setze(zeile: Zeile, kennung: string, wert: string) {
  const zelle: EingabeZelle = { lauf: schluessel.value, starter: zeile.row.key, feld: kennung, wert }
  dispatch({ type: 'SET_EINGABEN', zellen: [zelle] })
}

const erlaubt = (zeile: Zeile) => allowedSet(defFuerKlasse(basisDef.value, zeile.klasse).disqTable)

function onInput(zeile: Zeile, feld: Feld, e: Event) {
  const input = e.target as HTMLInputElement
  const wert =
    feld.kind === 'buoy'
      ? sanitizeBuoy(input.value, erlaubt(zeile))
      : feld.kind === 'code'
        ? sanitizeCodeInput(input.value)
        : feld.kind === 'disq'
          ? sanitizeDisq(input.value, erlaubt(zeile))
          : feld.kind === 'points'
            ? input.value.replace(/\D/g, '')
            : input.value
  // Auch wenn sich der gespeicherte Wert nicht ändert, darf das Unerlaubte nicht stehen bleiben.
  if (input.value !== wert) input.value = wert
  setze(zeile, feld.kennung, wert)
}

function onBlur(zeile: Zeile, feld: Feld, e: Event) {
  const input = e.target as HTMLInputElement
  if (feld.kind === 'text') {
    if (input.value !== input.value.trim()) setze(zeile, feld.kennung, input.value.trim())
    return
  }
  if (feld.kind !== 'code') return
  const roh = input.value
  const codes = new Set((feld.katalog ?? []).map((c) => c.code))
  const disqs = erlaubt(zeile)
  const sauber = normalizeCodeCell(roh, codes, disqs)
  // Verworfen: Zahlen, die auf dieser Liste kein Fehlercode sind, und fremde Buchstaben.
  const verworfen = codeEntries(roh).filter((eintrag) => {
    const code = parseCodeEntry(eintrag)
    return code ? !codes.has(code.code) : ![...eintrag.toUpperCase()].every((b) => disqs.has(b))
  })
  meldung.value = verworfen.length > 0 ? t('capture.dropped', { nr: zeile.row.nr, column: feld.label, entries: verworfen.join(', ') }) : ''
  if (sauber !== roh) {
    input.value = sauber
    setze(zeile, feld.kennung, sauber)
  }
}

function hake(zeile: Zeile, e: Event) {
  setze(zeile, erfasstKennung(props.bogen.typeId), (e.target as HTMLInputElement).checked ? '1' : '')
}

/** Alle noch leeren Zeilen als abgetippt bestätigen: auf einer Tor-Liste sind das die fehlerfreien Fahrten. */
function alleBestaetigen() {
  const feld = erfasstKennung(props.bogen.typeId)
  dispatch({ type: 'SET_EINGABEN', zellen: offen.value.map((z) => ({ lauf: schluessel.value, starter: z.row.key, feld, wert: '1' })) })
}

const auffaellig = (zeile: Zeile, leaf: BogenBlattSpalte) => zeile.hinweise.some((h) => h.zelle === leafKey(leaf))
const hinweisText = (zeile: Zeile) => zeile.hinweise.map((h) => t(`capture.hint.${h.art}`)).join(' ')
const label = (zeile: Zeile, feld: Feld) => `${zeile.row.nr} – ${feld.label}`
</script>

<template>
  <section class="erf-bogen" :data-bogen="bogen.id">
    <header class="erf-kopf">
      <h3 class="erf-titel">
        <span>{{ seite.titel }}</span>
        <span>{{ seite.klassenText }}</span>
        <span v-if="seite.laufText">{{ seite.laufText }}</span>
        <span v-if="seite.parcours">{{ seite.parcours }}</span>
        <span v-if="seite.wkr" class="erf-wkr">{{ seite.texte.wkr }} {{ seite.wkr }}</span>
      </h3>
      <div class="erf-stand" role="status">
        <progress class="erf-balken" :max="Math.max(1, fortschritt.gesamt)" :value="fortschritt.erfasst" />
        <span class="erf-stand-text" :data-fertig="fortschritt.erfasst === fortschritt.gesamt ? '' : undefined">
          {{ t('capture.progress', { done: fortschritt.erfasst, total: fortschritt.gesamt }) }}
        </span>
        <span v-if="mitHinweis.length > 0" class="erf-stand-warn">{{ tn('capture.flagged', mitHinweis.length) }}</span>
      </div>
    </header>

    <div class="erf-rahmen">
      <table class="erf-tabelle">
        <thead>
          <tr>
            <th class="erf-nr" :rowspan="seite.twoRow ? 2 : 1" scope="col">{{ seite.texte.nr }}</th>
            <th v-if="seite.zeigtKlasse" :rowspan="seite.twoRow ? 2 : 1" scope="col">{{ seite.texte.klasseKurz }}</th>
            <template v-for="col in seite.columns" :key="col.key">
              <th v-if="hatSub(col)" :class="`erf-gruppe${sep(col.trenner)}`" :colspan="col.sub!.length" scope="colgroup">{{ col.label }}</th>
              <th v-else :class="`erf-k-${col.kind}${sep(col.trenner)}`" :rowspan="seite.twoRow ? 2 : 1" scope="col">{{ col.label }}</th>
            </template>
            <th class="erf-haken" :rowspan="seite.twoRow ? 2 : 1" scope="col" :title="t('capture.doneTitle')">✓</th>
          </tr>
          <tr v-if="seite.twoRow">
            <template v-for="col in seite.columns" :key="col.key">
              <template v-if="hatSub(col)">
                <th
                  v-for="(s, i) in col.sub"
                  :key="`${col.key}-${i}`"
                  :class="`erf-sub${sep(i === 0 ? col.trenner : col.subTrenner, i < col.sub!.length - 1 ? col.subTrenner : undefined)}`"
                  scope="col"
                >
                  {{ s }}
                </th>
              </template>
            </template>
          </tr>
        </thead>
        <tbody>
          <template v-for="z in zeilen" :key="z.row.key">
            <tr v-if="z.row.zwischen !== undefined" class="erf-zwischen" :data-klasse="z.row.klasse">
              <th :colspan="totalCols" scope="rowgroup">{{ z.row.zwischen }}</th>
            </tr>
            <tr
              v-else
              :class="{ 'erf-grau': z.row.shaded, 'erf-zeile--erfasst': z.erfasst, 'erf-zeile--hinweis': z.hinweise.length > 0 }"
              :data-zeile="z.row.key"
            >
              <th class="erf-nr" scope="row">
                {{ z.row.nr }}
                <span v-if="z.hinweise.length > 0" class="erf-marke" :title="hinweisText(z)" aria-hidden="true">!</span>
              </th>
              <td v-if="seite.zeigtKlasse" class="erf-klasse">{{ z.row.klasseText ?? '' }}</td>
              <template v-for="(leaf, li) in seite.leaves" :key="leafKey(leaf)">
                <td v-if="leaf.kind === 'sum'" :class="`erf-z-sum${sep(leaf.trenner, leaf.trennerR)}${z.row.cells[li].gilt ? '' : ' erf-entfaellt'}`" :title="z.disqTitel" :data-spalte="leafKey(leaf)">
                  {{ z.summen[li] }}
                </td>
                <td v-else-if="!z.felder[li]" :class="`erf-entfaellt${sep(leaf.trenner, leaf.trennerR)}`" :data-spalte="leafKey(leaf)" />
                <td v-else :class="`erf-z-${leaf.kind}${sep(leaf.trenner, leaf.trennerR)}`" :data-spalte="leafKey(leaf)">
                  <ZeitZelle
                    v-if="leaf.kind === 'time'"
                    :value="z.werte[z.felder[li]!.kennung] ?? ''"
                    :label="label(z, z.felder[li]!)"
                    :auffaellig="auffaellig(z, leaf)"
                    @change="setze(z, z.felder[li]!.kennung, $event)"
                  />
                  <input
                    v-else
                    :class="['erf-feld', `erf-feld--${leaf.kind}`, { 'erf-feld--auffaellig': auffaellig(z, leaf) }]"
                    autocomplete="off"
                    autocapitalize="characters"
                    spellcheck="false"
                    :inputmode="leaf.kind === 'points' ? 'numeric' : undefined"
                    :aria-label="label(z, z.felder[li]!)"
                    :aria-invalid="auffaellig(z, leaf) ? 'true' : undefined"
                    :placeholder="leaf.kind === 'disq' ? z.autoDisq : undefined"
                    :value="z.werte[z.felder[li]!.kennung] ?? ''"
                    @input="onInput(z, z.felder[li]!, $event)"
                    @blur="onBlur(z, z.felder[li]!, $event)"
                    @keydown="gridNavKeyDown"
                  />
                </td>
              </template>
              <td class="erf-haken">
                <!-- Mit Werten ist die Zeile ohnehin erfasst; der Haken ist für die leeren (fehlerfreien). -->
                <input
                  type="checkbox"
                  :checked="z.erfasst"
                  :disabled="z.hatWerte || !konfig.positionAllowsClass(bogen.typeId, z.klasse)"
                  :aria-label="t('capture.doneFor', { nr: z.row.nr })"
                  @change="hake(z, $event)"
                />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <p v-if="meldung" class="boat-banner warn" role="alert">{{ meldung }}</p>
    <ul v-if="mitHinweis.length > 0" class="erf-hinweise" role="status">
      <li v-for="z in mitHinweis" :key="z.row.key"><strong>{{ z.row.nr }}</strong> {{ hinweisText(z) }}</li>
    </ul>

    <div class="row erf-fuss">
      <button type="button" class="btn sm" data-action="alle-bestaetigen" :disabled="offen.length === 0" @click="alleBestaetigen">
        {{ tn('capture.confirmEmpty', offen.length) }}
      </button>
      <span class="note" style="flex: 1; min-width: 220px; margin: 0">
        {{ t('capture.keys') }}
        <template v-if="hatZeit"> {{ t('capture.timeFormat') }}</template>
        <template v-if="hatDisq"> {{ t('capture.notStarted') }}</template>
      </span>
    </div>

    <details class="sub-details erf-legende">
      <summary>{{ t('capture.legend') }}</summary>
      <BogenLegende :def="seite.def" />
    </details>
  </section>
</template>
