<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useStore } from '../state/store'
import { birthYearRange, getClass } from '../domain/classes'
import { SIZES } from '../domain/sizes'
import { flaggeAllein, herkunftAnzeige, originField, originLabelKey, originOf } from '../lib/origin'
import HerkunftText from './HerkunftText.vue'
import { useEvent } from '../lib/event'
import { verlustText } from '../lib/eingabenVerlust'
import { starterfeldFest } from '../lib/eingaben'
import { abmeldeAttempts, abmeldePlan, abmeldeZellen } from '../lib/abmeldung'
import { zerlegeAttempt } from '../lib/parallelSchluessel'
import { rundenName } from '../planung/parallelRunden'
import { useKonfig } from '../lib/konfig'
import { zerlegeLauf } from '../lib/eingaben'
import { formatDate, locale, t, tn } from '../i18n'
import ManualAddForm from './ManualAddForm.vue'
import AppDialog from './AppDialog.vue'
import type { ClassId, Starter } from '../types'
import { GESCHLECHTER, istGeschlecht } from '../domain/geschlecht'

const props = defineProps<{
  classId: ClassId
  starters: Starter[]
  /** IDs der Starter mit doppelt vergebener Startnummer (über die ganze Veranstaltung ermittelt). */
  duplicates: Set<string>
  open: boolean
  /** Zählt hoch, wenn die Liste von außen neu geordnet werden soll (automatische Vergabe). */
  sortTick: number
  /** Spalte „zählt für die Pokalauswertung“ zeigen (Einstellungen: nur ausgewählte Starter zählen). */
  pokalAuswahl?: boolean
}>()

const emit = defineEmits<{ toggle: [] }>()

const { state, dispatch } = useStore()
const { classLabel, classBadge, parallel } = useEvent()
const def = computed(() => getClass(props.classId))
const flagge = (p: Starter) => flaggeAllein(originOf(p, state.value.originMode), state.value.originMode)
const showAdd = ref(false)
const edit = ref(false)

// Ein fehlendes Geburtsdatum hält nichts auf, soll aber sofort auffallen – auch bei zugeklappter Klasse.
const ohneDatum = computed(() => props.starters.filter((p) => !p.geburtsdatum).length)

const classLine = computed(() => {
  const [from, to] = birthYearRange(props.classId, state.value.eventJahr)
  return t('starters.classLine', {
    count: tn('app.starters', props.starters.length),
    min: def.value.minAge,
    max: def.value.maxAge,
    from,
    to,
  })
})

/**
 * Angezeigte Reihenfolge. `starters` kommt nach Startnummer sortiert herein;
 * würde die Tabelle dem sofort folgen, spränge eine Zeile schon beim Tippen
 * der ersten Ziffer weg (aus 605 wird über „6“ kurz die kleinste Nummer) und
 * das Eingabefeld verlöre den Fokus. Deshalb bleibt die Reihenfolge stehen, bis
 * ausdrücklich neu sortiert wird.
 */
const order = ref<string[]>(props.starters.map((p) => p.id))

const shown = computed(() => {
  const byId = new Map(props.starters.map((p) => [p.id, p]))
  const known = order.value.filter((id) => byId.has(id)).map((id) => byId.get(id)!)
  const seen = new Set(order.value)
  // Neue Starter erscheinen unten, bis sortiert wird.
  return known.concat(props.starters.filter((p) => !seen.has(p.id)))
})

const unsorted = computed(() => shown.value.some((p, i) => p.id !== props.starters[i]?.id))

function sortNow() {
  order.value = props.starters.map((p) => p.id)
}

watch(() => props.sortTick, sortNow)

// Verschieben und „Nach Größe“ ordnen ausdrücklich um – danach gilt die neue Reihenfolge.
const resort = ref(false)
watch(
  () => props.starters,
  () => {
    if (resort.value) sortNow()
    resort.value = false
  },
)

function reorder(action: Parameters<typeof dispatch>[0]) {
  resort.value = true
  dispatch(action)
}

const hasDuplicates = computed(() => props.starters.some((p) => props.duplicates.has(p.id)))

