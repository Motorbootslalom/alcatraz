<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SichtBereich, WkrPunkt, WkrModus, WkrStatus } from '../../types'
import { useStore } from '../../state/store'
import { useGeraeteHost } from '../../geraete/host'
import { liesRef } from '../../betrieb/folge'
import type { ListenLage, ListenAbschluss, MatrixStart } from '../../wkr/lage'
import type { ListenTeil } from '../../lib/eingaben'
import { t } from '../../i18n'
import AppDialog from '../AppDialog.vue'
import { punktText, punktVon, uhrzeitText } from './texte'
import { liesListe } from '../../wkr/liste'
import { einteilungsName, einteilungsParcours } from '../../wkr/sicht'

/**
 * Bedienung einer Liste unter Betrieb → WKR (W2.2, Plan docs/plan-wkr-w2.md §6.1, 21.11.2026): Modus als drei
 * Knöpfe (F1: digital, Papier, beides – immer wählbar), Pausieren/Abmelden/Weiter (am Steg auch je Teil, F16),
 * „Papier ab Start …“ als Auswahl + eigener Knopf (nie `change` eines `<select>`), Hinweis „Bitte Nr. prüfen“ an die
 * Geräte, die Abschlüsse mit Name, Zeit, abweichenden und vom Papier gekommenen Starts und „Abschluss lösen“ hinter
 * einer Rückfrage. Actions über den Store (WKR_LISTE, WKR_PAPIER_AB, WKR_ABSCHLUSS_LOESEN); Hinweise an die Geräte
 * über den Host (`hinweis`) – ohne Host bleibt nur der Stand, die Geräte erfahren es dann aus der Sicht der Liste.
 *
 * Nutzer 21.11.2026 (W3-13, WKR_ANNAHMEN WN2): oben der Name des Wettkampfrichters laut Einteilung (`wkr-name`) und je
 * Gerät der Liste, dessen WKR ihn geändert hat, nur der Hinweis „Name auf dem Gerät: … – Einteilung: …“ mit „In
 * Veranstaltung übernehmen“ (SET_WKR_NAME) – wie in der Geräteliste (GeraeteListe.vue). Die Namen der Geräte liegen im
 * Register (gerätelokal), nie im AppState.
 */
/**
 * W5.3 (22.11.2026): Die Liste am Tisch (Knoten, ohne Lauf) hat keinen Bereich des Betriebs (`bereich` fehlt) und
 * keine Starts – ohne „Papier ab“; ihr Abschluss heißt „ganze Liste“ (Punkt `ohne`, KN5).
 */
const props = defineProps<{ lage: ListenLage; starts: readonly MatrixStart[]; bereich?: SichtBereich | null }>()

const { state, dispatch } = useStore()
const host = useGeraeteHost()
const l = computed(() => props.lage)

const MODI: readonly WkrModus[] = ['digital', 'papier', 'beides']
const digital = computed(() => l.value.modus === 'digital' || l.value.modus === 'beides')
const teile = computed(() => (l.value.teile ? (['ab', 'an'] as const) : []))

function modus(m: WkrModus): void {
  if (m !== l.value.modus) dispatch({ type: 'WKR_LISTE', liste: l.value.liste, modus: m })
}

function status(s: WkrStatus, teil?: ListenTeil): void {
  dispatch({ type: 'WKR_LISTE', liste: l.value.liste, status: s, ...(teil ? { teil } : {}) })
  // „Weiter digital“ sagt es auch den Geräten (sonst stünde dort noch „Papier ab …“) – am Steg nur denen des Teils
  // (F16): Das Gerät des noch abgemeldeten Teils soll nicht „weiter digital“ lesen.
  if (s === 'aktiv') host?.hinweis(l.value.liste, 'weiter-digital', undefined, teil)
}

const statusVon = (teil?: ListenTeil): WkrStatus => (teil ? (l.value.teile?.[teil]?.status ?? 'aktiv') : l.value.status)

