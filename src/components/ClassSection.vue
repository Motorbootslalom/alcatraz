<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useStore } from '../state/store'
import { birthYearRange, getClass } from '../domain/classes'
import { SIZES } from '../domain/sizes'
import { flaggeAllein, herkunftAnzeige, originField, originLabelKey, originOf } from '../lib/origin'
import HerkunftText from './HerkunftText.vue'
import { useEvent } from '../lib/event'
import { verlustText } from '../lib/eingabenVerlust'
import { starterfeldFest } from '../lib/eingaben'
import { abmeldeAttempts, abmeldePlan, abmeldeZellen } from '../lib/abmeldung'
import { zerlegeAttempt } from '../lib/parallelSchluessel'
import { rundenName } from '../planung/parallelRunden'
import { useKonfig } from '../lib/konfig'
import { zerlegeLauf } from '../lib/eingaben'
import { formatDate, locale, t, tn } from '../i18n'
import ManualAddForm from './ManualAddForm.vue'
import AppDialog from './AppDialog.vue'
import DatumFeld from './DatumFeld.vue'
import { GEBURTSTAG_FENSTER, geburtsjahr, geburtstagsHinweise, jahrgaengeText, klassenFuerJahr, knappAmErstenTagAusserhalb, startendeJahrgaenge, type GeburtstagsHinweis, type GeburtstagsStufe } from '../import/klassenPruefung'
import { istTag } from '../lib/datum'
import { klasseFest } from '../state/reducer'
import { adresse } from '../lib/router'
import type { ClassId, Starter } from '../types'
import { GESCHLECHTER, geschlechtKuerzel, istGeschlecht } from '../domain/geschlecht'
import { gleicheFolge, istSortierWahl, naechsteSortierung, sortierPfeil, sortierSpalten, spaltenText, type SortierSpalte, type SortierWahl } from '../lib/reihenfolge'
import { merke } from '../lib/merken'
import { sortedByStartNr } from '../domain/startnumbers'
import { neueSaat } from '../lib/saat'

const props = defineProps<{
  classId: ClassId
  starters: Starter[]
  /** IDs der Starter mit doppelt vergebener Startnummer (über die ganze Veranstaltung ermittelt). */
  duplicates: Set<string>
  open: boolean
  /** Zählt hoch, wenn die Liste von außen neu geordnet werden soll (automatische Vergabe). */
  sortTick: number
  /** Spalte „zählt für die Pokalauswertung“ zeigen (Einstellungen: nur ausgewählte Starter zählen). */
  pokalAuswahl?: boolean
  /** Zuletzt oben für alle Klassen gewählte Sortierung (mit der Folge je Klasse) – der Spaltenkopf zeigt sie auch hier. */
  sortierung?: SortierWahl | null
}>()

const emit = defineEmits<{
  toggle: []
  /** Ein Starter ist in eine andere Klasse gekommen (angelegt oder verschoben) – die soll aufgehen. */
  oeffne: [klasse: ClassId]
}>()

const { state, dispatch } = useStore()
const { classLabel, classBadge, parallel, regelwerk } = useEvent()
const def = computed(() => getClass(props.classId))
const flagge = (p: Starter) => flaggeAllein(originOf(p, state.value.originMode), state.value.originMode)
const showAdd = ref(false)
const edit = ref(false)

// Ein fehlendes Geburtsdatum hält nichts auf, soll aber sofort auffallen – auch bei zugeklappter Klasse.
const ohneDatum = computed(() => props.starters.filter((p) => !p.geburtsdatum).length)

/**
 * Starterlaubnis nach Geburtstag (DM-Reglement C8: E ab dem 6., 7 bis zum 27. Geburtstag; Regelwerk
 * `geburtstagsGrenzen`). Entscheidung des Nutzers vom 24.11.2026: „Bei den Geburtstag-Ausnahmen
 * reicht eine Warnung und kann dann einfach übergangen werden“ – deshalb nur Hinweise wie beim
 * fehlenden Geburtsdatum: eine Marke im Kopf (auch zugeklappt), die Liste in der offenen Klasse und
 * ein Zeichen an der Zeile. Nichts wird gesperrt, verschoben oder abgefragt, und es gibt nichts zu
 * bestätigen. Ohne Datum der Veranstaltung nur nach dem Jahrgang (import/klassenPruefung.ts).
 * Seit 26.11.2026 (Antwort des Nutzers auf R11-02, mehrtägige Veranstaltungen) zwei Stufen: eine
 * deutliche Warnung (rot: klar zu jung/zu alt oder Geburtstag knapp um den ersten Wettkampftag) und
 * der Hinweis (gelb: Geburtstag nahe daran, ohne Datum der Grenz-Jahrgang; Spannen nur in
 * GEBURTSTAG_FENSTER) – je eine Marke im Kopf, je ein
 * Kasten, das Zeichen am Geburtsdatum in der stärksten Stufe des Starters. Beide bleiben übergehbar.
 */
