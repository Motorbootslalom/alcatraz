<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../state/store'
import { birthYearRange } from '../domain/classes'
import { SIZES } from '../domain/sizes'
import { makeStartNr, parseClassNumber } from '../domain/startnumbers'
import { uid } from '../domain/ids'
import { originField, originLabelKey } from '../lib/origin'
import { t } from '../i18n'
import type { ClassId, Starter } from '../types'

const props = defineProps<{ classId: ClassId; existing: Starter[] }>()
const emit = defineEmits<{ add: [p: Starter]; done: [] }>()

const { state } = useStore()
const range = computed(() => birthYearRange(props.classId, state.value.eventJahr))
const vorname = ref('')
const nachname = ref('')
const herkunft = ref('')
const geb = ref('')
const groesse = ref('')

/** Klassenbasiert folgt die nächste Nummer der Klasse; klassische bleiben leer, bis sie vergeben werden. */
function nextStartNr(): string {
  if (state.value.startNrMode === 'klassisch') return ''
  let max = 0
  for (const p of props.existing) max = Math.max(max, parseClassNumber(p.startNr, props.classId) ?? 0)
  return makeStartNr(props.classId, max + 1)
}

function submit() {
  if (!vorname.value.trim() || !nachname.value.trim()) return
  const feld = originField(state.value.originMode)
  const wert = herkunft.value.trim()
  emit('add', {
    id: uid('st'),
    startNr: nextStartNr(),
    vorname: vorname.value.trim(),
    nachname: nachname.value.trim(),
    verein: feld === 'verein' ? wert : '',
    bundesland: feld === 'bundesland' ? wert : '',
    ...(feld === 'land' && wert ? { land: wert } : {}),
    geburtsdatum: geb.value,
    klasse: props.classId,
    groesse: groesse.value,
  })
  emit('done')
}
</script>

<template>
  <form class="panel add-form" @submit.prevent="submit">
    <div class="row">
      <div class="field" style="flex: 1; min-width: 120px">
        <label :for="`add-fn-${classId}`">{{ t('common.firstName') }}</label>
        <input :id="`add-fn-${classId}`" v-model="vorname" class="input" />
      </div>
      <div class="field" style="flex: 1; min-width: 120px">
        <label :for="`add-ln-${classId}`">{{ t('common.lastName') }}</label>
        <input :id="`add-ln-${classId}`" v-model="nachname" class="input" />
      </div>
      <div v-if="state.originMode !== 'none'" class="field" style="flex: 2; min-width: 160px">
        <label :for="`add-or-${classId}`">{{ t(originLabelKey(state.originMode)) }}</label>
        <input :id="`add-or-${classId}`" v-model="herkunft" class="input" />
      </div>
      <div class="field" style="width: 190px">
        <label :for="`add-bd-${classId}`">{{ t('starters.birthLabel', { from: range[0], to: range[1] }) }}</label>
        <input
          :id="`add-bd-${classId}`"
          v-model="geb"
          class="input"
          type="date"
          :min="`${range[0]}-01-01`"
          :max="`${range[1]}-12-31`"
        />
      </div>
      <div class="field" style="width: 80px">
        <label :for="`add-sz-${classId}`">{{ t('common.size') }}</label>
        <select :id="`add-sz-${classId}`" v-model="groesse" class="input">
          <option value="">–</option>
          <option v-for="s in SIZES" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>
      <button class="btn primary" type="submit" :disabled="!vorname.trim() || !nachname.trim()">
        {{ t('common.add') }}
      </button>
    </div>
  </form>
</template>
