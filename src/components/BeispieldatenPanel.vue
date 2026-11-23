<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import { startNrPraefixe, startNrRegeln } from '../config/catalog'
import { beispielGroessen, vergibKlasse } from '../domain/startnrBereiche'
import type { Zeitnahme } from '../lib/beispielwerte'
import { classColor } from '../domain/classes'
import { BEISPIEL_STARTERZAHL, beispielFeldArt, beispielGesamt, beispielHerkuenfte, beispielHerkunft, generateStarters, verteileAufKlassen, type BeispielFeldArt } from '../domain/generate'
import { zufallAus } from '../lib/beispielwerte'
import { useEvent } from '../lib/event'
import { verlustText } from '../lib/eingabenVerlust'
import { istHaken, laufSchluessel, OHNE_LAUF, starterfeldFest } from '../lib/eingaben'
import { attemptSchluessel } from '../lib/parallelSchluessel'
import { useKonfig } from '../lib/konfig'
import { sprungziel } from '../lib/router'
import StarterSperre from './StarterSperre.vue'
import { rundenName, vergleicheRunden, VORLAUF, vorlaufGebunden } from '../planung/parallelRunden'
import { festeRunden, parallelListen } from '../lib/parallelBogen'
import { einteilungsZellen } from '../lib/einteilung'
import { useBeispielBoote } from '../lib/beispielBoote'
import { neueSaat } from '../lib/saat'
import type { ParallelRunde } from '../types'
import { t, tn } from '../i18n'
import type { ClassId, Starter } from '../types'

/**
 * Beispieldaten am Ende der Ansicht „Veranstaltung“: ein erfundenes Starterfeld, eine erfundene
 * Besetzung der WKR-Einteilung, erfundene Gewichte und dazu Beispielwerte für Erfassung und
 * Wertungslisten. Der Block steht dort – und nicht unter
 * „Einstellungen“ –, damit Neue gleich sehen, dass sich alles gefahrlos ausprobieren lässt.
 *
 * Zugeklappt, solange mit echten Startern gearbeitet wird: Der Block soll dann nicht stören.
 * Aufgeklappt, sobald das Starterfeld aus Beispieldaten stammt (`beispielStarter` im Stand):
 * Wer ausprobiert, will als Nächstes Beispielwerte ergänzen.
 */
const { state, dispatch } = useStore()
const { regelwerk, classLabel, parallel } = useEvent()
const konfig = useKonfig()

// Von Hand auf- oder zuklappen geht weiter; ein frisch erzeugtes Beispiel-Starterfeld öffnet den Block.
// Ebenso der Verweis aus dem Hinweis auf das feste Starterfeld (`#/veranstaltung?werte`): Er
// führt zu „Alle erfassten Werte löschen“ in diesem Block.
const block = ref<HTMLElement | null>(null)
const gerufen = sprungziel() === 'werte'
const offen = ref(state.value.beispielStarter || gerufen)
onMounted(async () => {
  if (!gerufen) return
  await nextTick()
  block.value?.scrollIntoView?.({ block: 'start' })
})
watch(
  () => state.value.beispielStarter,
  (beispiel) => {
    if (beispiel) offen.value = true
  },
)

// Nur für die Klassen des Regelwerks.
const CLASSES = computed(() => regelwerk.value.klassen.map((id) => ({ id, color: classColor(id) })))

