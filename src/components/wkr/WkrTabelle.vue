<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'
import type { ListenTeil } from '../../wkr/liste'
import type { Entwurf, MaskenAufbau } from '../../wkr/maske'
import { eingabenAus, kopfGruppen, zeileAusEingaben, type TabellenFehler, type TabellenSpalte } from '../../wkr/tabelle'
import { stufeZeichen, useWkrText, type TabellenGesendet } from './texte'

/**
 * Maske „Tabelle“ für Geübte (W5.5, Plan docs/plan-wkr-w5.md §8, 22.11.2026, WKR_ANNAHMEN TB1–TB5) – nur auf Pad und
 * Rechner (TB1), nie Vorgabe (MW1). Die Zeile des Bogens der Klasse zum Eintippen mit echter Tastatur:
 *
 * - Zeilen (TB5): die letzten gesendeten eigenen Zeilen mit ✓/↑/!/✗ wie „Zuletzt“, die aktive Zeile, die nächsten Starts.
 * - Eingabe (TB3/TB4): Codes als Text („2x6, 20“), Bojen als Punkte bzw. „5, J“ (mehrere Buchstaben, R7-14), Zeit wie am Rechner; jede Zelle geht
 *   durch wkr/tabelle.ts (dieselben Sanierer wie ErfassungTabelle). Fehler je Zelle (`data-fehler` = Code) erst, wenn die
 *   Zelle verlassen wurde – beim Tippen von „2x“ stünde sonst schon einer. Beim Verlassen zeigt die Zelle den Wert so,
 *   wie er hinausgeht („6 6 20“ → „2x6, 20“).
 * - Tasten wie die Erfassung am Rechner (TB3): Tab/Umschalt+Tab nativ, Enter = nächste Zelle, Enter in der letzten Zelle
 *   = Abschicken (`abschicken` → WkrMaske haupt: Sperre, Overlay, Takt wie gehabt; in der Korrektur die Rückfrage alt →
 *   neu), ←/→ am Rand der Eingabe in die Nachbarzelle, Esc bricht eine Korrektur ab.
 * - Jede Änderung geht als Entwurf hinauf (`entwurf`) – WkrMaske merkt ihn (merkeEntwurf) und schickt über zellenAus,
 *   derselbe Weg wie die Knöpfe; `fehler` meldet die Zahl der Zellen mit Fehler (sperrt den Hauptknopf).
 * - Korrektur (TB5): „Korrigieren“ an einer gesendeten Zeile → `korrigiere` (WkrMaske oeffneKorrektur, wie „Zuletzt“);
 *   die Zeile wird dann an ihrem Platz bearbeitbar.
 *
 * `:key` je Start und Korrektur kommt von WkrMitte – eine neue Zeile beginnt mit frischen Eingaben und Fokus, außer der
 * Fokus steht gerade in einer anderen Spalte des Pads (darfFokus, Prüfbefund 22.11.2026).
 */

const props = defineProps<{
  spalten: TabellenSpalte[]
  aufbau: MaskenAufbau
  entwurf: Entwurf
  teil?: ListenTeil
  startNr: string
  klasse: string
  gesperrt: boolean
  gesendet: TabellenGesendet[]
  /** Nummer der gesendeten Zeile, die gerade korrigiert wird (`z`), sonst `null`. */
  korrektur: number | null
  naechste: { key: string; startNr: string; klasse: string }[]
}>()
const emit = defineEmits<{ entwurf: [e: Entwurf]; fehler: [n: number]; abschicken: []; korrigiere: [z: number]; abbrechen: [] }>()
const { w, wn } = useWkrText()

const gruppen = computed(() => kopfGruppen(props.spalten))
const zweiZeilen = computed(() => props.spalten.some((s) => s.unter !== ''))

