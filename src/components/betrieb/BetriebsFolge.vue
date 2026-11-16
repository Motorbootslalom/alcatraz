<script setup lang="ts">
import { computed, nextTick, onMounted, ref, type ComponentPublicInstance } from 'vue'
import type { OeffentlicheSicht, PunktId, SichtBereich, SichtPunkt, SichtStart, VerschiebeZiel } from '../../types'
import type { BetriebAenderung } from '../../state/reducer/betrieb'
import { t } from '../../i18n'
import { punktText, punktVon, startZeile, type StartZeile } from './texte'

/**
 * „Anderen Starter wählen“: die Folge eines Bereichs an der Start-Freigabe (B-5, S-4, S-6). Zuerst die nächsten
 * zwölf offenen Starts, auf Wunsch die ganze Folge; die Suche nach Startnummer oder Name findet jeden offenen,
 * zurückgestellten, nachzuholenden und „Boot fehlt“-Start, auch aus nicht begonnenen Läufen (gekennzeichnet).
 *
 * Je Start:
 * - „Zeigen“ holt ihn sofort auf die Anzeigetafel (BETRIEB_ZEIGEN mit `vorher`; danach schließt die Wahl);
 * - „Zurückstellen“ (B-3);
 * - „Verschieben …“: ein Menüknopf, der darunter die Ziele als Knöpfe aufklappt – vorziehen, ans Ende des
 *   Laufs, vor/nach Lauf n (BETRIEB_VERSCHIEBEN; mit „Verzahnung beim Verschieben halten“ rutscht die Spur im
 *   Lauf mit, V-7). Kein <select>: Dessen change feuert in Chromium schon bei einer Pfeiltaste auf dem
 *   zugeklappten Feld – ein Druck auf ↓ hätte sofort verschoben (Prüfung E2, 16.11.2026);
 * - zurückgestellte und nachzuholende: „Als Nächster“, „Ans Ende des Laufs“ (BETRIEB_EINREIHEN).
 * Mit der Eingabetaste im Suchfeld wird gezeigt, wenn alle Treffer zu EINEM Starter gehören (eine volle
 * Startnummer findet ihn in jedem Lauf): sein frühester Start, der nicht auf seinen Lauf wartet – am Laptop der
 * schnellste Weg. Passt die Nummer genau, zählen nur ihre Treffer (Suche „10“ neben 101, 102 …).
 *
 * Gezogen wird hier nicht (das kommt mit der Startliste, E3): Ein Menü ist am Steg der sicherere Griff
 * (BETRIEB_ANNAHMEN.knoepfeStattZiehen). Nichts davon ist unumkehrbar – ohne Rückfrage. Liest nur die
 * öffentliche Sicht, schickt Actions über `sende`.
 */
const props = defineProps<{
  sicht: OeffentlicheSicht
  bereich: SichtBereich
  sende: (action: BetriebAenderung) => void
  gesperrt?: boolean
}>()
/** Die Wahl schließt sich: nach „Zeigen“ (`gezeigt`) oder mit Escape (`geschlossen`) – die Start-Freigabe setzt danach den Fokus. */
const emit = defineEmits<{ fertig: [grund: 'gezeigt' | 'geschlossen'] }>()

/** So viele Starts zeigt die Wahl zuerst – mehr braucht es am Steg selten, der Rest über die Suche. */
const NAECHSTE = 12

type Art = 'offen' | 'zurueckgestellt' | 'bootFehlt' | 'nachzuholen'
interface Zeile extends StartZeile {
  s: SichtStart
  art: Art
  /** Sein Punkt ist nicht begonnen: Er wartet, bis der Lauf beginnt (S-9) – gezielt zeigen geht trotzdem. */
  wartet: SichtPunkt | null
}

const b = computed(() => props.bereich)
const suche = ref('')
const ganz = ref(false)
const sucheFeld = ref<HTMLInputElement | null>(null)
// Wer „Anderen Starter wählen“ drückt, will meist eine Nummer tippen.
onMounted(() => sucheFeld.value?.focus())

const begonnen = computed(() => new Set(b.value.begonnen))
function zeile(s: SichtStart, art: Art): Zeile {
  return { ...startZeile(props.sicht, s), s, art, wartet: begonnen.value.has(s.punkt) ? null : punktVon(b.value, s.punkt) }
}
const offene = computed(() => b.value.waehlbar.map((s) => zeile(s, 'offen')))

/** Rang eines Punkts im Programm (unbekannt: hinten). */
const rang = (p: PunktId) => {
  const i = b.value.programm.findIndex((x) => x.id === p)
  return i < 0 ? Number.MAX_SAFE_INTEGER : i
}

/**
 * Die ganze Folge: die offenen Starts in ihrer Folge, „Boot fehlt“ jeweils hinter dem letzten Start ihres
 * Punkts (V-5, L-7: am Ende des Laufs, gekennzeichnet) – hat der Punkt keinen offenen mehr, vor dem nächsten.
 */