// --- Beispiel-Starterfeld ----------------------------------------------------
// Eine Gesamtzahl als Vorschlag (Wunsch des Nutzers vom 21.11.2026): Sie wird nach der Art der Veranstaltung
// gezogen (Clubmeisterschaft 10–20, Vereine 45–75, Bundesland/Land 100–160, domain/generate.ts
// BEISPIEL_STARTERZAHL) und verteilt sich wie in echten Starterfeldern auf die Klassen
// (BEISPIEL_KLASSEN_ANTEILE). Die Zahl je Klasse ist wieder einzeln festlegbar – Nutzer 21.11.2026 (Fragenseite
// R6-02): „Es sollte weiterhin möglich sein, eine Anzahl pro Klasse festzulegen … Danach kann ich dann eine
// Klasse auf 0 setzen und eine andere erhöhen.“ Gesamtzahl und Klassen bleiben wie jede andere Wahl in diesem
// Block über das Neuladen stehen (lib/merken.ts `beispiel.klassen`) – zusammen mit der Art, für die sie gezogen
// wurden: Wechselt die Art (Clubmeisterschaft → Meisterschaft, Verein → Land), passen sie nicht mehr, und es wird
// neu gezogen – bestätigt 21.11.2026 (Fragenseite R6-03).
// Auslegungen vom 21.11.2026, noch zu bestätigen: BS2 Der Knopf heißt „Vorschlag neu“ statt „neu ziehen“ (dem
// Nutzer zu seltsam) und setzt Gesamtzahl und Klassen neu. BS3 Die Gesamtzahl ändern verteilt neu – die Zahlen
// je Klasse von Hand gehen dann verloren (die Gesamtzahl ist die Vorgabe, die Summe steht daneben).
// BS2 bestätigt 22.11.2026 (R7-50). BS3 NICHT bestätigt 22.11.2026 (R7-51) – Nutzer: „Manuelle Anpassung soll
// berücksichtigt werden. Mit einem Reset-Knopf.“
// BS3 umgebaut 22.11.2026 (R7-51, noch zu bestätigen): Gemerkt wird auch, welche Klassen von Hand gesetzt sind
// (`hand`). Eine neue Gesamtzahl und „Vorschlag neu“ verteilen nur noch auf die übrigen Klassen (domain/generate.ts
// verteileAufKlassen mit `fest`, BS4); die Hand-Zahlen bleiben und sind markiert (✎). BS4 (22.11.2026, noch zu
// bestätigen): „Zurücksetzen“ (nur sichtbar mit Hand-Zahlen) leert `hand` und verteilt die Gesamtzahl über alle
// Klassen neu. Ein Wechsel der Art verwirft wie bisher alles, auch `hand`.
// BS3 (umgebaut) und BS4 bestätigt 23.11.2026 (R9-14): Hand-Zahlen bleiben (✎), der Rest wird verteilt, „Zurücksetzen“
// nur bei Hand-Zahlen, ein Wechsel der Art verwirft alles.
const MAX_ZAHL = 999
const istZahl = (w: unknown): w is number => typeof w === 'number' && Number.isInteger(w) && w >= 0 && w <= MAX_ZAHL
interface BeispielKlassen {
  art: BeispielFeldArt
  gesamt: number
  klassen: Record<string, number>
  /** Von Hand gesetzte Klassen (BS3 umgebaut 22.11.2026) – behalten ihre Zahl beim Verteilen. */
  hand: ClassId[]
}
const istBeispielKlassen = (w: unknown): boolean => {
  if (typeof w !== 'object' || w === null) return w === null
  const x = w as Partial<BeispielKlassen>
  return (
    typeof x.art === 'string' &&
    istZahl(x.gesamt) &&
    typeof x.klassen === 'object' &&
    x.klassen !== null &&
    Object.values(x.klassen).every(istZahl) &&
    // `hand` fehlt in älteren Ständen → gilt als leer (handListe); vorhanden muss es eine Liste von Texten sein.
    (x.hand === undefined || (Array.isArray(x.hand) && x.hand.every((h) => typeof h === 'string')))
  )
}
const feldArt = computed(() => beispielFeldArt(state.value.eventKind, state.value.originMode))
const wahl = merke<BeispielKlassen | null>('beispiel.klassen', null, { ueberNeuladen: true, gueltig: istBeispielKlassen })
const klassenIds = () => CLASSES.value.map((c) => c.id)
/** Die von Hand gesetzten Klassen der gültigen Wahl, die es im Regelwerk gibt (fehlt `hand` → keine). */
const hand = computed<ClassId[]>(() => {
  const w = wahl.value
  if (!w || w.art !== feldArt.value) return []
  const ids = klassenIds()
  return (w.hand ?? []).filter((k) => ids.includes(k) && istZahl(w.klassen[k]))
})
/** Verteilt `gesamt` auf die Klassen, die nicht von Hand gesetzt sind (BS3 umgebaut, BS4); ohne Hand-Zahlen auf alle. */
function setzeVorgabe(gesamt: number, mitHand = true) {
  const h = mitHand ? hand.value : []
  const fest = Object.fromEntries(h.map((k) => [k, wahl.value!.klassen[k]])) as Partial<Record<ClassId, number>>
  wahl.value = { art: feldArt.value, gesamt, klassen: verteileAufKlassen(gesamt, klassenIds(), fest), hand: h }
}
/** „Zurücksetzen“ (BS4): Hand-Zahlen vergessen, die Gesamtzahl über alle Klassen neu verteilen. */
function zuruecksetzen() {
  setzeVorgabe(gesamt.value, false)
}
/** „Vorschlag neu“: Der Zufall reist als Saat – gleiche Saat, gleiche Zahl (lib/beispielwerte.ts zufallAus). */
function ziehe() {
  setzeVorgabe(beispielGesamt(feldArt.value, zufallAus(neueSaat())))
}
// Wechsel der Art: alles neu, auch `hand` (die Hand-Zahlen passten zur alten Art).
watch(feldArt, (art) => {
  if (wahl.value?.art !== art) {
    wahl.value = null
    ziehe()
  }
}, { immediate: true })
const gesamt = computed(() => (wahl.value?.art === feldArt.value ? wahl.value.gesamt : 0))
const bereich = computed(() => BEISPIEL_STARTERZAHL[feldArt.value])