function toggleEdit() {
  // Mit doppelten Nummern lässt sich das Bearbeiten nicht beenden.
  if (edit.value && hasDuplicates.value) return
  edit.value = !edit.value
  if (edit.value && !props.open) emit('toggle')
}

/** Ein abgewiesenes Geburtsdatum (Jahrgang passt nicht zur Klasse) – bis zur nächsten Änderung. */
const jahrFehler = ref('')

// Die Klasse steht hier nicht zur Wahl: Ein Starter gehört in die Klasse seines Jahrgangs. Der
// Reducer lehnt einen Klassenwechsel außerdem ab, sobald Verzahnung bzw. Startplan
// festgeschrieben sind (state/reducer.ts `klasseFest`).
function update(id: string, field: keyof Omit<Starter, 'id' | 'klasse'>, e: Event) {
  const feld = e.target as HTMLInputElement
  jahrFehler.value = ''
  // Ein Geburtsjahr, das nicht in die Klasse gehört, wird abgewiesen – wie beim Einfügen aus
  // Excel und beim Hinzufügen von Hand: Das Feld zeigt wieder, was galt.
  if (field === 'geburtsdatum' && feld.value) {
    const jahr = parseInt(feld.value.slice(0, 4), 10)
    const [from, to] = birthYearRange(props.classId, state.value.eventJahr)
    if (Number.isNaN(jahr) || jahr < from || jahr > to) {
      jahrFehler.value = t('starters.birthOutOfRange', { year: Number.isNaN(jahr) ? feld.value : jahr, class: classLabel(props.classId), from, to })
      feld.value = props.starters.find((p) => p.id === id)?.geburtsdatum ?? ''
      return
    }
  }
  dispatch({ type: 'UPDATE_STARTER', id, patch: { [field]: feld.value } })
}

// Geschlecht, freiwillig: Die Spalte steht nur da, wo sie gebraucht wird – unter einem Regelwerk
// mit der Liste je Team nach Regel 960, Pkt. 3.7 („Sex“), oder wenn schon jemand eines trägt.
const mitGeschlecht = computed(() => parallel.value || state.value.starters.some((p) => p.geschlecht !== undefined))
function setzeGeschlecht(id: string, e: Event) {
  const wert = (e.target as HTMLSelectElement).value
  dispatch({ type: 'UPDATE_STARTER', id, patch: { geschlecht: istGeschlecht(wert) ? wert : undefined } })
}

// Sobald Ergebnisse erfasst sind, steht das Starterfeld fest: Hinzufügen, Entfernen und
// „Klasse leeren“ gehen nicht mehr (der Reducer lehnt sie ebenfalls ab). Warum und wie sich
// das lösen lässt, steht über den Klassen (components/StarterSperre.vue).
const fest = computed(() => starterfeldFest(state.value))
watch(fest, (f) => {
  if (f) showAdd.value = false
})

/**
 * Vor dem ersten Ergebnis genügt ein Klick. Danach lässt sich ein Starter nicht mehr entfernen
 * (die gedruckten Wettkampfrichter-Listen enthalten seine Zeile) – das × sagt dann, warum, und
 * bietet an, ihn in jedem Lauf als „nicht gestartet“ einzutragen (lib/abmeldung.ts). Wer so
 * abgemeldet ist, hat statt des × den Weg zurück.
 */
