<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { OeffentlicheSicht, PaarSeite, SichtBereich, SichtStart } from '../../types'
import { t } from '../../i18n'
import AppDialog from '../AppDialog.vue'
import { punktText, punktVon, startZeile, tBereich, type SeitenZeile, type StartZeile } from './texte'

/**
 * „Wiederholung (Ausfall) …“ an der Start-Freigabe (Nutzer 26.11.2026, R11-11; BETRIEB_ANNAHMEN WH3) – am Bedienrechner
 * und seit dem 27.11.2026 auch auf dem gekoppelten Freigabe-Handy (R13-01: „Die Start-Freigabe ist die Instance, die
 * bestimmt, wer im Parcours ist …“): Die Wettkampfleitung hat für einen schon gezeigten Start eine Wiederholung
 * entschieden. Die Wahl sind die gezeigten, geltenden Starts der laufenden Läufe (`bereich.gefahren`, seit sv 8 in jeder
 * Sicht), der zuletzt gezeigte zuerst – die ersten {@link ERSTE}, der Rest über die Startnummer. Rückfrage mit
 * Startnummer, Lauf und Folgen; erst „Werte verwerfen und wiederholen“ schickt `wiederholen` (BetriebView dispatcht
 * WIEDERHOLUNG_AUSFALL, GeraetFreigabe schickt sie an den Host – eine Action der Erfassung, deshalb nicht über `sende`).
 * Liest nur die Sicht und `nicht`.
 *
 * Parallelslalom (Nutzer 27.11.2026, R13-02): Die Wahl sind die gezeigten Paare der laufenden Runden; die Rückfrage fragt
 * JEDES MAL, welche Boote wiederholen – „Nur 101 (Parcours A)“, „Nur 102 (Parcours B)“ oder „Beide wiederholen“, ohne
 * Vorauswahl (BETRIEB_ANNAHMEN.wiederholungParallelWahl); ein Paar mit leerer Seite bietet nur das Boot an, das fuhr.
 * Der Knopf ist zugleich die Bestätigung und schickt `wiederholen(key, nur)` – `nur` fehlt bei „Beide“.
 *
 * Gebunden an den gesehenen Versuch (Prüfbefund 27.11.2026, BETRIEB_ANNAHMEN.wiederholungGebunden): `wiederholen`
 * trägt die Zahl der Abbrüche des Starts (SichtStart.`abbrueche`) mit; die Rückfrage schließt sich, sobald ihr Start
 * nicht mehr so in `gefahren` steht (anderswo ausgelöst, „Zurück“, X) – sie träfe sonst einen späteren Versuch.
 */
const props = defineProps<{
  sicht: OeffentlicheSicht
  bereich: SichtBereich
  gesperrt?: boolean
  /**
   * Starter-IDs ohne Wiederholung: abgemeldet (WH10 – das X käme beim Leeren nicht zurück). Ausgegraut mit Satz statt
   * einer Rückfrage, auf die still nichts geschähe (Prüfbefund 27.11.2026). Am Bedienrechner aus dem Stand, auf dem
   * Freigabe-Handy aus der Freigabe-Sicht (nur die Abgemeldeten unter den gefahrenen Starts, R13-01); nie aus der Sicht.
   */
  nicht?: readonly string[]
}>()
const emit = defineEmits<{ wiederholen: [key: string, nur: PaarSeite | undefined, abbrueche: number]; fertig: [] }>()

/** So viele zeigt die Wahl ohne Suche: meist ist es der Start im Boot oder einer kurz davor. */
const ERSTE = 8

const suche = ref('')
const sucheFeld = ref<HTMLInputElement | null>(null)
onMounted(() => sucheFeld.value?.focus())

