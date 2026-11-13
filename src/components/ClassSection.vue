<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useStore } from '../state/store'
import { birthYearRange, getClass } from '../domain/classes'
import { SIZES } from '../domain/sizes'
import { originField, originLabelKey, originOf } from '../lib/origin'
import { useEvent } from '../lib/event'
import { verlustText, verlustZahl } from '../lib/eingabenVerlust'
import { formatDate, t, tn } from '../i18n'
import ManualAddForm from './ManualAddForm.vue'
import type { ClassId, Starter } from '../types'

const props = defineProps<{
  classId: ClassId
  starters: Starter[]
  /** IDs der Starter mit doppelt vergebener Startnummer (über die ganze Veranstaltung ermittelt). */
  duplicates: Set<string>
  open: boolean
  /** Zählt hoch, wenn die Liste von außen neu geordnet werden soll (automatische Vergabe). */
  sortTick: number
}>()

const emit = defineEmits<{ toggle: [] }>()

const { state, dispatch } = useStore()
const { classLabel } = useEvent()
const def = computed(() => getClass(props.classId))
const showAdd = ref(false)
const edit = ref(false)

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

function update(id: string, field: keyof Omit<Starter, 'id' | 'klasse'>, e: Event) {
  dispatch({ type: 'UPDATE_STARTER', id, patch: { [field]: (e.target as HTMLInputElement).value } })
}

/** Ein Klick genügt – außer es sind für den Starter schon Werte erfasst: Die gingen ohne Rückgängig mit. */
function remove(p: Starter) {
  const name = [p.startNr, p.vorname, p.nachname].filter(Boolean).join(' ')
  if (verlustZahl(state.value, [p]) > 0 && !confirm(t('entries.removeConfirm', { name }))) return
  dispatch({ type: 'REMOVE_STARTER', id: p.id })
}

function clearAll() {
  if (confirm(t('starters.clearConfirm', { n: props.starters.length, name: classLabel(props.classId) }) + verlustText(state.value, props.starters))) {
    dispatch({ type: 'CLEAR_CLASS', klasse: props.classId })
  }
}

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
        <span class="class-badge" :style="{ background: def.color }">{{ classId }}</span>
        <span class="title">{{ classLabel(classId) }}</span>
        <span class="count">{{ classLine }}</span>
        <span class="chevron">{{ open ? '▾' : '▸' }}</span>
      </button>
      <div class="class-tools">
        <button v-if="unsorted" class="btn sm primary" :title="t('starters.sortTitle')" @click="sortNow">
          ⇅ {{ t('starters.sort') }}
        </button>
        <button class="btn sm" @click="showAdd = !showAdd">+ {{ t('starters.manual') }}</button>
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
        <button class="btn sm danger" :disabled="starters.length === 0" @click="clearAll">
          {{ t('starters.clear') }}
        </button>
      </div>
    </div>

    <ManualAddForm
      v-if="showAdd"
      :class-id="classId"
      :existing="starters"
      @add="(p) => dispatch({ type: 'ADD_STARTERS', starters: [p] })"
      @done="showAdd = false"
    />

    <p v-if="edit && hasDuplicates" class="boat-banner warn" role="alert">{{ t('starters.duplicateBlock') }}</p>

    <template v-if="open">
      <div v-if="starters.length === 0" class="empty">{{ t('starters.empty') }}</div>
      <table v-else class="starters">
        <thead>
          <tr>
            <th :style="{ width: edit ? '150px' : '64px' }">
              {{ t('common.startNr') }}
            </th>
            <th>{{ t('common.lastName') }}</th>
            <th>{{ t('common.firstName') }}</th>
            <th v-if="state.originMode !== 'none'">{{ t(originLabelKey(state.originMode)) }}</th>
            <th style="width: 64px">{{ t('common.size') }}</th>
            <th style="width: 130px">{{ t('common.birthdate') }}</th>
            <th style="width: 40px" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, i) in shown" :key="p.id">
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
                <input
                  class="cell-input"
                  :value="p[originField(state.originMode)] ?? ''"
                  :aria-label="t(originLabelKey(state.originMode))"
                  @change="update(p.id, originField(state.originMode), $event)"
                />
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
              <td>
                <input
                  class="cell-input"
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
              <td>{{ p.nachname }}</td>
              <td>{{ p.vorname }}</td>
              <td v-if="state.originMode !== 'none'">{{ originOf(p, state.originMode) }}</td>
              <td>{{ p.groesse || '–' }}</td>
              <td>{{ p.geburtsdatum ? formatDate(p.geburtsdatum) : '–' }}</td>
            </template>
            <td>
              <button
                class="del"
                :title="t('common.remove')"
                :aria-label="t('common.remove')"
                @click="remove(p)"
              >
                ×
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </section>
</template>