const konfig = useKonfig({ oberflaeche: true })
const abgemeldet = computed(() => new Set(state.value.abgemeldet))
const frage = ref<{ starter: Starter; art: 'abmelden' | 'anmelden' } | null>(null)
const frageWer = computed(() => {
  const p = frage.value?.starter
  return p ? [p.startNr, [p.vorname, p.nachname].filter(Boolean).join(' ')].filter(Boolean).join(' · ') : ''
})
const plan = computed(() => (frage.value ? abmeldePlan(state.value, konfig.value, frage.value.starter) : null))
/** Die Läufe, aus denen das Zurücknehmen das X entfernt – die des Manövrierens; die Runden des Parallelslaloms stehen daneben. */
const zurueck = computed(() => (frage.value ? abmeldeZellen(state.value.eingaben, konfig.value, frage.value.starter) : []))
const zurueckLaeufe = computed(() => zurueck.value.filter((z) => !zerlegeAttempt(z.lauf)).map((z) => zerlegeLauf(z.lauf).lauf).sort((a, b) => a - b))
const rundenText = (runden: readonly string[]) => [...new Set(runden)].map((r) => rundenName(r as Parameters<typeof rundenName>[0], t)).join(', ')
const zurueckRunden = computed(() => rundenText(zurueck.value.flatMap((z) => zerlegeAttempt(z.lauf)?.runde ?? [])))
/** Parallelslalom: die Runden, in denen das Abmelden das X in leere Attempts setzt (lib/abmeldung.ts). */
const planRunden = computed(() => (frage.value ? rundenText(abmeldeAttempts(state.value, konfig.value, frage.value.starter).map((a) => a.runde)) : ''))
const liste = (laeufe: readonly number[]) => laeufe.join(', ')

function remove(p: Starter) {
  if (!fest.value) dispatch({ type: 'REMOVE_STARTER', id: p.id })
  else frage.value = { starter: p, art: abgemeldet.value.has(p.id) ? 'anmelden' : 'abmelden' }
}

function bestaetige() {
  const f = frage.value
  if (!f) return
  dispatch({ type: f.art === 'abmelden' ? 'ABMELDEN_STARTER' : 'ANMELDEN_STARTER', id: f.starter.id })
  frage.value = null
}
// Lösen sich die Voraussetzungen unter dem Dialog auf (anderes Fenster, Werte gelöscht), geht er zu.
watch([fest, () => props.starters], () => {
  if (frage.value && (!fest.value || !props.starters.some((p) => p.id === frage.value!.starter.id))) frage.value = null
})

function clearAll() {
  if (fest.value) return
  if (confirm(t('starters.clearConfirm', { n: props.starters.length, name: classLabel(props.classId) }) + verlustText(state.value, props.starters))) {
    dispatch({ type: 'CLEAR_CLASS', klasse: props.classId })
  }
}

// Auswahl für die Pokalauswertung, je Klasse: Das Kästchen im Spaltenkopf schaltet alle/keine
// (halb gesetzt, wenn nur einige zählen), „umkehren“ dreht die Markierung jedes Starters um.
// Das geht auch bei festem Starterfeld – die Auswahl ändert es nicht.
const pokalZaehlen = computed(() => props.starters.filter((p) => p.pokal !== false).length)
const ids = () => props.starters.map((p) => p.id)

const MOVES = [
  { target: 'first', icon: '⤒', top: true },
  { target: 'up', icon: '▲', top: true },
  { target: 'down', icon: '▼', top: false },
  { target: 'last', icon: '⤓', top: false },
] as const
</script>