const klein = (x: string) => x.toLowerCase().replace(/\s+/g, '')
/** Die Starter eines Starts – ein Paar: die Boote, die in diesem Versuch fuhren. */
const starterVon = (s: SichtStart): string[] => (s.paar ? [s.paar.a, s.paar.b].filter((id): id is string => id !== null) : [s.starter])
const abgemeldet = (id: string | null) => id !== null && !!props.nicht?.includes(id)
// Ausgegraut nur, wenn jedes Boot des Starts abgemeldet ist; im Paar sperrt der Dialog die einzelne Seite. Ein Start
// ohne Boot kommt in `gefahren` nicht vor (betrieb/folge.ts faehrtNoch) – „abgemeldet“ dann trotzdem nicht aus `[].every`.
const alle = computed(() =>
  props.bereich.gefahren.map((s) => {
    const ids = starterVon(s)
    return { s, z: startZeile(props.sicht, s), nicht: ids.length > 0 && ids.every(abgemeldet) }
  }),
)
const zeilen = computed(() => {
  const q = klein(suche.value)
  if (!q) return alle.value.slice(0, ERSTE)
  return alle.value.filter(({ z }) => z.nummern.some((n) => klein(n).includes(q)) || klein(z.name).includes(q))
})

/** Der Start, für den die Rückfrage offen ist. */
const frage = ref<{ s: SichtStart; z: StartZeile } | null>(null)
// Steht der Start nicht mehr mit derselben Zahl der Abbrüche in `gefahren`, geht die Rückfrage zu; sonst folgt sie ihm
// (im Paar kann eine Seite leer geworden sein – die Knöpfe zeigen dann nur noch das Boot, das fährt).
watch(
  () => props.bereich.gefahren,
  (neu) => {
    const f = frage.value
    if (!f) return
    const jetzt = neu.find((x) => x.key === f.s.key && (x.abbrueche ?? 0) === (f.s.abbrueche ?? 0))
    frage.value = jetzt ? { s: jetzt, z: startZeile(props.sicht, jetzt) } : null
  },
)
/** „Lauf 2“; im Parallelslalom „Vorlauf · Versuch 1“ (Runde in der Sprache der Oberfläche). */
function laufText(s: SichtStart): string {
  if (!s.paar) return t('betrieb.lauf', { n: s.lauf })
  const p = punktVon(props.bereich, s.punkt)
  return [p ? punktText(p) : '', t('betrieb.versuch', { n: s.paar.attempt })].filter(Boolean).join(' · ')
}
/** Die Boote eines Paares, die wiederholen können (die fuhren), mit ihrer Seite – A vor B. */
function seitenVon(f: { s: SichtStart; z: StartZeile }): { seite: PaarSeite; z: SeitenZeile; nicht: boolean }[] {
  const paar = f.s.paar
  if (!paar || !f.z.seiten) return []
  return (['a', 'b'] as const).flatMap((seite, i) => (paar[seite] !== null ? [{ seite, z: f.z.seiten![i], nicht: abgemeldet(paar[seite]) }] : []))
}
/** Mit „Versuche nacheinander“ (ein Punkt, mehrere Läufe) bleibt die Vorsteg-Zeile – die Rückfrage sagt es (WH6). */
const vorstegBleibt = (s: SichtStart) => (punktVon(props.bereich, s.punkt)?.laeufe.length ?? 0) > 1

function ja(nur?: PaarSeite) {
  const f = frage.value
  frage.value = null
  if (!f) return
  emit('wiederholen', f.s.key, nur, f.s.abbrueche ?? 0)
  suche.value = ''
  emit('fertig')
}
</script>