const leseZahl = (e: Event) => Math.max(0, Math.min(MAX_ZAHL, parseInt((e.target as HTMLInputElement).value, 10) || 0))
/** BS3 umgebaut (22.11.2026, R7-51): Eine neue Gesamtzahl verteilt nur auf die Klassen ohne Hand-Zahl. */
function setGesamt(e: Event) {
  setzeVorgabe(leseZahl(e))
}

/**
 * Die Zahl je Klasse: die gemerkte, solange sie zu den Klassen des Regelwerks passt – sonst (anderes Regelwerk,
 * andere Klassen) die Verteilung der Gesamtzahl.
 */
const verteilung = computed<Record<ClassId, number>>(() => {
  const k = wahl.value?.art === feldArt.value ? wahl.value.klassen : undefined
  const ids = klassenIds()
  return k && ids.every((id) => istZahl(k[id])) ? k : verteileAufKlassen(gesamt.value, ids)
})
const countOf = (id: ClassId) => verteilung.value[id] ?? 0
const total = computed(() => CLASSES.value.reduce((sum, c) => sum + countOf(c.id), 0))
function setKlasse(id: ClassId, e: Event) {
  const n = leseZahl(e)
  ;(e.target as HTMLInputElement).value = String(n)
  // Die Klasse gilt ab jetzt als von Hand gesetzt (BS3 umgebaut 22.11.2026) – die übrigen bleiben, wie sie stehen.
  wahl.value = { art: feldArt.value, gesamt: gesamt.value, klassen: { ...verteilung.value, [id]: n }, hand: hand.value.includes(id) ? hand.value : [...hand.value, id] }
}

// Herkünfte: unbegrenzt (gewürfelt aus allen) oder eine Zahl – dann verteilen sich die Starter
// reihum auf so viele Vereine bzw. Bundesländer oder Länder, je nach Art der Herkunft. So lässt
// sich die Mannschaftswertung prüfen (Entscheidung des Nutzers vom 15.11.2026). 0 = unbegrenzt.
// Ohne Herkunft gibt es nichts zu verteilen: Das Feld ist dann gesperrt – auch bei der Clubmeisterschaft (BS1).
const herkunft = computed(() => beispielHerkunft(state.value.eventKind, state.value.originMode))
const herkuenfte = merke('beispiel.herkuenfte', 0, { ueberNeuladen: true, gueltig: (w) => typeof w === 'number' && Number.isInteger(w) && w >= 0 && w <= 99 })
function setHerkuenfte(e: Event) {
  herkuenfte.value = Math.max(0, Math.min(99, parseInt((e.target as HTMLInputElement).value, 10) || 0))
}