// --- Eingaben der aktiven Zeile ---
const eingaben = ref<Record<string, string>>(eingabenAus(props.spalten, props.entwurf, props.aufbau, props.teil))
/** Der Entwurf, den die Tabelle zuletzt selbst hinaufgab – ein anderer kam von außen („zurück“, Bemerkung unter „Mehr“). */
const eigener = shallowRef<Entwurf | null>(null)
watch(
  () => props.entwurf,
  (e) => {
    if (e !== eigener.value) eingaben.value = eingabenAus(props.spalten, e, props.aufbau, props.teil)
  },
)
const zeile = computed(() => zeileAusEingaben(props.spalten, eingaben.value, props.aufbau, props.teil, props.entwurf.keineZeit))
const fehlerZahl = computed(() => Object.keys(zeile.value.fehler).length)
watch(fehlerZahl, (n) => emit('fehler', n), { immediate: true })

/** Zellen, die schon verlassen wurden – nur dort zeigt die Tabelle den Fehler. */
const beruehrt = ref<ReadonlySet<string>>(new Set())
const fehlerVon = (feld: string): TabellenFehler | null => (beruehrt.value.has(feld) ? (zeile.value.fehler[feld] ?? null) : null)
function fehlerText(feld: string): string {
  const f = fehlerVon(feld)
  return f ? w(`wkr.geraet.tabelle.fehler.${f}`) : ''
}

function tippe(feld: string, wert: string): void {
  if (props.gesperrt) return
  eingaben.value = { ...eingaben.value, [feld]: wert }
  const e = zeile.value.entwurf
  eigener.value = e
  emit('entwurf', e)
}
/** Beim Verlassen: Fehler zeigen und – ohne Fehler – den Wert so, wie er hinausgeht. */
function verlasse(feld: string): void {
  beruehrt.value = new Set([...beruehrt.value, feld])
  const wert = zeile.value.zellen[feld] ?? ''
  if (!zeile.value.fehler[feld] && wert !== (eingaben.value[feld] ?? '') && !(props.spalten.find((s) => s.feld === feld)?.art === 'zeit')) {
    eingaben.value = { ...eingaben.value, [feld]: wert }
  }
}

// --- Tasten ---
const felder: (HTMLInputElement | null)[] = []
const merkeFeld = (i: number, el: unknown) => (felder[i] = el instanceof HTMLInputElement ? el : null)
function fokus(i: number): void {
  const el = felder[i]
  if (!el) return
  el.focus()
  el.select()
}
function abschicken(): void {
  if (props.gesperrt) return
  beruehrt.value = new Set(props.spalten.map((s) => s.feld))
  const erster = props.spalten.findIndex((s) => zeile.value.fehler[s.feld])
  if (erster >= 0) {
    fokus(erster)
    return
  }
  emit('abschicken')
}
function taste(i: number, e: KeyboardEvent): void {
  const el = e.currentTarget as HTMLInputElement
  const feld = props.spalten[i].feld
  if (e.key === 'Enter') {
    e.preventDefault()
    verlasse(feld)
    if (i < props.spalten.length - 1) fokus(i + 1)
    else abschicken()
  } else if (e.key === 'Escape' && props.korrektur !== null) {
    e.preventDefault()
    emit('abbrechen')
  } else if (e.key === 'ArrowLeft' && i > 0 && (el.selectionStart ?? 0) === 0 && (el.selectionEnd ?? 0) === 0) {
    e.preventDefault()
    fokus(i - 1)
  } else if (e.key === 'ArrowRight' && i < props.spalten.length - 1 && (el.selectionStart ?? el.value.length) === el.value.length) {
    e.preventDefault()
    fokus(i + 1)
  }
}
/**
 * Fokus von selbst nur, wenn er nicht gerade in einer ANDEREN Spalte steht (Prüfbefund 22.11.2026): Auf dem Pad stehen
 * bis vier Listen nebeneinander (PD2); kommt in Spalte B ein neuer Start (eigene `:key`) oder endet dort die Sperre,
 * während der WKR in Spalte A tippt, landeten die nächsten Tasten sonst in B – mit Enter in der letzten Zelle sogar
 * als Abschicken der falschen Liste. Ohne Spalten (Handy, Übung) gilt die ganze Maske als eine Spalte.
 */