<template>
  <div class="betrieb-folge" data-teil="ausfall">
    <div class="row betrieb-folge-kopf">
      <input
        ref="sucheFeld"
        v-model="suche"
        class="input"
        type="search"
        data-feld="ausfall-suche"
        :placeholder="t('betrieb.ausfall.suche')"
        :aria-label="t('betrieb.ausfall.suche')"
        @keydown.esc="suche ? (suche = '') : emit('fertig')"
      />
    </div>
    <p class="note">{{ tBereich(bereich, 'betrieb.ausfall.hint') }}</p>
    <p v-if="zeilen.length === 0" class="note" data-teil="ausfall-leer">{{ suche ? t('betrieb.ausfall.keine') : t('betrieb.ausfall.keiner') }}</p>
    <ol v-else class="betrieb-folge-liste">
      <li v-for="{ s, z, nicht: ohne } in zeilen" :key="z.key" :data-start="z.key">
        <span class="betrieb-start">
          <span class="class-badge sm" :style="{ background: z.farbe || 'var(--muted)' }">{{ z.klasse || '?' }}</span>
          <b>{{ z.startNr }}</b>
          <span v-if="z.name">{{ z.name }}</span>
          <span class="note">{{ z.was }}</span>
          <span v-if="ohne" class="note" data-teil="ausfall-abgemeldet">{{ t('betrieb.ausfall.abgemeldet') }}</span>
        </span>
        <span class="betrieb-zeilen-knoepfe">
          <button type="button" class="btn sm" data-action="ausfall-waehlen" :disabled="gesperrt || ohne" @click="frage = { s, z }">{{ t('betrieb.ausfall.knopf') }}</button>
        </span>
      </li>
    </ol>

    <AppDialog v-if="frage && frage.s.paar" :titel="t('betrieb.ausfall.frage', { nr: frage.z.startNr, lauf: laufText(frage.s) })" data-dialog="ausfall" @abbrechen="frage = null">
      <!-- Parallelslalom (R13-02): jedes Mal die Wahl der Boote, keine vorgewählt – der Knopf ist die Bestätigung. -->
      <p>{{ t('betrieb.ausfall.paar.text', { lauf: laufText(frage.s) }) }}</p>
      <p v-for="x in seitenVon(frage).filter((y) => y.nicht)" :key="x.seite" class="note" data-teil="ausfall-abgemeldet" :data-seite="x.seite">
        {{ x.z.startNr }} ({{ x.z.titel }}): {{ t('betrieb.ausfall.abgemeldet') }}
      </p>
      <template #knoepfe>
        <button
          v-for="x in seitenVon(frage)"
          :key="x.seite"
          type="button"
          class="btn danger"
          data-action="ausfall-seite"
          :data-seite="x.seite"
          :disabled="x.nicht"
          @click="ja(x.seite)"
        >
          {{ seitenVon(frage).length > 1 ? t('betrieb.ausfall.nur', { nr: x.z.startNr, rc: x.z.titel }) : t('betrieb.ausfall.einer', { nr: x.z.startNr, rc: x.z.titel }) }}
        </button>
        <button v-if="seitenVon(frage).length > 1" type="button" class="btn danger" data-action="ausfall-beide" :disabled="seitenVon(frage).some((y) => y.nicht)" @click="ja()">
          {{ t('betrieb.ausfall.beide') }}
        </button>
        <button type="button" class="btn" data-action="ausfall-nein" autofocus @click="frage = null">{{ t('common.cancel') }}</button>
      </template>
    </AppDialog>
    <AppDialog v-else-if="frage" :titel="t('betrieb.ausfall.frage', { nr: frage.z.startNr, lauf: laufText(frage.s) })" data-dialog="ausfall" @abbrechen="frage = null">
      <p>{{ t('betrieb.ausfall.text', { nr: frage.z.startNr, lauf: laufText(frage.s) }) }}</p>
      <p v-if="vorstegBleibt(frage.s)" class="note" data-teil="ausfall-vorsteg">{{ t('betrieb.ausfall.vorsteg') }}</p>
      <template #knoepfe>
        <button type="button" class="btn danger" data-action="ausfall-ja" @click="ja()">{{ t('betrieb.ausfall.ja') }}</button>
        <button type="button" class="btn" data-action="ausfall-nein" autofocus @click="frage = null">{{ t('common.cancel') }}</button>
      </template>
    </AppDialog>
  </div>
</template>