const ganzeFolge = computed(() => {
  const out = [...offene.value]
  const fehlt = b.value.bootFehlt.map((s) => zeile(s, 'bootFehlt'))
  for (const punkt of new Set(fehlt.map((z) => z.s.punkt))) {
    let at = -1
    out.forEach((z, i) => {
      if (z.s.punkt === punkt) at = i + 1
    })
    if (at < 0) at = out.findIndex((z) => rang(z.s.punkt) > rang(punkt))
    if (at < 0) at = out.length
    out.splice(at, 0, ...fehlt.filter((z) => z.s.punkt === punkt))
  }
  return out
})

const klein = (x: string) => x.toLowerCase().replace(/\s+/g, '')
/** Treffer der Suche über alles, was sich noch zeigen lässt; `null` ohne Suchtext. */
const treffer = computed<Zeile[] | null>(() => {
  const q = klein(suche.value)
  if (!q) return null
  const alle = [
    ...ganzeFolge.value,
    ...b.value.zurueckgestellt.map((s) => zeile(s, 'zurueckgestellt')),
    ...b.value.nachzuholen.map((s) => zeile(s, 'nachzuholen')),
  ]
  return alle.filter((z) => klein(z.startNr).includes(q) || klein(z.name).includes(q))
})

const zeilen = computed(() => treffer.value ?? (ganz.value ? ganzeFolge.value : offene.value.slice(0, NAECHSTE)))
const mehr = computed(() => ganzeFolge.value.length > NAECHSTE)

const vorher = computed(() => b.value.aktuell?.key ?? null)
function zeige(z: Zeile) {
  props.sende({ type: 'BETRIEB_ZEIGEN', bereich: b.value.id, ref: z.key, vorher: vorher.value })
  suche.value = ''
  emit('fertig', 'gezeigt')
}
/**
 * Eingabetaste: Gehören alle Treffer zu einem Starter (passt die Nummer genau, nur deren Treffer), sein frühester
 * Start, der nicht auf seinen Lauf wartet – sonst sein erster. Mehrere Starter: nichts, das wäre geraten.
 */
const enterZiel = computed<Zeile | null>(() => {
  const alle = treffer.value
  if (!alle?.length) return null
  const q = klein(suche.value)
  const genau = alle.filter((z) => klein(z.startNr) === q)
  const kandidaten = genau.length > 0 ? genau : alle
  if (new Set(kandidaten.map((z) => z.s.starter)).size !== 1) return null
  const frei = kandidaten.filter((z) => !z.wartet).sort((a, b) => a.s.lauf - b.s.lauf)
  return frei[0] ?? kandidaten[0]
})
function zeigeTreffer() {
  if (enterZiel.value && !props.gesperrt) zeige(enterZiel.value)
}
/** Escape: erst ein offenes Menü schließen, dann die Suche leeren, dann die Wahl schließen. */
function abbrechen() {
  if (menue.value !== null) schliesseMenue()
  else if (suche.value) suche.value = ''
  else emit('fertig', 'geschlossen')
}
function zurueckstellen(z: Zeile) {
  props.sende({ type: 'BETRIEB_ZURUECKSTELLEN', bereich: b.value.id, ref: z.key })
}
function einreihen(z: Zeile, wo: 'naechster' | 'ende') {
  props.sende({ type: 'BETRIEB_EINREIHEN', bereich: b.value.id, ref: z.key, wo })
}

/** Wohin „Vorziehen“ zielt: vor den Nächsten – gibt es keinen freigegebenen, vor den ersten offenen. */
const vorne = computed(() => b.value.offen[0]?.key ?? b.value.waehlbar[0]?.key ?? null)
/** Lauf-Grenzen als Ziel: andere Punkte, in denen noch etwas offen ist (vor/nach einem vorbeigegangenen Lauf hieße nur „hinter den Zeiger“). */
const grenzen = (z: Zeile) => (b.value.programm.length > 1 ? b.value.programm.filter((p) => p.id !== z.s.punkt && b.value.waehlbar.some((s) => s.punkt === p.id)) : [])

// --- Menü „Verschieben …“ ---
/** Für welchen Start das Menü offen ist (höchstens eines). */
const menue = ref<string | null>(null)
/** Die Menüknöpfe je Start – nach einem Befehl kehrt der Fokus dorthin zurück (die Zeile bleibt, ihre Ziele nicht). */
const menueKnoepfe = new Map<string, HTMLElement>()
function merkeKnopf(key: string, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement) menueKnoepfe.set(key, el)
  else menueKnoepfe.delete(key)
}
async function schliesseMenue() {
  const key = menue.value
  menue.value = null
  await nextTick()
  // Steht der Start nach dem Verschieben nicht mehr unter den gezeigten (etwa ans Ende des Laufs), ins Suchfeld.
  ;(key !== null ? (menueKnoepfe.get(key) ?? sucheFeld.value) : sucheFeld.value)?.focus()
}
function verschiebe(z: Zeile, ziel: VerschiebeZiel) {
  props.sende({ type: 'BETRIEB_VERSCHIEBEN', bereich: b.value.id, ref: z.key, ziel })
  void schliesseMenue()
}

