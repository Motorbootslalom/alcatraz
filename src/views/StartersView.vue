<script setup lang="ts">
import { computed, ref } from 'vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import { CLASSES } from '../domain/classes'
import { duplicateStartNrIds, sortedByStartNr } from '../domain/startnumbers'
import { useEvent } from '../lib/event'
import { t } from '../i18n'
import { adresse } from '../lib/router'
import { mehrfachGeschrieben, ohneFlagge } from '../domain/flaggen'
import { originLabelKey, originOf } from '../lib/origin'
import StartNumberPanel from '../components/StartNumberPanel.vue'
import ExcelPanel from '../components/ExcelPanel.vue'
import ClassSection from '../components/ClassSection.vue'
import StarterSperre from '../components/StarterSperre.vue'
import { gleicheFolge, istSortierWahl, naechsteSortierung, sortierPfeil, sortierSpalten, spaltenText, type SortierSpalte, type SortierWahl } from '../lib/reihenfolge'
import { neueSaat } from '../lib/saat'
import type { ClassId, Starter } from '../types'

const { state, dispatch } = useStore()
const { classes, parallel } = useEvent()

const byClass = computed(() => {
  const m = new Map<ClassId, Starter[]>()
  for (const c of CLASSES) m.set(c.id, [])
  for (const p of state.value.starters) m.get(p.klasse)?.push(p)
  for (const [k, list] of m) m.set(k, sortedByStartNr(list))
  return m
})

// Klassen mit Startern sind aufgeklappt, leere zu. Gemerkt (auch über das Neuladen) wird nur,
// was man von Hand anders gestellt hat – als schlichtes Objekt, das sich als JSON ablegen
// lässt. Eine gemerkte Liste der offenen Klassen hielte dagegen fest, was beim ersten Öffnen
// galt: Kommen später Starter dazu (Import, Beispiel-Starterfeld), blieben ihre Klassen zu.
// Eine gemerkte Klasse, die es nicht (mehr) gibt, zählt einfach nicht.
const geklappt = merke<Partial<Record<ClassId, boolean>>>('starter.geklappt', {}, {
  ueberNeuladen: true,
  gueltig: (w) => typeof w === 'object' && w !== null && !Array.isArray(w) && Object.values(w).every((x) => typeof x === 'boolean'),
})
const expanded = computed(() => new Set(CLASSES.map((c) => c.id).filter((id) => geklappt.value[id] ?? byClass.value.get(id)!.length > 0)))
function toggle(id: ClassId) {
  geklappt.value = { ...geklappt.value, [id]: !expanded.value.has(id) }
}
/** Ein Starter ist in einer anderen Klasse angelegt oder dorthin verschoben (Jahrgang): Sie geht auf. */
function oeffne(id: ClassId) {
  if (!expanded.value.has(id)) geklappt.value = { ...geklappt.value, [id]: true }
}

// Nach der automatischen Vergabe ordnen sich alle Klassen neu.
const sortTick = ref(0)

// Auswahl für die Pokalauswertung: nur zu sehen, wenn „nur ausgewählte Starter zählen“ an ist
// (Einstellungen → Pokalauswertung). Hier für alle Starter auf einmal, in jeder Klasse für
// die Klasse: Wer nur einzelne Starter herausnimmt, arbeitet in der Klasse; wer die ganze
// Auswahl neu beginnt („keine“ und dann die Gemeldeten ankreuzen), braucht den Knopf für alle.
// Die Auswahl ändert das Starterfeld nicht und bleibt deshalb auch nach den ersten Ergebnissen frei.
const pokalAuswahl = computed(() => state.value.pokal.nurAuswahl)
const pokalZaehlen = computed(() => state.value.starters.filter((p) => p.pokal !== false).length)
const alleIds = () => state.value.starters.map((p) => p.id)

// Herkunft Bundesland oder Land: Angaben, die sich keiner Flagge zuordnen lassen (Tippfehler,
// unbekannte Schreibweise). Sie stehen auf den Listen als Text – hier sieht man, welche es sind.
const flaggenlos = computed(() => ohneFlagge(state.value.starters.map((p) => originOf(p, state.value.originMode)), state.value.originMode))
// Dasselbe Land in mehreren Schreibweisen: gleiche Flagge, gleiches Kürzel, eine Mannschaft in
// der Pokalauswertung – gut zu wissen, bevor die Listen hängen.
const schreibweisen = computed(() => mehrfachGeschrieben(state.value.starters.map((p) => originOf(p, state.value.originMode)), state.value.originMode))

