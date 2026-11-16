<script setup lang="ts">
import { computed } from 'vue'
import type { ClassId, OeffentlicheSicht, SichtBereich } from '../../types'
import type { BetriebAenderung } from '../../state/reducer/betrieb'
import { t } from '../../i18n'
import { merke } from '../../lib/merken'
import { punktText } from './texte'

/**
 * Klassen an der Start-Freigabe (B-9, B-10, V-5): Fällt ein Boot aus, „Boot fehlt“ – die Klasse fährt
 * vorerst nicht, ihre Starts stehen am Ende des Laufs. „Boot ist zurück“ verzahnt den Rest des Laufs wieder
 * mit ihr. „Andere Klassen vorziehen“ entscheidet nur, ob die übrigen auf die freien Plätze aufrücken.
 *
 * Die Klassen stehen in der Folge, in der sie drankommen. „Vorziehen“ macht eine Klasse zur nächsten
 * (BETRIEB_KLASSE_VOR vor die erste fahrende) – umgestellt wird nur innerhalb der Spuren; eine Klasse, die
 * ihre Spur für sich hat, hat den Knopf nicht (B-10). Ein Knopf statt Ziehen: am Laptop am Steg ein sicherer
 * Griff (BETRIEB_ANNAHMEN.knoepfeStattZiehen). Darunter die Folge, in der die Starts jetzt drankommen.
 *
 * Nichts davon ist unumkehrbar – deshalb ohne Rückfrage. Liest nur die öffentliche Sicht, schickt Actions
 * über `sende`.
 */
const props = defineProps<{
  sicht: OeffentlicheSicht
  bereich: SichtBereich
  sende: (action: BetriebAenderung) => void
  gesperrt?: boolean
}>()

const b = computed(() => props.bereich)
// Aufgeklappt bleibt, wie man es gelassen hat – auch über den Wechsel der Ansicht (lib/merken.ts).
const offen = merke(`betrieb.klassen.${props.bereich.id}`, false)

const name = (k: ClassId) => props.sicht.klassen[k]?.name ?? k
const farbe = (k: ClassId) => props.sicht.klassen[k]?.farbe ?? 'var(--muted)'
const fehlend = computed(() => b.value.klassenFolge.filter((k) => k.ausgesetzt))
const erste = computed(() => b.value.klassenFolge.find((k) => !k.ausgesetzt)?.klasse ?? null)

function aussetzen(klasse: ClassId, an: boolean) {
  props.sende({ type: 'BETRIEB_AUSSETZEN', bereich: b.value.id, klasse, an })
}
function vorziehenKlasse(klasse: ClassId) {
  if (erste.value && erste.value !== klasse) props.sende({ type: 'BETRIEB_KLASSE_VOR', bereich: b.value.id, klasse, vor: erste.value })
}
function vorziehen(an: boolean) {
  props.sende({ type: 'BETRIEB_VORZIEHEN', bereich: b.value.id, an })
}

/** Höchstens so viele Plaketten in der Vorschau – mehr liest am Steg niemand. */
const VORSCHAU = 30
/** Die Folge im Arbeitspunkt: wer fährt (in der Folge), dahinter grau, wessen Boot fehlt (V-5: am Ende des Laufs). */
const vorschau = computed(() => {
  const punkt = b.value.arbeitsPunkt?.id
  if (!punkt) return []
  const klasse = (starter: string) => props.sicht.starter[starter]?.klasse
  const fahrend = b.value.waehlbar.filter((s) => s.punkt === punkt).map((s) => ({ key: s.key, klasse: klasse(s.starter), aus: false }))
  const fehlt = b.value.bootFehlt.filter((s) => s.punkt === punkt).map((s) => ({ key: s.key, klasse: klasse(s.starter), aus: true }))
  return [...fahrend, ...fehlt]
})
</script>

<template>
  <details class="betrieb-abschnitt" data-teil="klassen" :open="offen" @toggle="offen = ($event.target as HTMLDetailsElement).open">
    <summary>
      {{ t('betrieb.klassen') }}
      <!-- Zugeklappt darf nicht verborgen bleiben, dass eine Klasse aussetzt. -->
      <span v-if="fehlend.length" class="betrieb-aktiv stoerung" data-teil="boot-fehlt">
        {{ t('betrieb.klassen.aktiv', { klassen: fehlend.map((k) => name(k.klasse)).join(', ') }) }}
      </span>
    </summary>
    <p class="note">{{ t('betrieb.klassen.hint') }}</p>
    <p v-if="b.arbeitsPunkt" class="note" data-teil="klassen-punkt">{{ t('betrieb.klassen.punkt', { punkt: punktText(b.arbeitsPunkt) }) }}</p>

    <ul v-if="b.klassenFolge.length" class="betrieb-klassen">
      <li v-for="k in b.klassenFolge" :key="k.klasse" :data-klasse="k.klasse" :class="{ aus: k.ausgesetzt }">
        <span class="class-badge" :style="{ background: k.ausgesetzt ? 'var(--muted)' : farbe(k.klasse) }">{{ name(k.klasse) }}</span>
        <span class="note">{{ t('betrieb.klassen.noch', { n: k.offen }) }}</span>
        <button
          type="button"
          :class="['btn', 'sm', k.ausgesetzt ? 'primary' : '']"
          data-action="aussetzen"
          :aria-pressed="k.ausgesetzt"
          :disabled="gesperrt"
          :title="k.ausgesetzt ? t('betrieb.klassen.bootZurueck.title') : t('betrieb.klassen.bootFehlt.title')"
          @click="aussetzen(k.klasse, !k.ausgesetzt)"
        >
          {{ k.ausgesetzt ? t('betrieb.klassen.bootZurueck') : t('betrieb.klassen.bootFehlt') }}
        </button>
        <button
          v-if="!k.ausgesetzt && k.verschiebbar && k.klasse !== erste"
          type="button"
          class="btn sm"
          data-action="klasse-vor"
          :disabled="gesperrt"
          :title="t('betrieb.klassen.vor.title')"
          @click="vorziehenKlasse(k.klasse)"
        >
          {{ t('betrieb.klassen.vor') }}
        </button>
      </li>
    </ul>
    <p v-else class="note">{{ t('betrieb.klassen.keine') }}</p>

    <label class="boat-check betrieb-vorziehen">
      <input type="checkbox" data-action="vorziehen" :checked="b.vorziehen" :disabled="gesperrt" @change="vorziehen(($event.target as HTMLInputElement).checked)" />
      {{ t('betrieb.vorziehen') }}
    </label>
    <p class="note">{{ b.vorziehen ? t('betrieb.vorziehen.an') : t('betrieb.vorziehen.aus') }}</p>

    <div v-if="vorschau.length" class="betrieb-vorschau" data-teil="vorschau">
      <span class="note">{{ t('betrieb.klassen.folge') }}</span>
      <span class="betrieb-plaketten">
        <span
          v-for="v in vorschau.slice(0, VORSCHAU)"
          :key="v.key"
          :class="['class-badge', 'sm', { aus: v.aus }]"
          :style="{ background: v.aus || !v.klasse ? 'var(--muted)' : farbe(v.klasse) }"
          :title="v.aus ? t('betrieb.status.bootFehlt') : undefined"
          >{{ v.klasse ? name(v.klasse) : '?' }}</span
        >
        <span v-if="vorschau.length > VORSCHAU" class="note">…</span>
      </span>
    </div>
  </details>
</template>