const geburtstag = computed(() => geburtstagsHinweise(props.starters, regelwerk.value.geburtstagsGrenzen, state.value.eventJahr, state.value.eventDatum))
const geburtstagJe = computed(() => {
  const je = new Map<string, GeburtstagsHinweis[]>()
  for (const h of geburtstag.value) je.set(h.starter.id, [...(je.get(h.starter.id) ?? []), h])
  return je
})
const geburtstagWarnungen = computed(() => geburtstag.value.filter((h) => h.stufe === 'warnung'))
const geburtstagHinweiseNur = computed(() => geburtstag.value.filter((h) => h.stufe === 'hinweis'))
/** Stärkste Stufe je Starter – ein Starter zählt in den Marken im Kopf nur einmal, in seiner stärksten Stufe. */
const geburtstagStufe = computed(() => {
  const je = new Map<string, GeburtstagsStufe>()
  for (const [id, hs] of geburtstagJe.value) je.set(id, hs.some((h) => h.stufe === 'warnung') ? 'warnung' : 'hinweis')
  return je
})
const geburtstagZahl = (stufe: GeburtstagsStufe) => [...geburtstagStufe.value.values()].filter((s) => s === stufe).length
const ohneEventDatum = computed(() => !istTag(state.value.eventDatum))
const abstandText = (tage: number | null) =>
  tage === null ? '' : tage === 0 ? t('starters.geburtstag.abstand.am') : tn(tage < 0 ? 'starters.geburtstag.abstand.vor' : 'starters.geburtstag.abstand.nach', Math.abs(tage))
// Knapp, aber am ersten Wettkampftag schon außerhalb: Der Text sagt es ausdrücklich (Prüfbefund 26.11.2026).
const geburtstagSchluessel = (h: GeburtstagsHinweis) =>
  knappAmErstenTagAusserhalb(h) ? (h.art === 'knappAb' ? 'knappAbNochZuJung' : 'knappBisSchonZuAlt') : h.art
const geburtstagText = (h: GeburtstagsHinweis) =>
  t(`starters.geburtstag.${geburtstagSchluessel(h)}`, {
    name: nameVon(h.starter),
    grenze: h.grenze,
    geburtstag: formatDate(h.geburtstag),
    class: classLabel(props.classId),
    abstand: abstandText(h.abstand),
    letzterTag: h.letzterTag ? formatDate(h.letzterTag) : '',
  })
const geburtstagTitel = (p: Starter) => (geburtstagJe.value.get(p.id) ?? []).map(geburtstagText).join('\n') || undefined
const geburtstagZelle = (p: Starter) => (geburtstagStufe.value.has(p.id) ? ['geburtstag-zelle', `geburtstag-zelle--${geburtstagStufe.value.get(p.id)}`] : [])
/** Satz unter den Kästen: wie weit die zwei Stufen reichen (Zahlen aus GEBURTSTAG_FENSTER). */
const geburtstagTagText = computed(() =>
  t('starters.geburtstag.tag', {
    tag: formatDate(state.value.eventDatum),
    warnung: tn('starters.geburtstag.tage', GEBURTSTAG_FENSTER.warnungTage),
    hinweis: tn('starters.geburtstag.tage', GEBURTSTAG_FENSTER.hinweisTage),
  }),
)

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

// Verschieben und Sortieren ordnen ausdrücklich um – danach gilt die neue Reihenfolge.
const resort = ref(false)
watch(
  () => props.starters,
  () => {
    if (resort.value) sortNow()
    resort.value = false
  },
)

function reorder(action: Parameters<typeof dispatch>[0]) {
  const vorher = state.value
  resort.value = true
  dispatch(action)
  // Stand schon so (oder gesperrt): Es kommt keine neue Liste – sonst ordnete die nächste
  // Änderung von Hand die Tabelle unerwartet um.
  if (state.value === vorher) {
    resort.value = false
  }
}

/**
 * „Sortierung ändern“ (Entscheidung des Nutzers vom 15.11.2026): Die Spaltenköpfe werden zu
 * Knöpfen, je Kopf drei Stufen (lib/reihenfolge.ts naechsteSortierung, bestätigt 21.11.2026 S-01):
 * aufsteigend A→Z ↑, absteigend Z→A ↓, Markierung weg ↕ (ohne Action – die Reihenfolge bleibt). Bei Gleichstand bleibt die
 * bisherige Reihenfolge. „Zufall“ mischt jedes Mal neu. Nur solange die Verzahnung offen ist – danach
 * sperrt auch der Reducer.
 */