const duplicates = computed(() => duplicateStartNrIds(state.value.starters, state.value.startNrMode))

// „Sortierung ändern“ für alle Klassen zugleich (Entscheidung des Nutzers vom 15.11.2026): Jede
// Klasse wird in sich sortiert, die Reihenfolge der Klassen bleibt. Dieselben Spalten wie in den
// Tabellen der Klassen (components/ClassSection.vue), dort zeigt der Spaltenkopf die Wahl auch.
// Nur solange die Verzahnung offen ist; danach sperrt auch der Reducer (VERZAHNUNG_ACTIONS).
const verzahnungFest = computed(() => state.value.verzahnungLocked)
const sortierenAlle = ref(false)
// Wie in ClassSection.vue: Die Spalte Geschlecht steht nur da, wo sie gebraucht wird.
const mitGeschlecht = computed(() => parallel.value || state.value.starters.some((p) => p.geschlecht !== undefined))
const spaltenAlle = computed(() => sortierSpalten(state.value.originMode, mitGeschlecht.value))
const klassenMitStartern = computed(() => classes.value.map((c) => c.id).filter((k) => byClass.value.get(k)!.length > 0))
/**
 * Drei Stufen wie in jeder Klasse (lib/reihenfolge.ts naechsteSortierung, bestätigt 21.11.2026 S-01): ↑ A→Z, ↓ Z→A, Markierung weg.
 * Bedienauswahl mit der Folge jeder Klasse nach dem Sortieren – die Markierung gilt, solange jede Klasse
 * noch so steht (mit Startnummern-Bereichen sortiert der Reducer nur je Größengruppe, istGeordnet trüge nicht).
 */
const alleWahl = merke<SortierWahl | null>('starter.sortierung.alle', null, { ueberNeuladen: true, gueltig: istSortierWahl })
const alleAktiv = computed(() => {
  const w = alleWahl.value
  return w && klassenMitStartern.value.every((k) => gleicheFolge(w.folge[k], byClass.value.get(k)!)) ? w : null
})

function sortiereAlle(spalte: SortierSpalte) {
  const neu = naechsteSortierung(alleAktiv.value, spalte)
  if (!neu) {
    // Stufe 3: Markierung weg (auch in den Klassen, die sie von hier hatten), die Reihenfolge bleibt.
    alleWahl.value = null
    return
  }
  const klassen = klassenMitStartern.value
  dispatch({ type: 'ORDER_STARTERS', klassen, nach: spalte, absteigend: neu.absteigend })
  // Die Folge direkt aus dem Stand: byClass rechnet erst beim nächsten Lesen nach, liest aber denselben Stand.
  alleWahl.value = { ...neu, folge: Object.fromEntries(klassen.map((k) => [k, byClass.value.get(k)!.map((p) => p.id)])) }
  sortTick.value++
}

function mischeAlle() {
  alleWahl.value = null
  dispatch({ type: 'SHUFFLE_STARTERS', klassen: klassenMitStartern.value, saat: neueSaat() })
  sortTick.value++
}

const pfeilAlle = (spalte: SortierSpalte) => sortierPfeil(alleAktiv.value, spalte)
function titelAlle(spalte: SortierSpalte) {
  const column = t(spaltenText(spalte, state.value.originMode))
  if (alleAktiv.value?.spalte !== spalte) return t('starters.order.by', { column })
  return t(alleAktiv.value.absteigend ? 'starters.order.byDesc' : 'starters.order.byAsc', { column })
}
</script>