// „Papier ab Start …“: die gezeigten Starts (nicht die Vorsteg-Vorschau), Vorgabe der zuletzt gezeigte. Die Wahl des
// Bedieners bleibt stehen, auch wenn ihr Start aus den Matrix-Spalten fällt (Prüfbefund 21.11.2026: sonst spränge sie
// beim nächsten gezeigten Start unbemerkt auf den neuesten, und „Papier ab“ meldete ab einem anderen Start ab);
// erst ein neuer Punkt räumt sie. Ungewählt folgt die Vorgabe dem zuletzt gezeigten.
const gezeigte = computed(() => props.starts.filter((s) => !s.vorab))
const papierWahl = ref<MatrixStart | null>(null)
let papierGewaehlt = false
const papierStarts = computed(() => {
  const w = papierWahl.value
  return w && !gezeigte.value.some((s) => s.key === w.key) ? [w, ...gezeigte.value] : gezeigte.value
})
const papierRef = computed({
  get: () => papierWahl.value?.key ?? '',
  set: (k: string) => {
    papierWahl.value = papierStarts.value.find((s) => s.key === k) ?? null
    papierGewaehlt = papierWahl.value !== null
  },
})
const papierTeil = ref<'' | ListenTeil>('')
watch(gezeigte, (g) => {
  const w = papierWahl.value
  const neuerPunkt = w !== null && g.length > 0 && g.every((s) => s.punkt !== w.punkt)
  if (!papierGewaehlt || neuerPunkt || w === null) {
    papierWahl.value = g.at(-1) ?? null
    papierGewaehlt = false
  }
}, { immediate: true })

/**
 * Die Startnummer des Starts auf DIESER Liste (Prüfbefund 21.11.2026): im Parallelslalom die eigene Seite (Racecourse
 * A bzw. B, wie wkr/liste.ts startAufListe) – `nummern` sind die besetzten Seiten, [0] wäre bei B die Nummer von A.
 * Leere eigene Seite: keine Nummer.
 */
function eigeneNummer(s: MatrixStart): string | undefined {
  const ref = liesRef(s.key)
  if (!ref) return undefined
  const id = ref.art === 'm' ? ref.starter : l.value.racecourse === 'B' ? ref.b : ref.a
  return (id !== null && state.value.starters.find((x) => x.id === id)?.startNr) || undefined
}

function papierAb(): void {
  const s = papierStarts.value.find((x) => x.key === papierRef.value)
  if (!s) return
  const teil = papierTeil.value || undefined
  dispatch({ type: 'WKR_PAPIER_AB', liste: l.value.liste, ref: s.key, ...(teil ? { teil } : {}) })
  // Am Steg mit Teil nur an die Geräte dieses Teils (F16).
  host?.hinweis(l.value.liste, 'papier', eigeneNummer(s), teil)
  papierGewaehlt = false
}

/** Hinweise gehen nur über einen offenen Raum hinaus (ohne Raum tut der Host nichts – dann nichts versprechen). */
const mitRaum = computed(() => !!host?.raum.value)
const pruefNr = ref('')
const gesendet = ref(false)
function pruefen(): void {
  const nr = pruefNr.value.trim()
  if (!nr || !host || !mitRaum.value) return
  host.hinweis(l.value.liste, 'pruefen', nr)
  gesendet.value = true
}

function abschlussText(a: ListenAbschluss): string {
  const p = a.punkt !== 'ohne' && props.bereich ? punktVon(props.bereich, a.punkt) : null
  const punkt = a.punkt === 'ohne' ? t('betrieb.wkr.punkt.ohne') : p ? punktText(p) : a.punkt
  const zeit = uhrzeitText(a.zeit)
  return a.teil ? t('betrieb.wkr.abschluss.teil', { punkt, teil: t(`betrieb.wkr.teil.${a.teil}`), name: a.name, zeit }) : t('betrieb.wkr.abschluss', { punkt, name: a.name, zeit })
}