const sortieren = ref(false)
const verzahnungFest = computed(() => state.value.verzahnungLocked)
const kopfKlickbar = computed(() => sortieren.value && !verzahnungFest.value)
const spalten = computed(() => sortierSpalten(state.value.originMode, mitGeschlecht.value))
const BREITE: Partial<Record<SortierSpalte, string>> = { groesse: '64px', geschlecht: '64px', geburtsdatum: '130px' }
/**
 * Die gewählte Stufe – hier oder oben für alle Klassen; Bedienauswahl (lib/merken.ts), damit sie den
 * Wechsel des Reiters und das Neuladen übersteht (wie die aufgeklappten Klassen). Mit der Folge der
 * Klasse nach dem Sortieren: Die Markierung gilt, solange die Klasse noch so steht (nicht nach
 * Verschieben, Nummern von Hand, neuen Startern). Früher prüfte das istGeordnet – mit Startnummern-Bereichen sortiert der Reducer aber nur je Größengruppe, die Markierung
 * verschwand sofort und der zweite Klick drehte nicht um (Befund 16 des Feldtests, 21.11.2026).
 */
const wahl = merke<SortierWahl | null>(`starter.sortierung.${props.classId}`, null, { ueberNeuladen: true, gueltig: istSortierWahl })
watch(
  () => props.sortierung,
  (s) => (wahl.value = s ?? null),
)
const aktiv = computed(() => (wahl.value && gleicheFolge(wahl.value.folge[props.classId], props.starters) ? wahl.value : null))
/** Folge der Klasse direkt aus dem Stand – `props.starters` kommt erst mit dem nächsten Zeichnen nach. */
const folgeImStand = () => sortedByStartNr(state.value.starters.filter((p) => p.klasse === props.classId)).map((p) => p.id)

function schalteSortieren() {
  sortieren.value = !sortieren.value
  if (sortieren.value && !props.open) emit('toggle')
}

function sortiere(spalte: SortierSpalte) {
  const neu = naechsteSortierung(aktiv.value, spalte)
  if (!neu) {
    // Stufe 3: nur die Markierung weg, die Reihenfolge bleibt, wie sie ist.
    wahl.value = null
    return
  }
  reorder({ type: 'ORDER_STARTERS', klassen: [props.classId], nach: spalte, absteigend: neu.absteigend })
  wahl.value = { ...neu, folge: { [props.classId]: folgeImStand() } }
}

function mischen() {
  wahl.value = null
  reorder({ type: 'SHUFFLE_STARTERS', klassen: [props.classId], saat: neueSaat() })
}

const pfeil = (spalte: SortierSpalte) => sortierPfeil(aktiv.value, spalte)
function kopfTitel(spalte: SortierSpalte) {
  if (unsorted.value) return t('starters.order.unsorted')
  const column = t(spaltenText(spalte, state.value.originMode))
  if (aktiv.value?.spalte !== spalte) return t('starters.order.by', { column })
  return t(aktiv.value.absteigend ? 'starters.order.byDesc' : 'starters.order.byAsc', { column })
}
const ariaSort = (spalte: SortierSpalte) => (kopfKlickbar.value && aktiv.value?.spalte === spalte ? (aktiv.value.absteigend ? 'descending' : 'ascending') : undefined)

const hasDuplicates = computed(() => props.starters.some((p) => props.duplicates.has(p.id)))

function toggleEdit() {
  // Mit doppelten Nummern lässt sich das Bearbeiten nicht beenden.
  if (edit.value && hasDuplicates.value) return
  edit.value = !edit.value
  if (edit.value && !props.open) emit('toggle')
}

/** Ein abgewiesenes Geburtsdatum (Jahrgang passt nicht zur Klasse, kein gültiges Datum) – bis zur nächsten Änderung. */
const jahrFehler = ref('')
/** Der Vorschlag dazu: in die Klasse, in die der Jahrgang gehört – mit dem abgewiesenen Datum. */
const verschieben = ref<{ starter: Starter; klasse: ClassId; geburtsdatum: string } | null>(null)
/** Was zuletzt in eine andere Klasse ging (angelegt oder verschoben) – hier steht es nicht mehr. */
const woanders = ref('')

const nameVon = (p: Starter) => [p.vorname, p.nachname].filter(Boolean).join(' ') || p.startNr

function meldungenWeg() {
  jahrFehler.value = ''
  verschieben.value = null
  woanders.value = ''
}

// Die Klasse steht hier nicht zur Wahl: Ein Starter gehört in die Klasse seines Jahrgangs. Der
// Reducer lehnt einen Klassenwechsel außerdem ab, sobald Verzahnung bzw. Startplan
// festgeschrieben sind (state/reducer/starter.ts `klasseFest`).
function update(id: string, field: keyof Omit<Starter, 'id' | 'klasse' | 'geburtsdatum'>, e: Event) {
  meldungenWeg()
  dispatch({ type: 'UPDATE_STARTER', id, patch: { [field]: (e.target as HTMLInputElement).value } })
}

/**
 * Ein Geburtsjahr, das nicht in die Klasse gehört, wird abgewiesen – wie beim Einfügen aus
 * Excel und beim Hinzufügen von Hand: Das Feld zeigt wieder, was galt (components/DatumFeld.vue).
 * Gehört der Jahrgang in eine andere Klasse des Regelwerks, schlägt die Meldung vor, den Starter
 * dorthin zu verschieben – nur, solange die Klasse nicht feststeht (Entscheidung des Nutzers vom
 * 15.11.2026). Passt er in keine, nennt sie die Jahrgänge, die überhaupt starten.
 */