// Sobald Ergebnisse erfasst sind, steht das Starterfeld fest (components/StarterSperre.vue).
const fest = computed(() => starterfeldFest(state.value))

function generate() {
  if (fest.value) return
  const existing = state.value.starters.length
  if (existing > 0 && !confirm(t('demo.confirm', { n: existing }) + verlustText(state.value, state.value.starters))) return
  // Erfundene Starter entstehen hier und nicht im Reducer – der bleibt frei von Zufall.
  // Die Herkunft folgt der Wahl der Veranstaltung, gleich unter welchem Regelwerk: Verein →
  // Vereine, Bundesland → Bundesländer, Land → Länder (Kürzel nach IOC), ohne → keine
  // (Entscheidung des Nutzers vom 15.11.2026, spät abends; sie ersetzt die vom selben Tag, nach
  // der unter UIM immer Nationen kamen und die Herkunft dazu auf „Land“ umgestellt wurde).
  // Die Einstellung der Veranstaltung bleibt, wie gewählt.
  // Clubmeisterschaft: keine Herkunft (BS1, domain/generate.ts beispielHerkunft).
  const origin = herkunft.value
  const feste = herkuenfte.value > 0 && origin !== 'none' ? beispielHerkuenfte(origin, herkuenfte.value) : undefined
  let starters: Starter[] = []
  for (const c of CLASSES.value) {
    if (countOf(c.id) > 0) {
      // Das Geschlecht nur, wo eine Liste danach fragt (Regel 960, Pkt. 3.7): unter der DM nicht.
      const neu = generateStarters(c.id, countOf(c.id), state.value.eventJahr, origin, starters, startNrPraefixe(state.value), feste, parallel.value)
      // Klassenbasiert wie „Startnummern vergeben“: aus dem Bereich der Größe, ohne fehlende Westen (19.11.2026).
      if (state.value.startNrMode !== 'klasse') starters = starters.concat(neu)
      else {
        const regeln = startNrRegeln(state.value, c.id)
        starters = starters.concat(vergibKlasse(beispielGroessen(neu, c.id, regeln), c.id, regeln))
      }
    }
  }
  dispatch({ type: 'CLEAR_ALL_STARTERS' })
  dispatch({ type: 'ADD_STARTERS', starters, beispiel: true })
}

/** Was die Herkunft der Beispielstarter sein wird – die der Veranstaltung (oben in dieser Ansicht), bei der Clubmeisterschaft keine. */
const herkunftHinweis = computed(() => {
  if (state.value.eventKind === 'club') return t('demo.originNote.club')
  return herkunft.value === 'none' ? t('demo.originNote.none') : t('demo.originNote', { origin: t(`event.origin.${herkunft.value}`) })
})

// --- Beispiel-Besetzung und Beispielgewichte ---------------------------------
// Je ein eigener Knopf (Entscheidung des Nutzers vom 15.11.2026): erfundene Namen für die
// WKR-Einteilung und erfundene Gewichte aus der Verwiegung. Was schon eingetragen ist, wird nie
// still ersetzt – erst nach Rückfrage (lib/beispieldaten.ts).

/** Die Zellen, die die Beispiel-Besetzung füllt – dieselben wie „alle auf …“ in der WKR-Einteilung. */
const besetzungZellen = computed(() => einteilungsZellen(konfig.value, state.value, parallel.value ? parallelListen(konfig.value) : []))
const besetzt = computed(() => besetzungZellen.value.filter((z) => (state.value.einteilung[z.parcoursId]?.[z.typeId] ?? '').trim() !== '').length)
const besetzungStand = computed(() =>
  besetzungZellen.value.length === 0 ? t('demo.crew.noLists') : t('demo.crew.count', { done: besetzt.value, total: besetzungZellen.value.length }),
)