function vermerk(z: Zeile): string {
  if (z.art !== 'offen') return t(`betrieb.status.${z.art}`)
  return z.wartet ? t('betrieb.folge.wartet', { punkt: punktText(z.wartet) }) : ''
}
</script>

<template>
  <div class="betrieb-folge" data-teil="folge">
    <div class="row betrieb-folge-kopf">
      <input
        ref="sucheFeld"
        v-model="suche"
        class="input"
        type="search"
        data-feld="suche"
        :placeholder="t('betrieb.folge.suche')"
        :aria-label="t('betrieb.folge.suche')"
        @keydown.enter.prevent="zeigeTreffer"
        @keydown.esc="abbrechen"
      />
      <button v-if="mehr && !treffer" type="button" class="btn sm" data-action="folge-ganz" :aria-pressed="ganz" @click="ganz = !ganz">
        {{ ganz ? t('betrieb.folge.naechste', { n: NAECHSTE }) : t('betrieb.folge.ganz', { n: ganzeFolge.length }) }}
      </button>
    </div>
    <p class="note">{{ t('betrieb.folge.hint') }}</p>

    <p v-if="zeilen.length === 0" class="note" data-teil="folge-leer">{{ treffer ? t('betrieb.folge.keine') : t('betrieb.folge.leer') }}</p>
    <ol v-else class="betrieb-folge-liste" @keydown.esc="abbrechen">
      <li
        v-for="z in zeilen"
        :key="z.key"
        :data-start="z.key"
        :data-art="z.art"
        :class="{ wartet: z.wartet, aus: z.art === 'bootFehlt', 'enter-ziel': enterZiel?.key === z.key }"
      >
        <span class="betrieb-start">
          <span class="class-badge sm" :style="{ background: z.art === 'bootFehlt' || !z.farbe ? 'var(--muted)' : z.farbe }">{{ z.klasse || '?' }}</span>
          <b>{{ z.startNr }}</b>
          <span v-if="z.name">{{ z.name }}</span>
          <span class="note">{{ z.was }}</span>
          <span v-if="vermerk(z)" :class="['betrieb-aktiv', z.art === 'offen' ? '' : 'stoerung']" data-teil="vermerk">{{ vermerk(z) }}</span>
        </span>
        <span class="betrieb-zeilen-knoepfe">
          <button type="button" class="btn sm primary" data-action="folge-zeigen" :disabled="gesperrt" @click="zeige(z)">{{ t('betrieb.folge.zeigen') }}</button>
          <template v-if="z.art === 'offen'">
            <button type="button" class="btn sm" data-action="folge-zurueckstellen" :disabled="gesperrt" @click="zurueckstellen(z)">{{ t('betrieb.zurueckstellen') }}</button>
            <button
              :ref="(el) => merkeKnopf(z.key, el)"
              type="button"
              :class="['btn', 'sm', menue === z.key ? 'active' : '']"
              data-action="verschieben"
              aria-haspopup="true"
              :aria-expanded="menue === z.key"
              :disabled="gesperrt"
              @click="menue = menue === z.key ? null : z.key"
            >
              {{ t('betrieb.folge.verschieben') }}
            </button>
          </template>
          <template v-else-if="z.art !== 'bootFehlt'">
            <button type="button" class="btn sm" data-action="einreihen-naechster" :disabled="gesperrt" @click="einreihen(z, 'naechster')">{{ t('betrieb.einreihen.naechster') }}</button>
            <button type="button" class="btn sm" data-action="einreihen-ende" :disabled="gesperrt" @click="einreihen(z, 'ende')">{{ t('betrieb.einreihen.ende') }}</button>
          </template>
        </span>
        <!-- Die Ziele als Knöpfe: Erst ein Klick (oder Enter/Leertaste auf einem Knopf) verschiebt. -->
        <span v-if="menue === z.key && !gesperrt" class="betrieb-menue" role="group" :aria-label="t('betrieb.folge.verschieben')" data-teil="verschieben">
          <button v-if="vorne && vorne !== z.key" type="button" class="btn sm" data-ziel="vorne" @click="verschiebe(z, { vor: vorne })">{{ t('betrieb.folge.vorziehen') }}</button>
          <button type="button" class="btn sm" data-ziel="ende" @click="verschiebe(z, { nachPunkt: z.s.punkt })">{{ t('betrieb.einreihen.ende') }}</button>
          <template v-for="p in grenzen(z)" :key="p.id">
            <button type="button" class="btn sm" :data-ziel="`vor|${p.id}`" @click="verschiebe(z, { vorPunkt: p.id })">{{ t('betrieb.folge.vorPunkt', { punkt: punktText(p) }) }}</button>
            <button type="button" class="btn sm" :data-ziel="`nach|${p.id}`" @click="verschiebe(z, { nachPunkt: p.id })">{{ t('betrieb.folge.nachPunkt', { punkt: punktText(p) }) }}</button>
          </template>
        </span>
      </li>
    </ol>
  </div>
</template>
