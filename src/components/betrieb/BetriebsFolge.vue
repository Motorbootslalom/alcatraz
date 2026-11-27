<script setup lang="ts">
import { computed, nextTick, onMounted, ref, type ComponentPublicInstance } from 'vue'
import type { OeffentlicheSicht, SichtBereich, SichtPunkt, SichtStart, VerschiebeZiel } from '../../types'
import type { BetriebAenderung } from '../../state/reducer/betrieb'
import { t } from '../../i18n'
import { ganzeFolge as folgeMitBootFehlt, punktText, punktVon, startZeile, tBereich, verschiebeZiele, type StartZeile } from './texte'

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
 * Parallelslalom (E4): Die Suche findet ein Paar über beide Startnummern und Namen; „Verschieben …“ gibt es dort nicht
 * (BETRIEB_ANNAHMEN.parallelOhneUmstellen), Zurückstellen nimmt das ganze Paar.
 *
 * Gezogen wird hier nicht – das geht in der Startliste (components/betrieb/StartListe.vue, E3): An der Start-Freigabe
 * ist ein Menü der sicherere Griff (BETRIEB_ANNAHMEN.knoepfeStattZiehen). Die Ziele des Menüs und die ganze Folge
 * teilt sie mit der Startliste (texte.ts verschiebeZiele, ganzeFolge). Nichts davon ist unumkehrbar – ohne Rückfrage.
 * Liest nur die öffentliche Sicht, schickt Actions über `sende`.
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

type Art = 'offen' | 'zurueckgestellt' | 'bootFehlt' | 'nachzuholen' | 'wiederholung'
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

/** Die ganze Folge: die offenen Starts, „Boot fehlt“ am Ende ihres Punkts (texte.ts `ganzeFolge`, wie die Startliste). */
const ganzeFolge = computed(() => folgeMitBootFehlt(b.value).map((f) => zeile(f.s, f.art)))

const klein = (x: string) => x.toLowerCase().replace(/\s+/g, '')
/** Treffer der Suche über alles, was sich noch zeigen lässt; `null` ohne Suchtext. */
const treffer = computed<Zeile[] | null>(() => {
  const q = klein(suche.value)
  if (!q) return null
  const alle = [
    ...ganzeFolge.value,
    ...b.value.zurueckgestellt.map((s) => zeile(s, 'zurueckgestellt')),
    // Wiederholung offen (R11-11, 26.11.2026): auch über die Suche einzureihen oder zu zeigen.
    ...b.value.wiederholung.map((s) => zeile(s, 'wiederholung')),
    ...b.value.nachzuholen.map((s) => zeile(s, 'nachzuholen')),
  ]
  return alle.filter((z) => z.nummern.some((n) => klein(n).includes(q)) || klein(z.startNr).includes(q) || klein(z.name).includes(q))
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
  const genau = alle.filter((z) => z.nummern.some((n) => klein(n) === q))
  const kandidaten = genau.length > 0 ? genau : alle
  // Ein Starter, der in allen Treffern fährt – im Manövrieren genau einer je Start, im Parallelslalom einer der beiden Seiten.
  const gemeinsam = kandidaten.reduce<string[]>((ids, z, i) => (i === 0 ? [...z.ids] : ids.filter((id) => z.ids.includes(id))), [])
  if (gemeinsam.length === 0) return null
  // Im Manövrieren der früheste Lauf; ein Paar steht schon in seiner Folge (Runden, Attempts).
  const frei = kandidaten.filter((z) => !z.wartet).sort((a, b) => (a.s.paar ? 0 : a.s.lauf - b.s.lauf))
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
              v-if="b.art !== 'parallel'"
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
            <button type="button" class="btn sm" data-action="einreihen-ende" :disabled="gesperrt" @click="einreihen(z, 'ende')">{{ tBereich(b, 'betrieb.einreihen.ende') }}</button>
          </template>
        </span>
        <!-- Die Ziele als Knöpfe: Erst ein Klick (oder Enter/Leertaste auf einem Knopf) verschiebt. -->
        <span v-if="menue === z.key && !gesperrt" class="betrieb-menue" role="group" :aria-label="t('betrieb.folge.verschieben')" data-teil="verschieben">
          <!-- Vorziehen, ans Ende des Laufs, vor/nach Lauf n (texte.ts verschiebeZiele, wie in der Startliste). -->
          <button v-for="w in verschiebeZiele(b, z.s)" :key="w.id" type="button" class="btn sm" :data-ziel="w.id" @click="verschiebe(z, w.ziel)">{{ w.text }}</button>
        </span>
      </li>
    </ol>
  </div>
</template>