function beispielBesetzung() {
  if (besetzt.value > 0 && !confirm(tn('demo.crew.confirm', besetzt.value))) return
  dispatch({ type: 'FILL_BEISPIEL_BESETZUNG', saat: neueSaat() })
}

// Boote und Co-Piloten je Klasse (19.11.2026): seit 21.11.2026 nur noch hier – Beispielwerte entstehen an
// EINER Stelle (Wunsch des Nutzers), nicht mehr auch im Block „Besetzung“.
const { bootKlassen, coKlassen, beispielBoote, beispielCoPiloten } = useBeispielBoote()

const gewogen = computed(() => state.value.starters.filter((p) => p.gewicht !== undefined).length)

function beispielGewichte() {
  if (gewogen.value > 0 && !confirm(tn('demo.weights.confirm', gewogen.value))) return
  dispatch({ type: 'FILL_BEISPIELGEWICHTE', saat: neueSaat() })
}

// --- Beispielwerte -----------------------------------------------------------
const ZEITNAHMEN: Zeitnahme[] = ['stoppuhr', 'lichtschranke']
// Die Schlüssel stammen aus der Zeit, als der Block unter „Einstellungen“ stand; sie bleiben,
// damit eine in diesem Fenster getroffene Wahl nicht verloren geht.
const zeitnahme = merke<Zeitnahme>('einstellungen.zeitnahme', 'stoppuhr', { ueberNeuladen: true, gueltig: (w) => ZEITNAHMEN.includes(w as Zeitnahme) })
const beispielBis = merke('einstellungen.beispielBis', 0, { ueberNeuladen: true })
const laufWahl = computed(() => Array.from({ length: Math.max(1, state.value.laufCount) }, (_, i) => i + 1))
/** Bis zu welchem Lauf gefüllt wird; die Vorgabe sind alle Läufe. */
const bisLauf = computed(() => (laufWahl.value.includes(beispielBis.value) ? beispielBis.value : laufWahl.value.length))
// Gezählt werden erfasste Werte, ohne die Haken „erfasst“: Ein Haken ist kein Wert der Wertung.
// Die Rückfrage vor dem Löschen einer Runde (lib/parallelStage.ts `rundenWerteZahl`) zählt die
// Haken dagegen mit und sagt das – dort geht es darum, was verloren geht.
const werteZahl = computed(() =>
  Object.values(state.value.eingaben).reduce((n, zeilen) => n + Object.values(zeilen).reduce((m, werte) => m + Object.keys(werte).filter((k) => !istHaken(k)).length, 0), 0),
)

// Was gefüllt (und was gelöscht) wird, ist eine Auswahl (Entscheidung des Nutzers vom 15.11.2026):
// das Manövrieren – bis zum gewählten Lauf – oder eine einzelne Runde des Parallelslaloms. Eine
// Runde ist erst wählbar, wenn ihr Startplan festgeschrieben ist: Ohne Plan gibt es keine Liste,
// auf der die Werte stünden. Unter einem Regelwerk ohne Parallelslalom gibt es nichts zu wählen.
const MANOEVER = 'manoever'
type Was = typeof MANOEVER | ParallelRunde
const feste = computed(() => (parallel.value ? festeRunden(state.value.parallelPlaene) : []))
/**
 * Vorlauf, Halbfinale, Kleines Finale und Finale stehen immer zur Wahl (gesperrt ohne Plan), Wiederholungen, sobald
 * es sie gibt – in der Folge, in der gefahren wird. Kleines Finale und Finale sind seit 21.11.2026 eigene Runden.
 */