const rahmen = ref<HTMLElement | null>(null)
function darfFokus(): boolean {
  if (typeof document === 'undefined') return false
  const aktiv = document.activeElement
  if (!aktiv || aktiv === document.body || !rahmen.value) return true
  if (rahmen.value.contains(aktiv)) return true
  const eigene = rahmen.value.closest('.wkr-spalte')
  const fremde = aktiv.closest('.wkr-spalte')
  return !fremde || fremde === eigene
}
function fokusVonSelbst(): void {
  if (darfFokus()) fokus(0)
}
onMounted(() => {
  if (!props.gesperrt) void nextTick(fokusVonSelbst)
})
// Nach der Sperrsekunde (Takt, Attempt-Wechsel) steht der Fokus wieder in der ersten Zelle – die Hände bleiben auf der Tastatur.
watch(
  () => props.gesperrt,
  (g, vorher) => {
    if (!g && vorher) void nextTick(fokusVonSelbst)
  },
)

// --- Zeilen (TB5): gesendet, aktiv (in der Korrektur an ihrem Platz), nächste ---
type Zeile = { art: 'gesendet'; g: TabellenGesendet } | { art: 'aktiv' } | { art: 'naechste'; n: { key: string; startNr: string; klasse: string } }
const zeilen = computed<Zeile[]>(() => {
  const out: Zeile[] = props.gesendet.map((g) => (g.z === props.korrektur ? { art: 'aktiv' } : { art: 'gesendet', g }))
  if (!out.some((r) => r.art === 'aktiv')) out.push({ art: 'aktiv' })
  for (const n of props.naechste) out.push({ art: 'naechste', n })
  return out
})
function gesendetWert(g: TabellenGesendet, feld: string): string {
  if (g.kz?.[feld] && !g.zellen[feld]) return w('wkr.geraet.keineZeit.kurz')
  return g.zellen[feld] ?? ''
}
const kopfLabel = (s: TabellenSpalte) => [s.titel, s.unter].filter(Boolean).join(' ')
</script>