// --- WKR-Name (W3-13) ---
const listeObj = computed(() => liesListe(l.value.liste))
const einteilung = computed(() => (listeObj.value ? einteilungsName(state.value, listeObj.value) : ''))
/** Geräte dieser Liste, deren WKR einen anderen Namen eingetragen hat (Register, aus dem Lebenszeichen). */
const abweichend = computed(() =>
  (host?.raum.value?.geraete ?? [])
    .map((g) => ({ id: g.id, geraet: g.name, name: g.wkrNamen?.[l.value.liste] ?? '' }))
    .filter((x) => x.name !== '' && x.name !== einteilung.value),
)
function uebernimmName(name: string): void {
  const liste = listeObj.value
  if (liste) dispatch({ type: 'SET_WKR_NAME', parcoursId: einteilungsParcours(liste), typeId: liste.typeId, name })
}

const loesen = ref<{ punkt: WkrPunkt; teil?: ListenTeil } | null>(null)
function loese(): void {
  const a = loesen.value
  loesen.value = null
  if (a) dispatch({ type: 'WKR_ABSCHLUSS_LOESEN', liste: l.value.liste, punkt: a.punkt, ...(a.teil ? { teil: a.teil } : {}) })
}
</script>

<template>
  <div class="wkr-bedienung" data-teil="wkr-bedienung" :data-liste="l.liste">
    <div v-if="einteilung || abweichend.length" class="row wkr-bedienung-reihe" data-teil="wkr-name">
      <span v-if="einteilung" class="wkr-bedienung-titel" data-teil="wkr-name-einteilung">{{ t('geraete.liste.wkrName', { name: einteilung }) }}</span>
      <span v-for="x in abweichend" :key="x.id" class="note wkr-name-abweichend" data-teil="wkr-name-abweichend" :data-geraet="x.id">
        {{ x.geraet }}: {{ t('geraete.liste.wkrName.abweichend', { geraet: x.name, einteilung: einteilung || t('geraete.liste.wkrName.niemand') }) }}
        <button type="button" class="btn sm" data-action="wkr-name-uebernehmen" @click="uebernimmName(x.name)">{{ t('geraete.liste.wkrName.uebernehmen') }}</button>
      </span>
    </div>
    <div class="row wkr-bedienung-reihe">
      <span class="wkr-bedienung-titel">{{ t('betrieb.wkr.modus') }}:</span>
      <div class="segmented" role="group" :aria-label="t('betrieb.wkr.modus')">
        <button
          v-for="m in MODI"
          :key="m"
          type="button"
          :data-modus="m"
          :class="(l.modus ?? 'papier') === m ? 'active' : ''"
          :aria-pressed="(l.modus ?? 'papier') === m"
          @click="modus(m)"
        >
          {{ t(`betrieb.wkr.modus.${m}`) }}
        </button>
      </div>
    </div>

    <template v-if="digital">
      <div v-for="teil in [undefined, ...teile]" :key="teil ?? 'ganz'" class="row wkr-bedienung-reihe" :data-teil-status="teil ?? 'ganz'">
        <span v-if="teil" class="wkr-bedienung-titel">{{ t(`betrieb.wkr.teil.${teil}`) }}:</span>
        <span v-if="statusVon(teil) !== 'aktiv'" class="note" data-teil="wkr-status">{{ t(statusVon(teil) === 'pausiert' ? 'betrieb.wkr.stand.pausiert' : 'betrieb.wkr.stand.abgemeldet') }}</span>
        <template v-if="statusVon(teil) === 'aktiv'">
          <button type="button" class="btn sm" data-action="wkr-pausieren" @click="status('pausiert', teil)">{{ t('betrieb.wkr.pausieren') }}</button>
          <button type="button" class="btn sm" data-action="wkr-abmelden" @click="status('abgemeldet', teil)">{{ t('betrieb.wkr.abmelden') }}</button>
        </template>
        <button v-else type="button" class="btn sm primary" data-action="wkr-weiter" :title="t('betrieb.wkr.weiter.title')" @click="status('aktiv', teil)">{{ t('betrieb.wkr.weiter') }}</button>
      </div>

      <div v-if="gezeigte.length" class="row wkr-bedienung-reihe">
        <label class="wkr-bedienung-titel">
          {{ t('betrieb.wkr.papierAb') }}
          <select v-model="papierRef" class="input sm" data-feld="wkr-papier-ab">
            <option v-for="s in papierStarts" :key="s.key" :value="s.key">{{ s.nummern.join('/') }}</option>
          </select>
        </label>
        <select v-if="teile.length" v-model="papierTeil" class="input sm" data-feld="wkr-papier-teil" :aria-label="t('betrieb.wkr.papierAb')">
          <option value="">{{ t('betrieb.wkr.spalte.liste') }}</option>
          <option v-for="teil in teile" :key="teil" :value="teil">{{ t(`betrieb.wkr.teil.${teil}`) }}</option>
        </select>
        <button type="button" class="btn sm" data-action="wkr-papier-ab" :title="t('betrieb.wkr.papierAb.title')" @click="papierAb">{{ t('betrieb.wkr.papierAb.knopf') }}</button>
      </div>

      <div class="row wkr-bedienung-reihe">
        <label class="wkr-bedienung-titel">
          {{ t('betrieb.wkr.pruefen.nr') }}
          <input v-model="pruefNr" class="input sm wkr-nr" data-feld="wkr-pruefen-nr" maxlength="16" @input="gesendet = false" />
        </label>
        <button type="button" class="btn sm" data-action="wkr-pruefen" :disabled="!mitRaum || !pruefNr.trim()" :title="t('betrieb.wkr.pruefen.title')" @click="pruefen">
          {{ t('betrieb.wkr.pruefen') }}
        </button>
        <span v-if="!mitRaum" class="note" data-hinweis="wkr-ohne-host">{{ t('betrieb.wkr.ohneHost') }}</span>
        <span v-else-if="gesendet" class="note" role="status" data-teil="wkr-gesendet">{{ t('betrieb.wkr.gesendet') }}</span>
      </div>
    </template>

    <ul v-if="l.abschluss.length" class="wkr-abschluesse" data-teil="wkr-abschluesse">
      <li v-for="a in l.abschluss" :key="a.punkt + (a.teil ?? '')" :data-punkt="a.punkt" :data-abschluss-teil="a.teil ?? ''">
        {{ abschlussText(a) }}
        <span v-if="a.abweichend.length" class="wkr-abweichend">· {{ t('betrieb.wkr.abschluss.abweichend', { nummern: a.abweichend.join(', ') }) }}</span>
        <span v-if="a.papier.length" class="note">· {{ t('betrieb.wkr.abschluss.papier', { nummern: a.papier.join(', ') }) }}</span>
        <span v-if="a.nichtVorbei.length" class="note" data-teil="abschluss-nicht-vorbei">· {{ t('betrieb.wkr.abschluss.nichtVorbei', { n: a.nichtVorbei.length, nummern: a.nichtVorbei.join(', ') }) }}</span>
        <button type="button" class="btn sm" data-action="wkr-abschluss-loesen" @click="loesen = { punkt: a.punkt, ...(a.teil ? { teil: a.teil } : {}) }">
          {{ t('betrieb.wkr.loesen') }}
        </button>
      </li>
    </ul>

    <AppDialog v-if="loesen" :titel="t('betrieb.wkr.loesen.frage')" data-dialog="wkr-abschluss-loesen" @abbrechen="loesen = null">
      <p>{{ t('betrieb.wkr.loesen.text') }}</p>
      <template #knoepfe>
        <button type="button" class="btn danger" data-action="wkr-loesen-ja" @click="loese">{{ t('betrieb.wkr.loesen.ja') }}</button>
        <button type="button" class="btn" data-action="wkr-loesen-nein" autofocus @click="loesen = null">{{ t('common.cancel') }}</button>
      </template>
    </AppDialog>
  </div>
</template>