function setzeDatum(p: Starter, iso: string) {
  meldungenWeg()
  const jahr = geburtsjahr(iso)
  const [from, to] = birthYearRange(props.classId, state.value.eventJahr)
  if (jahr !== null && (jahr < from || jahr > to)) {
    const ziel = klassenFuerJahr(jahr, state.value.eventJahr, regelwerk.value.klassen).find((k) => k !== props.classId)
    // Mit Namen: Die Zeile zeigt schon wieder das alte Datum – wen die Meldung meint, sagt sie selbst.
    const grund = t('starters.birthOutOfRangeFor', { name: nameVon(p), year: jahr, class: classLabel(props.classId), from, to })
    jahrFehler.value = ziel ? grund : `${grund} ${t('starters.birthNoClass', { years: jahrgaengeText(startendeJahrgaenge(state.value.eventJahr, regelwerk.value.klassen)) })}`
    if (ziel) verschieben.value = { starter: p, klasse: ziel, geburtsdatum: iso }
    return
  }
  dispatch({ type: 'UPDATE_STARTER', id: p.id, patch: { geburtsdatum: iso } })
}

/** Ungültiges Datum im Feld (31.02., unbekanntes Muster): Die Meldung steht über der Tabelle, mit dem Namen. */
function datumFehler(p: Starter, text: string) {
  if (!text) return
  meldungenWeg()
  jahrFehler.value = t('starters.dateNotTaken', { name: nameVon(p), reason: text })
}

/** Verschieben geht nicht, sobald die Klasse feststeht oder Ergebnisse erfasst sind – dann sagt die Meldung, warum. */
const verschiebenGesperrt = computed(() => (klasseFest(state.value) ? t('starters.classFixed') : starterfeldFest(state.value) ? t('starters.moveLockedResults') : ''))
const verschiebenTitel = computed(() => {
  const v = verschieben.value
  if (!v) return ''
  const [from, to] = birthYearRange(v.klasse, state.value.eventJahr)
  const text = t('starters.moveToClassTitle', { name: nameVon(v.starter), class: classLabel(v.klasse), from, to })
  return state.value.startNrMode === 'klasse' ? `${text} ${t('starters.moveToClassNumber')}` : text
})

function verschiebe() {
  const v = verschieben.value
  if (!v || verschiebenGesperrt.value) return
  const vorher = state.value
  dispatch({ type: 'MOVE_STARTER_TO_CLASS', id: v.starter.id, klasse: v.klasse, geburtsdatum: v.geburtsdatum })
  if (state.value === vorher) return
  const neu = state.value.starters.find((p) => p.id === v.starter.id)
  meldungenWeg()
  woanders.value = neu?.startNr
    ? t('starters.movedToNr', { name: nameVon(v.starter), class: classLabel(v.klasse), nr: neu.startNr })
    : t('starters.movedTo', { name: nameVon(v.starter), class: classLabel(v.klasse) })
  emit('oeffne', v.klasse)
}

/** Von Hand hinzugefügt – auf Wunsch in der Klasse, in die der Jahrgang gehört („In Klasse X anlegen“). */
function hinzu(p: Starter) {
  meldungenWeg()
  dispatch({ type: 'ADD_STARTERS', starters: [p] })
  if (p.klasse === props.classId) return
  woanders.value = t('starters.addedIn', { name: nameVon(p), class: classLabel(p.klasse) })
  emit('oeffne', p.klasse)
}

// Geschlecht, freiwillig: Die Spalte steht nur da, wo sie gebraucht wird – unter einem Regelwerk
// mit der Liste je Team nach Regel 960, Pkt. 3.7 („Sex“), oder wenn schon jemand eines trägt.
const mitGeschlecht = computed(() => parallel.value || state.value.starters.some((p) => p.geschlecht !== undefined))
function setzeGeschlecht(id: string, e: Event) {
  const wert = (e.target as HTMLSelectElement).value
  dispatch({ type: 'UPDATE_STARTER', id, patch: { geschlecht: istGeschlecht(wert) ? wert : undefined } })
}

// Sobald Ergebnisse erfasst sind, steht das Starterfeld fest: Hinzufügen, Entfernen und
// „Klasse leeren“ gehen nicht mehr (der Reducer lehnt sie ebenfalls ab). Warum und wie sich
// das lösen lässt, steht über den Klassen (components/StarterSperre.vue).
const fest = computed(() => starterfeldFest(state.value))
watch(fest, (f) => {
  if (f) showAdd.value = false
})

/**
 * Vor dem ersten Ergebnis genügt ein Klick. Danach lässt sich ein Starter nicht mehr entfernen
 * (die gedruckten Wettkampfrichter-Listen enthalten seine Zeile) – das × sagt dann, warum, und
 * bietet an, ihn in jedem Lauf als „nicht gestartet“ einzutragen (lib/abmeldung.ts). Wer so
 * abgemeldet ist, hat statt des × den Weg zurück.
 */