<template>
  <div ref="rahmen" class="wkr-tabelle-rahmen" data-teil="tabelle" :data-korrektur="korrektur ?? undefined" :data-fehler="fehlerZahl || undefined">
    <table class="wkr-tabelle-blatt">
      <thead>
        <tr>
          <th class="wkr-tabelle-nr" scope="col" :rowspan="zweiZeilen ? 2 : 1">{{ w('wkr.geraet.tabelle.nr') }}</th>
          <th
            v-for="(g, i) in gruppen"
            :key="`${g.titel}-${i}`"
            scope="col"
            :colspan="g.breite"
            :rowspan="zweiZeilen && !g.mitUnter ? 2 : 1"
            data-teil="tabelle-kopf"
          >
            {{ g.titel }}
          </th>
          <th class="wkr-tabelle-stand" scope="col" :rowspan="zweiZeilen ? 2 : 1"><span class="wkr-grau-text">{{ w('wkr.geraet.tabelle.stand') }}</span></th>
        </tr>
        <tr v-if="zweiZeilen">
          <th v-for="s in spalten.filter((x) => x.unter !== '')" :key="s.feld" scope="col" class="wkr-tabelle-unter" data-teil="tabelle-unter">{{ s.unter }}</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="r in zeilen" :key="r.art === 'gesendet' ? r.g.z : r.art === 'naechste' ? r.n.key : 'aktiv'">
          <tr v-if="r.art === 'gesendet'" class="wkr-tabelle-zeile wkr-tabelle-zeile--gesendet" data-teil="tabelle-gesendet" :data-z="r.g.z" :data-stufe="r.g.stufe.stufe">
            <th scope="row" class="wkr-tabelle-nr">{{ r.g.sn }}</th>
            <!-- „Nicht gestartet“ (24.11.2026, NG1) steht wie jede Zeile in ihren Spalten: X unter „Disq.“. -->
            <td v-for="s in spalten" :key="s.feld" class="wkr-tabelle-zelle" :data-feld="s.feld">{{ gesendetWert(r.g, s.feld) }}</td>
            <td class="wkr-tabelle-stand">
              <span class="wkr-tabelle-zeichen" data-teil="tabelle-zeichen" aria-hidden="true">{{ stufeZeichen(r.g.stufe) }}</span>
              <button
                type="button"
                class="wkr-knopf wkr-tabelle-korrigieren"
                data-ziel="klein"
                data-action="tabelle-korrigieren"
                :disabled="gesperrt || korrektur !== null"
                @click="emit('korrigiere', r.g.z)"
              >
                {{ w('wkr.geraet.korrigieren') }}
              </button>
            </td>
          </tr>
          <tr
            v-else-if="r.art === 'aktiv'"
            class="wkr-tabelle-zeile wkr-tabelle-zeile--aktiv"
            :class="{ 'wkr-tabelle-zeile--korrektur': korrektur !== null }"
            data-teil="tabelle-aktiv"
            :data-z="korrektur ?? undefined"
          >
            <th scope="row" class="wkr-tabelle-nr">
              {{ startNr }}<span class="wkr-tabelle-klasse">{{ klasse }}</span>
            </th>
            <td v-for="(s, i) in spalten" :key="s.feld" class="wkr-tabelle-zelle" :data-feld="s.feld" :data-fehler="fehlerVon(s.feld) ?? undefined">
              <input
                :ref="(el) => merkeFeld(i, el)"
                class="wkr-tabelle-eingabe"
                type="text"
                :value="eingaben[s.feld] ?? ''"
                :aria-label="`${startNr} – ${kopfLabel(s)}`"
                :aria-invalid="fehlerVon(s.feld) ? 'true' : undefined"
                :placeholder="entwurf.keineZeit[s.feld] && s.art === 'zeit' ? w('wkr.geraet.keineZeit.kurz') : undefined"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
                :enterkeyhint="i === spalten.length - 1 ? 'send' : 'next'"
                :disabled="gesperrt"
                @input="tippe(s.feld, ($event.target as HTMLInputElement).value)"
                @blur="verlasse(s.feld)"
                @keydown="taste(i, $event)"
              />
              <span v-if="fehlerVon(s.feld)" class="wkr-tabelle-fehler" data-teil="tabelle-fehler" role="alert">{{ fehlerText(s.feld) }}</span>
            </td>
            <td class="wkr-tabelle-stand"><span class="wkr-tabelle-zeichen" aria-hidden="true">{{ korrektur !== null ? '✎' : '▸' }}</span></td>
          </tr>
          <tr v-else class="wkr-tabelle-zeile wkr-tabelle-zeile--naechste" data-teil="tabelle-naechste" :data-start="r.n.key">
            <th scope="row" class="wkr-tabelle-nr">
              {{ r.n.startNr }}<span class="wkr-tabelle-klasse">{{ r.n.klasse }}</span>
            </th>
            <td v-for="s in spalten" :key="s.feld" class="wkr-tabelle-zelle" />
            <td class="wkr-tabelle-stand" />
          </tr>
        </template>
      </tbody>
    </table>
    <p class="wkr-hinweis" data-teil="tabelle-tasten">
      {{ korrektur !== null ? w('wkr.geraet.tabelle.tastenKorrektur') : w('wkr.geraet.tabelle.tasten') }}
      <b v-if="fehlerZahl > 0" class="wkr-tabelle-fehlerzahl" data-teil="tabelle-fehlerzahl">{{ wn('wkr.geraet.tabelle.fehlerZahl', fehlerZahl) }}</b>
    </p>
  </div>
</template>