<template>
  <section class="class-section">
    <div class="class-header">
      <button class="class-toggle-btn" :aria-expanded="open" @click="emit('toggle')">
        <span class="class-badge" :style="{ background: def.color }">{{ classBadge(classId) }}</span>
        <span class="title">{{ classLabel(classId) }}</span>
        <span class="count">{{ classLine }}</span>
        <span v-if="ohneDatum > 0" class="missing-badge" data-hinweis="ohne-datum">{{ tn('starters.birthdateMissingCount', ohneDatum) }}</span>
        <span class="chevron">{{ open ? '▾' : '▸' }}</span>
      </button>
      <div class="class-tools">
        <button v-if="unsorted" class="btn sm primary" :title="t('starters.sortTitle')" @click="sortNow">
          ⇅ {{ t('starters.sort') }}
        </button>
        <button class="btn sm" data-action="starter-neu" :disabled="fest" :title="fest ? t('lock.short') : undefined" @click="showAdd = !showAdd">+ {{ t('starters.manual') }}</button>
        <button
          :class="['btn', 'sm', edit ? 'primary' : '']"
          :disabled="starters.length === 0 || (edit && hasDuplicates)"
          :title="edit && hasDuplicates ? t('starters.duplicateBlock') : t('starters.editNumbersTitle')"
          :aria-pressed="edit"
          @click="toggleEdit"
        >
          {{ edit ? `✓ ${t('starters.editDone')}` : `✎ ${t('starters.editNumbers')}` }}
        </button>
        <button
          class="btn sm"
          :disabled="starters.length === 0 || unsorted"
          :title="t('starters.bySizeTitle')"
          @click="reorder({ type: 'ORDER_CLASS_BY_SIZE', klasse: classId })"
        >
          ↕ {{ t('starters.bySize') }}
        </button>
        <button
          v-if="pokalAuswahl"
          class="btn sm"
          data-action="pokal-umkehren-klasse"
          :disabled="starters.length === 0"
          :title="t('cup.select.invertTitle')"
          @click="dispatch({ type: 'INVERT_POKAL_ZAEHLT', ids: ids() })"
        >
          {{ t('cup.select.invertClass') }}
        </button>
        <button class="btn sm danger" data-action="klasse-leeren" :disabled="starters.length === 0 || fest" :title="fest ? t('lock.short') : undefined" @click="clearAll">
          {{ t('starters.clear') }}
        </button>
      </div>
    </div>

    <ManualAddForm
      v-if="showAdd && !fest"
      :class-id="classId"
      :existing="starters"
      @add="(p) => dispatch({ type: 'ADD_STARTERS', starters: [p] })"
      @done="showAdd = false"
    />

    <p v-if="edit && hasDuplicates" class="boat-banner warn" role="alert">{{ t('starters.duplicateBlock') }}</p>
    <p v-if="jahrFehler" class="boat-banner warn" role="alert" data-hinweis="jahrgang-falsch">{{ jahrFehler }}</p>

    <template v-if="open">
      <div v-if="starters.length === 0" class="empty">{{ t('starters.empty') }}</div>
      <!-- In schmalen Fenstern rollt die Tabelle in sich, nicht die Seite. -->
      <div v-else class="starters-rahmen">
      <table class="starters">
        <thead>
          <tr>
            <!-- Die Auswahl steht vorn: In schmalen Fenstern rollt die Tabelle in ihrem Rahmen,
                 und das Kästchen soll ohne Rollen zu erreichen sein. -->
            <th v-if="pokalAuswahl" class="cup-spalte" :title="t('cup.select.columnTitle')">
              <label>
                <input
                  type="checkbox"
                  data-feld="pokal-klasse"
                  :checked="pokalZaehlen === starters.length"
                  :indeterminate="pokalZaehlen > 0 && pokalZaehlen < starters.length"
                  :aria-label="t('cup.select.allClass', { name: classLabel(classId) })"
                  @change="dispatch({ type: 'SET_POKAL_ZAEHLT', ids: ids(), zaehlt: ($event.target as HTMLInputElement).checked })"
                />
                {{ t('cup.select.column') }}
              </label>
            </th>
            <th :style="{ width: edit ? '150px' : '64px' }">
              {{ t('common.startNr') }}
            </th>
            <th>{{ t('common.lastName') }}</th>
            <th>{{ t('common.firstName') }}</th>
            <th v-if="state.originMode !== 'none'">{{ t(originLabelKey(state.originMode)) }}</th>
            <th style="width: 64px">{{ t('common.size') }}</th>
            <th v-if="mitGeschlecht" style="width: 64px" data-spalte="geschlecht">{{ t('starters.sex') }}</th>
            <th style="width: 130px">{{ t('common.birthdate') }}</th>
            <th style="width: 40px" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(p, i) in shown"
            :key="p.id"
            :class="{ 'cup-zaehlt-nicht': pokalAuswahl && p.pokal === false, 'starter-abgemeldet': abgemeldet.has(p.id) }"
            :data-abgemeldet="abgemeldet.has(p.id) ? '' : undefined"
          >
            <td v-if="pokalAuswahl" class="cup-spalte">
              <input
                type="checkbox"
                data-feld="pokal-zaehlt"
                :checked="p.pokal !== false"
                :aria-label="t('cup.select.counts', { name: [p.vorname, p.nachname].filter(Boolean).join(' ') || p.startNr })"
                @change="dispatch({ type: 'SET_POKAL_ZAEHLT', ids: [p.id], zaehlt: ($event.target as HTMLInputElement).checked })"
              />
            </td>
            <template v-if="edit">
              <td class="num">
                <div class="nr-edit">
                  <input
                    class="nr-input"
                    :value="p.startNr"
                    :aria-label="t('common.startNr')"
                    :aria-invalid="duplicates.has(p.id)"
                    :title="duplicates.has(p.id) ? t('starters.duplicate') : undefined"
                    @input="update(p.id, 'startNr', $event)"
                  />
                  <span class="nr-moves">
                    <button
                      v-for="m in MOVES"
                      :key="m.target"
                      class="mv"
                      :disabled="unsorted || (m.top ? i === 0 : i === starters.length - 1)"
                      :title="t(`starters.move.${m.target}`)"
                      :aria-label="t(`starters.move.${m.target}`)"
                      @click="reorder({ type: 'MOVE_STARTER', id: p.id, target: m.target })"
                    >
                      {{ m.icon }}
                    </button>
                  </span>
                </div>
              </td>
              <td>
                <input class="cell-input" :value="p.nachname" :aria-label="t('common.lastName')" @change="update(p.id, 'nachname', $event)" />
              </td>
              <td>
                <input class="cell-input" :value="p.vorname" :aria-label="t('common.firstName')" @change="update(p.id, 'vorname', $event)" />
              </td>
              <td v-if="state.originMode !== 'none'">
                <!-- Die Flagge vor dem Feld zeigt beim Tippen, ob die Angabe als Bundesland oder Staat erkannt ist. -->
                <span class="herkunft-feld">
                  <HerkunftText v-if="flagge(p).flagge" :anzeige="flagge(p)" />
                  <input
                    class="cell-input"
                    :value="p[originField(state.originMode)] ?? ''"
                    :aria-label="t(originLabelKey(state.originMode))"
                    @change="update(p.id, originField(state.originMode), $event)"
                  />
                </span>
              </td>
              <td>
                <select
                  class="size-select"
                  :value="SIZES.includes(p.groesse as (typeof SIZES)[number]) ? p.groesse : ''"
                  :aria-label="t('common.size')"
                  @change="update(p.id, 'groesse', $event)"
                >
                  <option value="">–</option>
                  <option v-for="s in SIZES" :key="s" :value="s">{{ s }}</option>
                </select>
              </td>
              <td v-if="mitGeschlecht">
                <!-- Freiwillig (Regel 960, Pkt. 3.7 „Sex“): M, F, D, nA (keine Angabe); leer = nicht erfasst. -->
                <select class="size-select" data-feld="geschlecht" :value="p.geschlecht ?? ''" :aria-label="t('starters.sex')" :title="t('starters.sexHint')" @change="setzeGeschlecht(p.id, $event)">
                  <option value="">–</option>
                  <option v-for="g in GESCHLECHTER" :key="g" :value="g" :title="t(`starters.sex.${g}`)">{{ g }}</option>
                </select>
              </td>
              <td>
                <input
                  :class="['cell-input', p.geburtsdatum ? '' : 'missing']"
                  type="date"
                  :value="p.geburtsdatum"
                  :aria-label="t('common.birthdate')"
                  @change="update(p.id, 'geburtsdatum', $event)"
                />
              </td>
            </template>
            <template v-else>
              <td :class="['num', duplicates.has(p.id) ? 'dup' : '']" :title="duplicates.has(p.id) ? t('starters.duplicate') : undefined">
                {{ p.startNr || '–' }}
              </td>
              <td>
                {{ p.nachname }}
                <span v-if="abgemeldet.has(p.id)" class="abgemeldet-marke">{{ t('starters.withdraw.mark') }}</span>
              </td>
              <td>{{ p.vorname }}</td>
              <td v-if="state.originMode !== 'none'"><HerkunftText :anzeige="herkunftAnzeige(originOf(p, state.originMode), state.originMode, 'flagge-lang', {}, locale, true)" /></td>
              <td>{{ p.groesse || '–' }}</td>
              <td v-if="mitGeschlecht" data-spalte="geschlecht">{{ p.geschlecht ?? '–' }}</td>
              <td :class="p.geburtsdatum ? '' : 'cell-missing'">{{ p.geburtsdatum ? formatDate(p.geburtsdatum) : t('starters.birthdateMissing') }}</td>
            </template>
            <td>
              <button
                v-if="fest && abgemeldet.has(p.id)"
                class="del zurueck"
                data-action="starter-anmelden"
                :title="t('starters.reinstate.confirm')"
                :aria-label="t('starters.reinstate.confirm')"
                @click="remove(p)"
              >
                ↺
              </button>
              <button
                v-else
                class="del"
                data-action="starter-entfernen"
                :title="fest ? t('starters.withdraw.title') : t('common.remove')"
                :aria-label="t('common.remove')"
                :aria-haspopup="fest ? 'dialog' : undefined"
                @click="remove(p)"
              >
                ×
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </template>

    <AppDialog v-if="frage && plan && frage.art === 'abmelden'" :titel="t('starters.withdraw.heading', { who: frageWer })" data-dialog="abmelden" @abbrechen="frage = null">
      <p>{{ t('starters.withdraw.why') }}</p>
      <template v-if="plan.ziel">
        <p>
          {{ tn('starters.withdraw.offer', state.laufCount, { column: plan.ziel.label, list: konfig.getSheetDef(plan.ziel.liste).title, dns: t('results.dns') }) }}
        </p>
        <ul class="app-dialog-liste">
          <li v-if="plan.frei.length > 0" data-plan="frei">{{ tn('starters.withdraw.free', plan.frei.length, { runs: liste(plan.frei) }) }}</li>
          <li v-if="plan.schonX.length > 0" data-plan="schon">{{ tn('starters.withdraw.already', plan.schonX.length, { runs: liste(plan.schonX) }) }}</li>
          <li v-if="planRunden" data-plan="parallel">{{ t('starters.withdraw.parallel', { rounds: planRunden }) }}</li>
          <li v-if="plan.belegt.length > 0" data-plan="belegt">
            <strong>{{ tn('starters.withdraw.kept', plan.belegt.length, { runs: liste(plan.belegt) }) }}</strong>
            {{ t('starters.withdraw.keptNote') }}
          </li>
        </ul>
        <p class="note">{{ t('starters.withdraw.undo') }}</p>
      </template>
      <p v-else class="boat-banner warn">{{ t('starters.withdraw.none') }}</p>
      <template #knoepfe>
        <button v-if="plan.ziel" type="button" class="btn primary" data-action="abmelden-bestaetigen" autofocus @click="bestaetige">{{ t('starters.withdraw.confirm') }}</button>
        <button type="button" class="btn" data-action="dialog-abbrechen" @click="frage = null">{{ t('common.cancel') }}</button>
      </template>
    </AppDialog>

    <AppDialog v-if="frage && frage.art === 'anmelden'" :titel="t('starters.reinstate.heading', { who: frageWer })" data-dialog="anmelden" @abbrechen="frage = null">
      <p v-if="zurueckLaeufe.length > 0">{{ tn('starters.reinstate.text', zurueckLaeufe.length, { runs: liste(zurueckLaeufe), dns: t('results.dns') }) }}</p>
      <p v-else-if="!zurueckRunden">{{ t('starters.reinstate.nothing', { dns: t('results.dns') }) }}</p>
      <p v-if="zurueckRunden" data-plan="parallel">{{ t('starters.reinstate.parallel', { rounds: zurueckRunden }) }}</p>
      <p class="note">{{ t('starters.reinstate.note') }}</p>
      <template #knoepfe>
        <button type="button" class="btn primary" data-action="anmelden-bestaetigen" autofocus @click="bestaetige">{{ t('starters.reinstate.confirm') }}</button>
        <button type="button" class="btn" data-action="dialog-abbrechen" @click="frage = null">{{ t('common.cancel') }}</button>
      </template>
    </AppDialog>
  </section>
</template>