<template>
  <ExcelPanel />
  <StartNumberPanel @assigned="sortTick++" />
  <div class="panel">
    <h2>{{ t('starters.title') }}</h2>
    <p class="hint">{{ t('starters.hint') }}</p>
    <StarterSperre />
    <p v-if="flaggenlos.length > 0" class="note" data-hinweis="ohne-flagge" role="status">
      {{ t('starters.noFlag', { origin: t(originLabelKey(state.originMode)), list: flaggenlos.join(', ') }) }}
    </p>
    <p v-if="schreibweisen.length > 0" class="note" data-hinweis="schreibweisen" role="status">
      {{ t('starters.spellings', { origin: t(originLabelKey(state.originMode)), list: schreibweisen.map((weisen) => weisen.join(' = ')).join('; ') }) }}
    </p>
    <div v-if="pokalAuswahl" class="cup-auswahl" data-bereich="pokal-auswahl">
      <strong role="status">{{ t('cup.select.bar', { n: pokalZaehlen, total: state.starters.length }) }}</strong>
      <span class="segmented" role="group" :aria-label="t('cup.select.columnTitle')">
        <button
          type="button"
          data-action="pokal-alle"
          :class="state.starters.length > 0 && pokalZaehlen === state.starters.length ? 'active' : ''"
          :aria-pressed="state.starters.length > 0 && pokalZaehlen === state.starters.length"
          @click="dispatch({ type: 'SET_POKAL_ZAEHLT', ids: alleIds(), zaehlt: true })"
        >
          {{ t('cup.select.all') }}
        </button>
        <button
          type="button"
          data-action="pokal-keine"
          :class="state.starters.length > 0 && pokalZaehlen === 0 ? 'active' : ''"
          :aria-pressed="state.starters.length > 0 && pokalZaehlen === 0"
          @click="dispatch({ type: 'SET_POKAL_ZAEHLT', ids: alleIds(), zaehlt: false })"
        >
          {{ t('cup.select.none') }}
        </button>
      </span>
      <button type="button" class="btn sm" data-action="pokal-umkehren" :title="t('cup.select.invertTitle')" @click="dispatch({ type: 'INVERT_POKAL_ZAEHLT', ids: alleIds() })">
        ⇄ {{ t('cup.select.invert') }}
      </button>
      <span class="note">
        {{ t('cup.select.barHint') }} <a :href="adresse('einstellungen', { ziel: 'pokal' })">{{ t('nav.einstellungen') }}</a>
      </span>
    </div>
    <div v-if="state.starters.length > 1" class="sortier-leiste" data-bereich="sortierung-alle">
      <strong>{{ t('starters.order.all') }}</strong>
      <button
        type="button"
        :class="['btn', 'sm', sortierenAlle && !verzahnungFest ? 'primary' : '']"
        data-action="sortierung-alle"
        :disabled="verzahnungFest"
        :aria-pressed="sortierenAlle && !verzahnungFest"
        :title="verzahnungFest ? t('starters.order.locked') : t('starters.order.changeTitle')"
        @click="sortierenAlle = !sortierenAlle"
      >
        ↕ {{ t('starters.order.change') }}
      </button>
      <template v-if="sortierenAlle && !verzahnungFest">
        <span class="segmented" role="group" :aria-label="t('starters.order.change')">
          <button
            v-for="s in spaltenAlle"
            :key="s"
            type="button"
            :data-sortier="s"
            :class="alleAktiv?.spalte === s ? 'active' : ''"
            :aria-pressed="alleAktiv?.spalte === s"
            :title="titelAlle(s)"
            @click="sortiereAlle(s)"
          >
            {{ t(spaltenText(s, state.originMode)) }} <span :class="['sortier-pfeil', alleAktiv?.spalte === s ? 'aktiv' : '']" aria-hidden="true">{{ pfeilAlle(s) }}</span>
          </button>
        </span>
        <button type="button" class="btn sm" data-action="zufall-alle" :title="t('starters.order.randomTitle')" @click="mischeAlle">{{ t('starters.order.random') }}</button>
        <span class="note">{{ t('starters.order.allHint') }}</span>
      </template>
      <span v-if="verzahnungFest" class="note" data-hinweis="sortierung-gesperrt">
        {{ t('starters.order.locked') }} <a :href="adresse('verzahnung')">{{ t('nav.verzahnung') }}</a
        >.
      </span>
    </div>
    <ClassSection
      v-for="c in classes"
      :key="c.id"
      :class-id="c.id"
      :starters="byClass.get(c.id)!"
      :duplicates="duplicates"
      :sort-tick="sortTick"
      :open="expanded.has(c.id)"
      :pokal-auswahl="pokalAuswahl"
      :sortierung="alleWahl"
      @toggle="toggle(c.id)"
      @oeffne="oeffne"
    />
  </div>
</template>