const konfig = useKonfig({ oberflaeche: true })
const abgemeldet = computed(() => new Set(state.value.abgemeldet))
const frage = ref<{ starter: Starter; art: 'abmelden' | 'anmelden' } | null>(null)
const frageWer = computed(() => {
  const p = frage.value?.starter
  return p ? [p.startNr, [p.vorname, p.nachname].filter(Boolean).join(' ')].filter(Boolean).join(' · ') : ''
})
const plan = computed(() => (frage.value ? abmeldePlan(state.value, konfig.value, frage.value.starter) : null))
/** Die Läufe, aus denen das Zurücknehmen das X entfernt – die des Manövrierens; die Runden des Parallelslaloms stehen daneben. */
const zurueck = computed(() => (frage.value ? abmeldeZellen(state.value.eingaben, konfig.value, frage.value.starter) : []))
const zurueckLaeufe = computed(() => zurueck.value.filter((z) => !zerlegeAttempt(z.lauf)).map((z) => zerlegeLauf(z.lauf).lauf).sort((a, b) => a - b))
const rundenText = (runden: readonly string[]) => [...new Set(runden)].map((r) => rundenName(r as Parameters<typeof rundenName>[0], t)).join(', ')
const zurueckRunden = computed(() => rundenText(zurueck.value.flatMap((z) => zerlegeAttempt(z.lauf)?.runde ?? [])))
/** Parallelslalom: die Runden, in denen das Abmelden das X in leere Attempts setzt (lib/abmeldung.ts). */
const planRunden = computed(() => (frage.value ? rundenText(abmeldeAttempts(state.value, konfig.value, frage.value.starter).map((a) => a.runde)) : ''))
const liste = (laeufe: readonly number[]) => laeufe.join(', ')

function remove(p: Starter) {
  if (!fest.value) dispatch({ type: 'REMOVE_STARTER', id: p.id })
  else frage.value = { starter: p, art: abgemeldet.value.has(p.id) ? 'anmelden' : 'abmelden' }
}

function bestaetige() {
  const f = frage.value
  if (!f) return
  dispatch({ type: f.art === 'abmelden' ? 'ABMELDEN_STARTER' : 'ANMELDEN_STARTER', id: f.starter.id })
  frage.value = null
}
// Lösen sich die Voraussetzungen unter dem Dialog auf (anderes Fenster, Werte gelöscht), geht er zu.
watch([fest, () => props.starters], () => {
  if (frage.value && (!fest.value || !props.starters.some((p) => p.id === frage.value!.starter.id))) frage.value = null
})

function clearAll() {
  if (fest.value) return
  if (confirm(t('starters.clearConfirm', { n: props.starters.length, name: classLabel(props.classId) }) + verlustText(state.value, props.starters))) {
    dispatch({ type: 'CLEAR_CLASS', klasse: props.classId })
  }
}

