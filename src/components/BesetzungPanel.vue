<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import { useEvent } from '../lib/event'
import { classColor } from '../domain/classes'
import { BESETZUNG_MAX, besetzungText, coPilotVorgesehen } from '../lib/besetzung'
import { sprungziel } from '../lib/router'
import { t } from '../i18n'
import type { ClassId } from '../types'
import WkrEinteilung from './WkrEinteilung.vue'

/**
 * Block „Besetzung“ der Ansicht „Veranstaltung“: was die Regattaleitung für diesen Wettkampf
 * einteilt – welches Boot jede Klasse fährt, wer als Co-Pilot mitfährt und wer an welcher
 * Liste sitzt (WkrEinteilung.vue). Wunsch des Nutzers: Für einen gewöhnlichen Wettkampf soll
 * niemand in die Einstellungen wechseln müssen.
 *
 * Zugeklappt, solange nichts eingetragen ist – die Ansicht bleibt beim Anlegen der
 * Veranstaltung kurz; die Kopfzeile sagt auch zugeklappt, was schon eingetragen ist. Offen,
 * sobald etwas eingetragen ist oder ein Verweis hierher führt (`#/veranstaltung?wkr`,
 * `…?besetzung`); von Hand auf- oder zugeklappt bleibt er so, auch über ein Neuladen.
 *
 * Boote sind Einstellungen (auch in der Vorlage). Co-Piloten und Wettkampfrichter sind
 * Personennamen: nur in der Sicherung (persistenz/backup.ts).
 */
const { state, dispatch } = useStore()
const { regelwerk, classes, classLabel } = useEvent()

const anzahl = (b: Partial<Record<ClassId, string>>) => classes.value.filter((c) => besetzungText(b, c.id) !== '').length
const boote = computed(() => anzahl(state.value.boote))
const coPiloten = computed(() => anzahl(state.value.coPiloten))
/** Klassen der Veranstaltung, in denen das Regelwerk einen Co-Piloten vorsieht. */
const coPilotKlassen = computed(() => classes.value.filter((c) => coPilotVorgesehen(state.value.regelwerk, c.id)))
const wkr = computed(() => Object.values(state.value.einteilung).reduce((n, listen) => n + Object.values(listen).filter((name) => name.trim() !== '').length, 0))
const leer = computed(() => boote.value + coPiloten.value + wkr.value === 0)

const block = ref<HTMLDetailsElement | null>(null)
const ziel = sprungziel()
const gerufen = ziel === 'wkr' || ziel === 'besetzung'
const offen = merke('veranstaltung.besetzung', () => !leer.value, { ueberNeuladen: true })
if (gerufen) offen.value = true
onMounted(async () => {
  if (!gerufen) return
  await nextTick()
  // `?wkr` meint die Tabelle der Wettkampfrichter (alte Verweise aus den Einstellungen), `?besetzung` den Block.
  const el = ziel === 'wkr' ? block.value?.querySelector('#wkr-einteilung') : block.value
  el?.scrollIntoView?.({ block: 'start' })
})

function setze(feld: 'boot' | 'coPilot', klasse: ClassId, e: Event) {
  const text = (e.target as HTMLInputElement).value
  dispatch(feld === 'boot' ? { type: 'SET_BOOT', klasse, text } : { type: 'SET_CO_PILOT', klasse, text })
}

// Enter springt ins Feld darunter – erst alle Boote, dann alle Co-Piloten, wie man es vom Zettel abliest.
const tabelle = ref<HTMLTableElement>()
function weiter(e: Event) {
  const feld = e.target as HTMLInputElement
  const spalte = [...(tabelle.value?.querySelectorAll<HTMLInputElement>(`input[data-spalte="${feld.dataset.spalte}"]`) ?? [])]
  const naechstes = spalte[spalte.indexOf(feld) + 1] ?? (feld.dataset.spalte === 'boot' ? tabelle.value?.querySelector<HTMLInputElement>('input[data-spalte="coPilot"]') : undefined)
  naechstes?.focus()
  naechstes?.select()
}
</script>

<template>
  <details id="besetzung" ref="block" class="panel besetzung" data-block="besetzung" :open="offen" @toggle="offen = ($event.target as HTMLDetailsElement).open">
    <summary>
      {{ t('crew.title') }}
      <span class="besetzung-stand" data-hinweis="besetzung-stand">{{
        leer ? t('crew.status.empty') : t('crew.status', { boats: boote, classes: classes.length, copilots: coPiloten, copilotClasses: coPilotKlassen.length, judges: wkr })
      }}</span>
    </summary>
    <p class="hint">{{ t('crew.intro') }}</p>

    <div class="besetzung-teil" data-teil="klassen">
      <h3 class="subhead">{{ t('crew.classes.title') }}</h3>
      <p class="hint">
        {{ t('crew.classes.hint') }}
        <template v-if="coPilotKlassen.length > 0">{{ t('crew.classes.coPilotRule', { rulebook: regelwerk.label, classes: coPilotKlassen.map((c) => classLabel(c.id)).join(', ') }) }}</template>
      </p>
      <table ref="tabelle" class="besetzung-tabelle">
        <thead>
          <tr>
            <th scope="col">{{ t('lists.class') }}</th>
            <th scope="col">{{ t('crew.boat') }}</th>
            <th scope="col">{{ t('crew.coPilot') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in classes" :key="c.id" :data-klasse="c.id">
            <th scope="row">
              <span class="class-badge sm" :style="{ background: classColor(c.id) }">{{ c.id }}</span>
              {{ classLabel(c.id) }}
            </th>
            <td :data-titel="t('crew.boat')">
              <input
                class="cell-input"
                autocomplete="off"
                data-spalte="boot"
                :data-feld="`boot|${c.id}`"
                :maxlength="BESETZUNG_MAX"
                :value="state.boote[c.id] ?? ''"
                :placeholder="t('crew.boatPlaceholder')"
                :aria-label="t('crew.boatFor', { name: classLabel(c.id) })"
                @input="setze('boot', c.id, $event)"
                @keydown.enter.prevent="weiter"
              />
            </td>
            <!-- Wo das Regelwerk keinen Co-Piloten vorsieht, bleibt das Feld – unauffällig: Club- und
                 Landesmeisterschaften dürfen begründet abweichen (DM-Reglement, Abschnitt C). -->
            <td :data-titel="t('crew.coPilot')">
              <input
                :class="['cell-input', coPilotVorgesehen(state.regelwerk, c.id) ? '' : 'besetzung-ohne']"
                autocomplete="off"
                data-spalte="coPilot"
                :data-feld="`coPilot|${c.id}`"
                :maxlength="BESETZUNG_MAX"
                :value="state.coPiloten[c.id] ?? ''"
                :placeholder="coPilotVorgesehen(state.regelwerk, c.id) ? t('wkr.name') : t('crew.coPilotNone')"
                :aria-label="t('crew.coPilotFor', { name: classLabel(c.id) })"
                @input="setze('coPilot', c.id, $event)"
                @keydown.enter.prevent="weiter"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <p class="note">{{ t('crew.privacyNote') }}</p>
    </div>

    <WkrEinteilung eingebettet />
  </details>
</template>