const rundenWahl = computed<ParallelRunde[]>(() => (parallel.value ? [...new Set<ParallelRunde>([VORLAUF, 'semi', 'small', 'final', ...feste.value])].sort(vergleicheRunden) : []))
const wasWahl = merke<Was>('beispiel.was', MANOEVER, { ueberNeuladen: true, gueltig: (w) => typeof w === 'string' })
/** Das Gewählte – eine Runde ohne festgeschriebenen Plan zählt wie „Manövrieren“. */
const was = computed<Was>(() => (wasWahl.value !== MANOEVER && feste.value.includes(wasWahl.value) ? wasWahl.value : MANOEVER))

const laeufeGewaehlt = computed(() => laufWahl.value.filter((l) => l <= bisLauf.value))
/** Die Lauf-Schlüssel des Gewählten – daran hängt, was „ersetzen“ und „löschen“ trifft (wie im Reducer). */
const schluesselGewaehlt = computed(() => {
  const w = was.value
  if (w !== MANOEVER) return [attemptSchluessel(w, 1), attemptSchluessel(w, 2)]
  const disziplin = konfig.value.getAufbau(state.value.aufbau).disziplin
  return laeufeGewaehlt.value.flatMap((l) => [laufSchluessel(disziplin, l), ...(l === 1 ? [laufSchluessel(disziplin, OHNE_LAUF)] : [])])
})
const werteGewaehlt = computed(() => schluesselGewaehlt.value.filter((k) => state.value.eingaben[k] !== undefined).length)
/** Die Runden nach dem Vorlauf werden je Klasse festgeschrieben: Dort werden nur Attempts ohne Werte gefüllt. */
const nurLeere = computed(() => was.value !== MANOEVER && was.value !== VORLAUF)

function beispielwerte() {
  if (!nurLeere.value && werteGewaehlt.value > 0 && !confirm(t('demo.values.confirm'))) return
  const saat = neueSaat()
  const w = was.value
  if (w === MANOEVER) dispatch({ type: 'FILL_BEISPIELWERTE', zeitnahme: zeitnahme.value, saat, laeufe: laeufeGewaehlt.value })
  else dispatch({ type: 'FILL_BEISPIELWERTE', zeitnahme: zeitnahme.value, saat, runden: [w], nurRunden: true, ...(nurLeere.value ? { nurLeere: true } : {}) })
}

function gewaehltesLoeschen() {
  if (!confirm(t('demo.values.clearSelectedConfirm'))) return
  const w = was.value
  dispatch(w === MANOEVER ? { type: 'CLEAR_EINGABEN_TEIL', laeufe: laeufeGewaehlt.value } : { type: 'CLEAR_EINGABEN_TEIL', runden: [w] })
}

// Ein Plan des Vorlaufs, der bei freigegebener Verzahnung noch steht, entfällt nur über diesen
// Knopf – auch wenn das letzte einzelne Feld schon geleert ist (planung/parallelRunden.ts).
const planHaengt = computed(() => !state.value.verzahnungLocked && vorlaufGebunden(state.value))

function werteLoeschen() {
  if (confirm(t('demo.values.clearConfirm'))) dispatch({ type: 'CLEAR_EINGABEN' })
}
</script>