// Auswahl für die Pokalauswertung, je Klasse: Das Kästchen im Spaltenkopf schaltet alle/keine
// (halb gesetzt, wenn nur einige zählen), „umkehren“ dreht die Markierung jedes Starters um.
// Das geht auch bei festem Starterfeld – die Auswahl ändert es nicht.
const pokalZaehlen = computed(() => props.starters.filter((p) => p.pokal !== false).length)
const ids = () => props.starters.map((p) => p.id)

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
        <span class="class-badge" :style="{ background: def.color }">{{ classBadge(classId) }}</span>
        <span class="title">{{ classLabel(classId) }}</span>
        <span class="count">{{ classLine }}</span>
        <span v-if="ohneDatum > 0" class="missing-badge" data-hinweis="ohne-datum">{{ tn('starters.birthdateMissingCount', ohneDatum) }}</span>
        <span v-if="geburtstagZahl('warnung') > 0" class="geburtstag-badge geburtstag-badge--warnung" data-hinweis="geburtstag-warnung-zahl">{{ tn('starters.geburtstag.badgeWarnung', geburtstagZahl('warnung')) }}</span>
        <span v-if="geburtstagZahl('hinweis') > 0" class="geburtstag-badge" data-hinweis="geburtstag-zahl">{{ tn('starters.geburtstag.badge', geburtstagZahl('hinweis')) }}</span>
        <span class="chevron">{{ open ? '▾' : '▸' }}</span>
      </button>
      <div class="class-tools">
        <button v-if="unsorted" class="btn sm primary" :title="t('starters.sortTitle')" @click="sortNow">
          ⇅ {{ t('starters.sort') }}
        </button>
        <button class="btn sm" data-action="starter-neu" :disabled="fest" :title="fest ? t('lock.short') : undefined" @click="showAdd = !showAdd">+ {{ t('starters.manual') }}</button>
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
          :class="['btn', 'sm', kopfKlickbar ? 'primary' : '']"
          data-action="sortierung"
          :disabled="starters.length < 2 || verzahnungFest"
          :aria-pressed="kopfKlickbar"
          :title="verzahnungFest ? t('starters.order.locked') : t('starters.order.changeTitle')"
          @click="schalteSortieren"
        >
          ↕ {{ t('starters.order.change') }}
        </button>
        <button
          v-if="kopfKlickbar"
          class="btn sm"
          data-action="zufall"
          :disabled="unsorted"
          :title="unsorted ? t('starters.order.unsorted') : t('starters.order.randomTitle')"
          @click="mischen"
        >
          {{ t('starters.order.random') }}
        </button>
        <button
          v-if="pokalAuswahl"
          class="btn sm"
          data-action="pokal-umkehren-klasse"
          :disabled="starters.length === 0"
          :title="t('cup.select.invertTitle')"
          @click="dispatch({ type: 'INVERT_POKAL_ZAEHLT', ids: ids() })"
        >
          {{ t('cup.select.invertClass') }}
        </button>
        <button class="btn sm danger" data-action="klasse-leeren" :disabled="starters.length === 0 || fest" :title="fest ? t('lock.short') : undefined" @click="clearAll">
          {{ t('starters.clear') }}
        </button>
      </div>
    </div>

    <ManualAddForm v-if="showAdd && !fest" :class-id="classId" @add="hinzu" @done="showAdd = false" />

    <p v-if="edit && hasDuplicates" class="boat-banner warn" role="alert">{{ t('starters.duplicateBlock') }}</p>
    <div v-if="jahrFehler" class="boat-banner warn" role="alert" data-hinweis="jahrgang-falsch">
      {{ jahrFehler }}
      <div v-if="verschieben" class="jahrgang-vorschlag">
        <button
          type="button"
          class="btn sm primary"
          data-action="in-klasse-verschieben"
          :data-klasse="verschieben.klasse"
          :disabled="!!verschiebenGesperrt"
          :title="verschiebenGesperrt || verschiebenTitel"
          @click="verschiebe"
        >
          {{ t('starters.moveToClass', { class: classLabel(verschieben.klasse) }) }}
        </button>
        <span v-if="verschiebenGesperrt" class="note" data-hinweis="verschieben-gesperrt">
          {{ verschiebenGesperrt }}
          <a v-if="klasseFest(state)" :href="adresse('verzahnung')">{{ t('nav.verzahnung') }}</a>
        </span>
      </div>
    </div>
    <p v-if="woanders" class="boat-banner ok" role="status" data-hinweis="in-anderer-klasse">{{ woanders }}</p>
    <!-- Nur Warnung bzw. Hinweis (24.11.2026, zwei Stufen 26.11.2026): kein role="alert", kein Knopf – wer sie liest und den Starter lässt, muss nichts tun. -->
    <div v-if="open && geburtstag.length > 0" class="geburtstag-hinweise" data-hinweis="geburtstag">
      <div v-if="geburtstagWarnungen.length > 0" class="geburtstag-hinweis geburtstag-hinweis--warnung" data-stufe="warnung">
        <strong>{{ t('starters.geburtstag.titelWarnung') }}</strong>
        <ul>
          <li v-for="h in geburtstagWarnungen" :key="`${h.starter.id}|${h.art}`" :data-starter="h.starter.id" :data-art="h.art" data-stufe="warnung">{{ geburtstagText(h) }}</li>
        </ul>
      </div>
      <div v-if="geburtstagHinweiseNur.length > 0" class="geburtstag-hinweis" data-stufe="hinweis">
        <strong>{{ t('starters.geburtstag.titel') }}</strong>
        <ul>
          <li v-for="h in geburtstagHinweiseNur" :key="`${h.starter.id}|${h.art}`" :data-starter="h.starter.id" :data-art="h.art" data-stufe="hinweis">{{ geburtstagText(h) }}</li>
        </ul>
      </div>
      <p v-if="ohneEventDatum" class="note" data-hinweis="geburtstag-ohne-datum">
        {{ t('starters.geburtstag.ohneTag', { hinweis: tn('starters.geburtstag.tage', GEBURTSTAG_FENSTER.hinweisTage) }) }}
        <a :href="adresse('veranstaltung')">{{ t('nav.veranstaltung') }}</a>
      </p>
      <p v-else class="note" data-hinweis="geburtstag-tag">{{ geburtstagTagText }}</p>
    </div>

    <template v-if="open">
      <div v-if="starters.length === 0" class="empty">{{ t('starters.empty') }}</div>
      <!-- In schmalen Fenstern rollt die Tabelle in sich, nicht die Seite. -->
      <div v-else class="starters-rahmen">
      <table class="starters">
        <thead>
          <tr>
            <!-- Die Auswahl steht vorn: In schmalen Fenstern rollt die Tabelle in ihrem Rahmen,
                 und das Kästchen soll ohne Rollen zu erreichen sein. -->
            <th v-if="pokalAuswahl" class="cup-spalte" :title="t('cup.select.columnTitle')">
              <label>
                <input
                  type="checkbox"
                  data-feld="pokal-klasse"
                  :checked="pokalZaehlen === starters.length"
                  :indeterminate="pokalZaehlen > 0 && pokalZaehlen < starters.length"
                  :aria-label="t('cup.select.allClass', { name: classLabel(classId) })"
                  @change="dispatch({ type: 'SET_POKAL_ZAEHLT', ids: ids(), zaehlt: ($event.target as HTMLInputElement).checked })"
                />
                {{ t('cup.select.column') }}
              </label>
            </th>
            <th :style="{ width: edit ? '150px' : '64px' }">
              {{ t('common.startNr') }}
            </th>
            <!-- Dieselben Spalten in derselben Folge wie die Zellen darunter (lib/reihenfolge.ts sortierSpalten). -->
            <th
              v-for="s in spalten"
              :key="s"
              :class="kopfKlickbar && aktiv?.spalte === s ? 'sortier-aktiv' : undefined"
              :style="BREITE[s] ? { width: BREITE[s] } : undefined"
              :data-spalte="s"
              :aria-sort="ariaSort(s)"
            >
              <button
                v-if="kopfKlickbar"
                type="button"
                :class="['sortier-kopf', aktiv?.spalte === s ? 'aktiv' : '']"
                :data-sortier="s"
                :aria-pressed="aktiv?.spalte === s"
                :disabled="unsorted"
                :title="kopfTitel(s)"
                @click="sortiere(s)"
              >
                {{ t(spaltenText(s, state.originMode)) }}<span :class="['sortier-pfeil', aktiv?.spalte === s ? 'aktiv' : '']" aria-hidden="true">{{ pfeil(s) }}</span>
              </button>
              <template v-else>{{ t(spaltenText(s, state.originMode)) }}</template>
            </th>
            <th style="width: 40px" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(p, i) in shown"
            :key="p.id"
            :class="{ 'cup-zaehlt-nicht': pokalAuswahl && p.pokal === false, 'starter-abgemeldet': abgemeldet.has(p.id) }"
            :data-abgemeldet="abgemeldet.has(p.id) ? '' : undefined"
          >
            <td v-if="pokalAuswahl" class="cup-spalte">
              <input
                type="checkbox"
                data-feld="pokal-zaehlt"
                :checked="p.pokal !== false"
                :aria-label="t('cup.select.counts', { name: [p.vorname, p.nachname].filter(Boolean).join(' ') || p.startNr })"
                @change="dispatch({ type: 'SET_POKAL_ZAEHLT', ids: [p.id], zaehlt: ($event.target as HTMLInputElement).checked })"
              />
            </td>
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
                      :disabled="verzahnungFest || unsorted || (m.top ? i === 0 : i === starters.length - 1)"
                      :title="verzahnungFest ? t('starters.order.locked') : t(`starters.move.${m.target}`)"
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
                <!-- Die Flagge vor dem Feld zeigt beim Tippen, ob die Angabe als Bundesland oder Staat erkannt ist. -->
                <span class="herkunft-feld">
                  <HerkunftText v-if="flagge(p).flagge" :anzeige="flagge(p)" />
                  <input
                    class="cell-input"
                    :value="p[originField(state.originMode)] ?? ''"
                    :aria-label="t(originLabelKey(state.originMode))"
                    @change="update(p.id, originField(state.originMode), $event)"
                  />
                </span>
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
              <td v-if="mitGeschlecht">
                <!-- Freiwillig (Regel 960, Pkt. 3.7 „Sex“): gespeichert M, F, D, nA (keine Angabe); leer = nicht erfasst.
                     Das Kürzel folgt der Sprache der Oberfläche: deutsch M, W, D, k. A. – englisch M, F, D, n/a. -->
                <select class="size-select" data-feld="geschlecht" :value="p.geschlecht ?? ''" :aria-label="t('starters.sex')" :title="t('starters.sexHint')" @change="setzeGeschlecht(p.id, $event)">
                  <option value="">–</option>
                  <option v-for="g in GESCHLECHTER" :key="g" :value="g" :title="t(`starters.sex.${g}`)">{{ geschlechtKuerzel(g, locale) }}</option>
                </select>
              </td>
              <td :class="geburtstagZelle(p)" :title="geburtstagTitel(p)">
                <!-- Eigenes Textfeld mit festem Muster – nie die Datumswahl des Browsers (mm/dd/yyyy). -->
                <DatumFeld
                  :class="['cell-input', p.geburtsdatum ? '' : 'missing']"
                  :model-value="p.geburtsdatum"
                  :aria-label="t('common.birthdate')"
                  @update:model-value="setzeDatum(p, $event)"
                  @fehler="datumFehler(p, $event)"
                />
              </td>
            </template>
            <template v-else>
              <td :class="['num', duplicates.has(p.id) ? 'dup' : '']" :title="duplicates.has(p.id) ? t('starters.duplicate') : undefined">
                {{ p.startNr || '–' }}
              </td>
              <td>
                {{ p.nachname }}
                <span v-if="abgemeldet.has(p.id)" class="abgemeldet-marke">{{ t('starters.withdraw.mark') }}</span>
              </td>
              <td>{{ p.vorname }}</td>
              <td v-if="state.originMode !== 'none'"><HerkunftText :anzeige="herkunftAnzeige(originOf(p, state.originMode), state.originMode, 'flagge-lang', {}, locale, true)" /></td>
              <td>{{ p.groesse || '–' }}</td>
              <td v-if="mitGeschlecht" data-spalte="geschlecht">{{ p.geschlecht ? geschlechtKuerzel(p.geschlecht, locale) : '–' }}</td>
              <td :class="p.geburtsdatum ? geburtstagZelle(p) : 'cell-missing'" :title="geburtstagTitel(p)">{{ p.geburtsdatum ? formatDate(p.geburtsdatum) : t('starters.birthdateMissing') }}<span v-if="geburtstagStufe.has(p.id)" :class="['geburtstag-marke', `geburtstag-marke--${geburtstagStufe.get(p.id)}`]" data-teil="geburtstag-marke" :data-stufe="geburtstagStufe.get(p.id)" aria-hidden="true">!</span></td>
            </template>
            <td>
              <button
                v-if="fest && abgemeldet.has(p.id)"
                class="del zurueck"
                data-action="starter-anmelden"
                :title="t('starters.reinstate.confirm')"
                :aria-label="t('starters.reinstate.confirm')"
                @click="remove(p)"
              >
                ↺
              </button>
              <button
                v-else
                class="del"
                data-action="starter-entfernen"
                :title="fest ? t('starters.withdraw.title') : t('common.remove')"
                :aria-label="t('common.remove')"
                :aria-haspopup="fest ? 'dialog' : undefined"
                @click="remove(p)"
              >
                ×
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </template>

    <AppDialog v-if="frage && plan && frage.art === 'abmelden'" :titel="t('starters.withdraw.heading', { who: frageWer })" data-dialog="abmelden" @abbrechen="frage = null">
      <p>{{ t('starters.withdraw.why') }}</p>
      <template v-if="plan.ziel">
        <p>
          {{ tn('starters.withdraw.offer', state.laufCount, { column: plan.ziel.label, list: konfig.getSheetDef(plan.ziel.liste).title, dns: t('results.dns') }) }}
        </p>
        <ul class="app-dialog-liste">
          <li v-if="plan.frei.length > 0" data-plan="frei">{{ tn('starters.withdraw.free', plan.frei.length, { runs: liste(plan.frei) }) }}</li>
          <li v-if="plan.schonX.length > 0" data-plan="schon">{{ tn('starters.withdraw.already', plan.schonX.length, { runs: liste(plan.schonX) }) }}</li>
          <li v-if="planRunden" data-plan="parallel">{{ t('starters.withdraw.parallel', { rounds: planRunden }) }}</li>
          <li v-if="plan.belegt.length > 0" data-plan="belegt">
            <strong>{{ tn('starters.withdraw.kept', plan.belegt.length, { runs: liste(plan.belegt) }) }}</strong>
            {{ t('starters.withdraw.keptNote') }}
          </li>
        </ul>
        <p class="note">{{ t('starters.withdraw.undo') }}</p>
      </template>
      <p v-else class="boat-banner warn">{{ t('starters.withdraw.none') }}</p>
      <template #knoepfe>
        <button v-if="plan.ziel" type="button" class="btn primary" data-action="abmelden-bestaetigen" autofocus @click="bestaetige">{{ t('starters.withdraw.confirm') }}</button>
        <button type="button" class="btn" data-action="dialog-abbrechen" @click="frage = null">{{ t('common.cancel') }}</button>
      </template>
    </AppDialog>

    <AppDialog v-if="frage && frage.art === 'anmelden'" :titel="t('starters.reinstate.heading', { who: frageWer })" data-dialog="anmelden" @abbrechen="frage = null">
      <p v-if="zurueckLaeufe.length > 0">{{ tn('starters.reinstate.text', zurueckLaeufe.length, { runs: liste(zurueckLaeufe), dns: t('results.dns') }) }}</p>
      <p v-else-if="!zurueckRunden">{{ t('starters.reinstate.nothing', { dns: t('results.dns') }) }}</p>
      <p v-if="zurueckRunden" data-plan="parallel">{{ t('starters.reinstate.parallel', { rounds: zurueckRunden }) }}</p>
      <p class="note">{{ t('starters.reinstate.note') }}</p>
      <template #knoepfe>
        <button type="button" class="btn primary" data-action="anmelden-bestaetigen" autofocus @click="bestaetige">{{ t('starters.reinstate.confirm') }}</button>
        <button type="button" class="btn" data-action="dialog-abbrechen" @click="frage = null">{{ t('common.cancel') }}</button>
      </template>
    </AppDialog>
  </section>
</template>