<template>
  <details ref="block" class="panel" data-block="beispieldaten" :open="offen" @toggle="offen = ($event.target as HTMLDetailsElement).open">
    <summary>{{ t('demo.title') }}</summary>
    <p class="hint">{{ t('demo.intro') }}</p>
    <div class="row" style="align-items: flex-end; gap: 12px 20px">
      <div class="field" style="width: 160px">
        <label for="beispiel-gesamt">{{ t('demo.total') }}</label>
        <input id="beispiel-gesamt" class="input" type="number" min="0" :max="MAX_ZAHL" data-feld="beispiel-gesamt" :value="gesamt" @change="setGesamt" />
      </div>
      <button type="button" class="btn sm" data-action="beispiel-gesamt-neu" :title="t('demo.total.redrawTitle')" @click="ziehe">{{ t('demo.total.redraw') }}</button>
    </div>
    <p class="note" data-hinweis="beispiel-gesamt">{{ t('demo.total.hint', { art: t(`demo.total.art.${feldArt}`), von: bereich[0], bis: bereich[1] }) }}</p>
    <div class="subhead">
      {{ t('demo.perClass') }}
      <span class="note" data-hinweis="beispiel-summe" role="status" style="margin: 0 0 0 8px">{{ t('demo.perClass.sum', { n: total, gesamt }) }}</span>
      <!-- BS4 (22.11.2026, R7-51): nur mit Hand-Zahlen – vergisst sie und verteilt die Gesamtzahl über alle Klassen. -->
      <button
        v-if="hand.length > 0"
        type="button"
        class="btn sm"
        style="margin-left: 8px"
        data-action="beispiel-klassen-zuruecksetzen"
        :title="t('demo.perClass.resetTitle')"
        @click="zuruecksetzen"
      >
        {{ t('demo.perClass.reset') }}
      </button>
    </div>
    <div class="setup-grid">
      <!-- Wie die Felder je Klasse unter „Einstellungen“: die ganze Kachel ist das Label. -->
      <label v-for="c in CLASSES" :key="c.id" class="class-count" :data-klasse="c.id" :data-hand="hand.includes(c.id) || undefined">
        <span class="dot" :style="{ background: c.color }" />
        <span class="meta">
          <span class="name">{{ classLabel(c.id) }}</span>
          <span v-if="hand.includes(c.id)" data-teil="beispiel-hand" :title="t('demo.perClass.handTitle')"> ✎</span>
        </span>
        <input type="number" min="0" :max="MAX_ZAHL" :data-feld="`beispiel-klasse|${c.id}`" :value="countOf(c.id)" @change="setKlasse(c.id, $event)" />
      </label>
    </div>
    <div class="row" style="justify-content: flex-end; align-items: flex-end; gap: 20px">
      <!-- 0 = unbegrenzt: Die Herkunft jedes Starters wird aus allen gewürfelt. Ohne Herkunft ist das
           Feld gesperrt und leer (weder Zahl noch „unbegrenzt“) – es gilt dann nichts davon; die
           gemerkte Zahl bleibt und steht wieder da, sobald die Veranstaltung eine Herkunft führt. -->
      <div class="field" style="width: 220px">
        <label for="beispiel-herkuenfte">{{ t('demo.origins') }}</label>
        <input
          id="beispiel-herkuenfte"
          class="input"
          type="number"
          min="0"
          max="99"
          data-feld="beispiel-herkuenfte"
          :value="herkunft === 'none' ? '' : herkuenfte || ''"
          :placeholder="herkunft === 'none' ? undefined : t('demo.origins.unlimited')"
          :title="t(herkunft === 'none' ? 'demo.origins.none' : 'demo.origins.hint')"
          :disabled="herkunft === 'none'"
          @change="setHerkuenfte"
        />
      </div>
      <button class="btn" data-action="beispielstarter" :disabled="total === 0 || fest" @click="generate">{{ t('demo.generate') }}</button>
    </div>
    <p class="note" data-hinweis="beispiel-herkunft">{{ herkunftHinweis }}</p>
    <StarterSperre />

    <!-- Beispiel-Besetzung und Beispielgewichte: je ein Knopf, Rückfrage vor dem Ersetzen. -->
    <div class="subhead">{{ t('demo.crew.title') }}</div>
    <p class="hint">{{ t('demo.crew.intro') }}</p>
    <div class="row" style="align-items: center; gap: 12px 32px; margin-bottom: 18px">
      <span class="row" style="align-items: center; gap: 10px">
        <button class="btn" data-action="beispielbesetzung" :disabled="besetzungZellen.length === 0" @click="beispielBesetzung">{{ t('demo.crew.fill') }}</button>
        <span class="note" data-hinweis="beispiel-besetzung" role="status" style="margin: 0">{{ besetzungStand }}</span>
      </span>
      <span class="row" style="align-items: center; gap: 10px">
        <button class="btn" data-action="beispielgewichte" :disabled="state.starters.length === 0" @click="beispielGewichte">{{ t('demo.weights.fill') }}</button>
        <span class="note" data-hinweis="beispiel-gewichte" role="status" style="margin: 0">{{ t('weigh.progress', { done: gewogen, total: state.starters.length }) }}</span>
      </span>
      <span class="row" style="align-items: center; gap: 10px">
        <button class="btn" data-action="beispiel-boote" :disabled="bootKlassen.length === 0" :title="t('crew.sample.boatsTitle')" @click="beispielBoote">{{ t('crew.sample.boats') }}</button>
        <button
          class="btn"
          data-action="beispiel-copiloten"
          :disabled="coKlassen.length === 0"
          :title="coKlassen.length === 0 ? t('crew.sample.noCoPilots') : t('crew.sample.coPilotsTitle')"
          @click="beispielCoPiloten"
        >
          {{ t('crew.sample.coPilots') }}
        </button>
      </span>
    </div>

    <!-- Beispielwerte für Erfassung und Wertungslisten: Zufall nach den Häufigkeiten früherer Wettkämpfe. -->
    <div class="subhead">{{ t('demo.values.title') }}</div>
    <p class="hint">{{ t('demo.values.intro') }}</p>
    <div class="row" style="align-items: flex-end; gap: 20px">
      <div class="field">
        <label>{{ t('demo.values.timing') }}</label>
        <div class="segmented">
          <button v-for="z in ZEITNAHMEN" :key="z" type="button" :class="zeitnahme === z ? 'active' : ''" :aria-pressed="zeitnahme === z" :data-zeitnahme="z" @click="zeitnahme = z">
            {{ t(`demo.values.timing.${z}`) }}
          </button>
        </div>
      </div>
      <!-- Was gefüllt wird: das Manövrieren oder eine Runde des Parallelslaloms (erst mit festgeschriebenem Plan). -->
      <div v-if="parallel" class="field">
        <label for="beispiel-was">{{ t('demo.values.what') }}</label>
        <select id="beispiel-was" class="input" data-feld="beispiel-was" :value="was" @change="wasWahl = ($event.target as HTMLSelectElement).value as Was">
          <option :value="MANOEVER">{{ t('running.source.manoever') }}</option>
          <optgroup :label="t('parallel.title')">
            <option v-for="r in rundenWahl" :key="r" :value="r" :disabled="!feste.includes(r)">{{ rundenName(r, t) }}</option>
          </optgroup>
        </select>
      </div>
      <div v-if="was === MANOEVER" class="field">
        <label for="beispiel-laeufe">{{ t('demo.values.runs') }}</label>
        <select id="beispiel-laeufe" class="input" data-feld="beispiel-laeufe" :value="bisLauf" @change="beispielBis = Number(($event.target as HTMLSelectElement).value)">
          <option v-for="l in laufWahl" :key="l" :value="l">{{ t('demo.values.runsUpTo', { n: l }) }}</option>
        </select>
      </div>
      <span style="flex: 1" />
      <button class="btn danger sm" data-action="werte-loeschen-gewaehlt" :disabled="werteGewaehlt === 0" @click="gewaehltesLoeschen">{{ t('demo.values.clearSelected') }}</button>
      <button class="btn" data-action="beispielwerte" :disabled="state.starters.length === 0" @click="beispielwerte">{{ t('demo.values.fill') }}</button>
    </div>
    <p v-if="parallel" class="note" data-hinweis="beispiel-auswahl">{{ t(nurLeere ? 'demo.values.roundNote' : 'demo.values.heatNote') }}</p>
    <div class="row" style="align-items: center">
      <span class="note" data-hinweis="werte" role="status" style="flex: 1; margin: 0">{{ tn('demo.values.count', werteZahl) }}</span>
      <button class="btn danger sm" data-action="werte-loeschen" :disabled="Object.keys(state.eingaben).length === 0 && !planHaengt" @click="werteLoeschen">{{ t('demo.values.clear') }}</button>
    </div>
  </details>
</template>
