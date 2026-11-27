<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw, useId, watch } from 'vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { useEvent } from '../lib/event'
import { duplicateStartNrIds } from '../domain/startnumbers'
import { bogenFortschritt } from '../lib/erfassung'
import { gemeinsameBoegen, wkrBoegenZumStand, type WkrBogen, type WkrListen } from '../lib/wkrListen'
import { stapelBoegen } from '../lib/laufzettel'
import { leseCode, type QrFehler } from '../lib/qr'
import { meldeScan, scanBeenden, scanBogen, scanErledigt, scanStand } from '../lib/scan'
import { veranstaltungsListen } from '../lib/listen'
import { parallelBoegen, scanRundenBogen, type ParallelBoegen } from '../lib/parallelBogen'
import { RACECOURSE_PARCOURS, RACECOURSES } from '../lib/parallelSchluessel'
import { rundenName } from '../planung/parallelRunden'
import { t, tn } from '../i18n'
import { adresse } from '../lib/router'
import type { ClassId, ParallelRunde } from '../types'
import ErfassungTabelle from '../components/erfassung/ErfassungTabelle.vue'
import EingabenHinweis from '../components/EingabenHinweis.vue'
import ScanHinweis from '../components/erfassung/ScanHinweis.vue'

/**
 * Erfassung: die ausgefüllten Wettkampfrichter-Listen nach dem Lauf abtippen. Gewählt wird
 * wie bei den Listen – Parcours, Klasse, Lauf, Liste –, gezeigt wird genau der Bogen, der
 * auf dem Klemmbrett lag, mit Eingabefeldern (components/erfassung/ErfassungTabelle.vue).
 *
 * Die Bögen sind dieselben wie unter „Listen“ (lib/wkrListen.ts): gleiche Zeilen in der
 * Startreihenfolge der Verzahnung. Was eingetippt ist, hängt an Starter-ID, Lauf und Feld –
 * die Auswahl hier ist nur der Blick darauf und gehört nicht zum Stand der Veranstaltung.
 *
 * Scannen: Jeder Bogen und jeder Laufzettel trägt einen QR-Code (lib/qr.ts). Ein Handscanner
 * – er tippt wie eine Tastatur, App.vue hört in jeder Ansicht darauf – oder eine ins Feld
 * getippte Kennung wählt Parcours, Klasse, Lauf und Liste des Blatts und stellt den Cursor in
 * die erste Zelle. Ein Laufzettel führt zu seinem ganzen Blattstapel: Alle Listen der Klasse in
 * dem Lauf stehen untereinander, in der Reihenfolge des Zettels – wer den Stapel abtippt, legt
 * Blatt für Blatt um und muss am Bildschirm nichts umschalten. Dieselbe Ansicht gibt es von
 * Hand über die Auswahl der Liste („alle untereinander“).
 *
 * Parallelslalom (nur unter einem Regelwerk, das ihn kennt): Über der Auswahl steht dann die
 * Disziplin. Seine Listen gehören zu einer Runde und einem Racecourse statt zu Klasse und Lauf
 * (lib/parallelBogen.ts) – gewählt werden Racecourse und Liste. Ist oben ein Racecourse gewählt,
 * erscheint unten nichts vom anderen – weder in den Reitern noch unter „alle untereinander“
 * (Entscheidung des Nutzers vom 15.11.2026). Der Laufzettel einer Runde gilt einem Racecourse
 * und führt zu dessen drei Listen untereinander. Listen gibt es erst, wenn der Plan der Runde
 * festgeschrieben ist.
 */
const { state } = useStore()
const konfig = useKonfig({ oberflaeche: true })
const { classLabel, parallel } = useEvent()
const id = useId()

/**
 * Die Bögen hängen an Startern, Verzahnung und Aufbau – nicht an den Eingaben. Jeder
 * Tastendruck ersetzt aber den Stand als Ganzes; ohne dieses Merken liefe die Verzahnung bei
 * jeder Ziffer neu. Verglichen wird Feld für Feld: Der Reducer lässt Unverändertes stehen.
 */
let gemerkt: { stand: Record<string, unknown>; konfig: unknown; listen: WkrListen; parallel: ParallelBoegen } | undefined
const beide = computed(() => {
  // Auch der Stand der Wertungslisten ändert sich mit jeder Eingabe und geht die Bögen nichts an.
  const { eingaben: _eingaben, listenStand: _listenStand, ...rest } = state.value
  const stand = rest as Record<string, unknown>
  const g = gemerkt
  if (g && g.konfig === konfig.value && Object.keys(stand).length === Object.keys(g.stand).length && Object.keys(stand).every((k) => stand[k] === g.stand[k])) return g
  gemerkt = { stand, konfig: konfig.value, listen: wkrBoegenZumStand(state.value, konfig.value), parallel: parallelBoegen(state.value, konfig.value) }
  return gemerkt
})
const listen = computed(() => beide.value.listen)
/** Die Listen des Parallelslaloms: je Runde mit festgeschriebenem Plan sechs (lib/parallelBogen.ts). */
const rundenListen = computed(() => beide.value.parallel)
const fehlend = computed(() => state.value.starters.filter((p) => p.startNr.trim() === '').length)
const doppelt = computed(() => duplicateStartNrIds(state.value.starters, state.value.startNrMode).size)

const wahl = merke<{ parcours?: string; klasse?: ClassId; lauf?: number; liste?: string; disziplin?: Disziplin; runde?: string }>('erfassung.wahl', {}, { ueberNeuladen: true })

// Die Disziplin steht nur zur Wahl, wenn nach dem Regelwerk ein Parallelslalom gefahren wird.
const DISZIPLINEN = ['manoever', 'parallel'] as const
type Disziplin = (typeof DISZIPLINEN)[number]
const imParallel = computed(() => parallel.value && wahl.value.disziplin === 'parallel')
/** Die Runde, deren Listen gezeigt werden: die gewählte, sonst die erste mit festgeschriebenem Plan. */
const runde = computed<ParallelRunde | undefined>(() => rundenListen.value.runden.find((r) => r === wahl.value.runde) ?? rundenListen.value.runden[0])
/** Die Bögen der Ansicht: die des Manövrierens – oder die der gewählten Runde des Parallelslaloms. */
const alle = computed(() => (imParallel.value ? rundenListen.value.boegen.filter((b) => b.runde?.runde === runde.value) : listen.value.boegen))
const racecourseName = (id: string) => t(id === RACECOURSE_PARCOURS.B ? 'parallel.parcoursB' : 'parallel.parcoursA')

// Jede Stufe grenzt die nächste ein; eine Wahl, die es nicht (mehr) gibt, fällt auf die erste Möglichkeit.
const parcoursListe = computed<{ id: string; name: string }[]>(() =>
  imParallel.value
    ? RACECOURSES.map((rc) => ({ id: RACECOURSE_PARCOURS[rc], name: racecourseName(RACECOURSE_PARCOURS[rc]) }))
    : state.value.parcoursList.filter((p) => alle.value.some((b) => b.parcoursId === p.id)),
)
const parcoursId = computed(() => (parcoursListe.value.some((p) => p.id === wahl.value.parcours) ? wahl.value.parcours : parcoursListe.value[0]?.id))
const amParcours = computed(() => alle.value.filter((b) => b.parcoursId === parcoursId.value))
const klassen = computed(() => [...new Set(amParcours.value.flatMap((b) => b.klassen))])
const klasse = computed(() => (wahl.value.klasse !== undefined && klassen.value.includes(wahl.value.klasse) ? wahl.value.klasse : klassen.value[0]))
// „Versuche direkt nacheinander“: Alle Versuche stehen auf einem Bogen (lib/wkrListen.ts) – es gibt nur einen Stapel.
const laeufe = computed(() => (alle.value.some((b) => (b.versuche ?? 1) > 1) ? [1] : Array.from({ length: Math.max(1, state.value.laufCount) }, (_, i) => i + 1)))
const lauf = computed(() => (wahl.value.lauf !== undefined && laeufe.value.includes(wahl.value.lauf) ? wahl.value.lauf : 1))

/** Die Bögen der Klasse in diesem Lauf; eine Liste ohne Lauf (Knoten) gibt es nur einmal – sie steht bei jedem Lauf dabei. */
const boegen = computed<WkrBogen[]>(() => {
  // In der Reihenfolge der Listen: Der Bogen ohne Lauf gehört zum letzten Lauf und stünde
  // sonst in jedem früheren Lauf hinter allen anderen, auch wenn der Aufbau ihn weiter vorn nennt.
  // Parallelslalom: die Listen des Racecourse, wie sie der Aufbau nennt – Klasse und Lauf stehen je Zeile.
  if (imParallel.value) return amParcours.value
  const listen = veranstaltungsListen(konfig.value, state.value)
  return amParcours.value
    .filter((b) => klasse.value !== undefined && b.klassen.includes(klasse.value) && (b.lauf === lauf.value || konfig.value.getSheetDef(b.typeId).showLauf === false))
    .sort((a, b) => listen.indexOf(a.typeId) - listen.indexOf(b.typeId))
})
const bogen = computed(() => boegen.value.find((b) => b.typeId === wahl.value.liste) ?? boegen.value[0])

/** Wert der Listen-Auswahl für „alle untereinander“; keine Liste heißt so (Kennungen sind Wörter). */
const ALLE = '*'
/**
 * Der Blattstapel des Laufzettels (lib/laufzettel.ts), zu dem die gewählte Klasse gehört: bei
 * gemeinsamen Bögen (Clubmeisterschaft, Meisterschaft auf Wunsch) auch die Bögen der anderen Klassen des Stapels, die Knoten nur im
 * letzten Lauf – genau die Blätter, die mit dem Zettel zur Auswertung kommen.
 */
const stapel = computed<WkrBogen[]>(() => {
  // Parallelslalom: Der Stapel ist die Runde auf dem gewählten Racecourse – seine drei Listen
  // (Laufzettel je Racecourse). Vom anderen Racecourse steht hier nichts.
  if (imParallel.value) return amParcours.value
  if (parcoursId.value === undefined || klasse.value === undefined) return []
  return stapelBoegen(alle.value, veranstaltungsListen(konfig.value, state.value), { parcoursId: parcoursId.value, klasse: klasse.value, lauf: lauf.value }, {
    jeParcours: gemeinsameBoegen(state.value).papierSparen,
  })
})
const gestapelt = computed(() => wahl.value.liste === ALLE && stapel.value.length > 0)
/** Was unter der Auswahl steht: der Stapel untereinander oder der eine gewählte Bogen. */
const gezeigt = computed<WkrBogen[]>(() => (gestapelt.value ? stapel.value : bogen.value ? [bogen.value] : []))

const titel = computed(() => {
  const jeTyp = new Map(boegen.value.map((b) => [b.typeId, b.titel]))
  // Teilen sich zwei Listen den Titel, unterscheidet sie der ausführliche Name aus dem Menü.
  const mehrfach = (text: string) => [...jeTyp.values()].filter((x) => x === text).length > 1
  return new Map([...jeTyp].map(([typeId, text]) => [typeId, mehrfach(text) ? konfig.value.getSheetDef(typeId).menuLabel : text]))
})

/** Die Bögen des Überblicks: gestapelt die des Stapels (Sprungleiste), sonst die der Klasse (Umschalter). */
const stand = computed(() => {
  const liste = gestapelt.value ? stapel.value : boegen.value
  // Im Stapel der Clubmeisterschaft kann eine Liste je Klasse einen eigenen Bogen haben.
  const mehrfach = (typeId: string) => liste.filter((b) => b.typeId === typeId).length > 1
  // Am Stand vorbei gelesen (er wird als Ganzes ersetzt): Gezählt wird bei jeder Eingabe über alle Zeilen aller Listen.
  const { eingaben, aufbau } = toRaw(state.value)
  return liste.map((b) => {
    const name = titel.value.get(b.typeId) ?? konfig.value.getSheetDef(b.typeId).menuLabel
    return {
      bogen: b,
      titel: mehrfach(b.typeId) ? `${name} – ${b.runde ? racecourseName(b.parcoursId) : b.klassen.map((k) => classLabel(k)).join(', ')}` : name,
      ...bogenFortschritt(konfig.value, eingaben, aufbau, b.auftrag),
    }
  })
})
const summe = computed(() => stand.value.reduce((s, x) => ({ erfasst: s.erfasst + x.erfasst, gesamt: s.gesamt + x.gesamt }), { erfasst: 0, gesamt: 0 }))

function setzeDisziplin(d: Disziplin) {
  // Parcours und Liste heißen in jeder Disziplin anders: Die Wahl beginnt neu.
  wahl.value = { ...wahl.value, disziplin: d, parcours: undefined, liste: undefined }
  scanBeenden()
}

function setze(feld: 'parcours' | 'klasse' | 'lauf' | 'liste' | 'runde', e: Event) {
  const wert = (e.target as HTMLSelectElement).value
  wahl.value = { ...wahl.value, [feld]: feld === 'lauf' ? Number(wert) : wert }
  // Wer selbst wählt, sieht nicht mehr das gescannte Blatt.
  scanBeenden()
}

function zeige(typeId: string) {
  wahl.value = { ...wahl.value, liste: typeId }
  scanBeenden()
}

// ---- Gestapelt: Sprungleiste ---------------------------------------------------

const abschnitt = (bogenId: string) => document.querySelector<HTMLElement>(`.eingabe-stapel [data-abschnitt="${CSS.escape(bogenId)}"]`)

/** Das nächste Bild abwarten; ohne `requestAnimationFrame` (Tests, alte Browser) eine kurze Pause. */
const bild = () => new Promise<void>((fertig) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => fertig()) : setTimeout(fertig, 16)))
let sprung = 0

/** Zu einer Liste des Stapels rollen und den Cursor in ihre erste Zelle stellen. */
async function springeZu(bogenId: string) {
  const nr = ++sprung
  sichtbar.value = new Set([...sichtbar.value, bogenId])
  await nextTick()
  const ziel = abschnitt(bogenId)
  if (!ziel) return
  ziel.scrollIntoView?.({ block: 'start' })
  ziel.querySelector<HTMLInputElement>('.erf-tabelle tbody input.erf-feld')?.focus({ preventScroll: true })
  // Den Knopf der Liste in der Sprungleiste ins Bild holen – am Telefon rollt sie quer. Nur die
  // Leiste selbst wird gerollt, nicht die Seite.
  const leiste = document.querySelector<HTMLElement>('.eingabe-sprung')
  const knopf = leiste?.querySelector<HTMLElement>(`[data-sprung="${CSS.escape(bogenId)}"]`)
  if (leiste && knopf) {
    const l = leiste.getBoundingClientRect()
    const k = knopf.getBoundingClientRect()
    if (k.left < l.left + 16) leiste.scrollLeft += k.left - l.left - 16
    else if (k.right > l.right - 16) leiste.scrollLeft += k.right - l.right + 16
  }
  // Mit dem Rollen kommen Platzhalter über dem Ziel in die Nähe des Fensters und werden zu
  // Tabellen; ihre echte Höhe weicht von der geschätzten ab (am Telefon deutlich), und das Ziel
  // rutscht. Deshalb über ein paar Bilder nachrichten, bis es unter der Sprungleiste steht –
  // es sei denn, inzwischen wurde woandershin gesprungen oder das Ziel gibt es nicht mehr.
  for (let i = 0; i < 6; i++) {
    await bild()
    await nextTick()
    if (nr !== sprung || !ziel.isConnected) return
    ziel.scrollIntoView?.({ block: 'start' })
  }
}

/**
 * Die Höhe der Kopfzeile der Anwendung, die beim Rollen stehen bleibt: Darunter hängt die
 * Sprungleiste, und so viel Abstand halten die Listen beim Anspringen. Gemessen statt
 * geschätzt – am Telefon bricht die Kopfzeile um und ist höher.
 */
const kopfHoehe = ref(0)
let kopfWaechter: ResizeObserver | undefined
function messeKopf() {
  kopfHoehe.value = Math.round(document.querySelector<HTMLElement>('.topbar')?.getBoundingClientRect().height ?? 0)
}

/**
 * Welche Listen des Stapels schon aufgebaut sind. Ein Stapel der Clubmeisterschaft hat schnell
 * tausend Zeilen; aufgebaut wird eine Tabelle deshalb erst, wenn sie in die Nähe des Fensters
 * kommt (bis dahin hält ein Platzhalter ihre ungefähre Höhe frei), und bleibt dann stehen –
 * ein Feld, in dem gerade jemand tippt, darf nicht verschwinden. Ohne den Beobachter (alte
 * Browser, Tests) ist alles sofort da.
 */
const sichtbar = ref<ReadonlySet<string>>(new Set())
let naehe: IntersectionObserver | undefined
const beobachtet = new Map<string, Element>()
function beobachte(bogenId: string, el: unknown) {
  const alt = beobachtet.get(bogenId)
  if (alt === el) return
  if (alt) naehe?.unobserve(alt)
  if (el instanceof Element) {
    beobachtet.set(bogenId, el)
    naehe?.observe(el)
  } else beobachtet.delete(bogenId)
}
const aufgebaut = (b: WkrBogen, i: number) => i === 0 || typeof IntersectionObserver !== 'function' || sichtbar.value.has(b.id)
/** Ungefähre Höhe einer noch nicht aufgebauten Liste: Kopf, Fuß und eine Zeile je Starter. */
const platz = (b: WkrBogen) => `${150 + 37 * b.auftrag.zeilen.length}px`

onMounted(() => {
  messeKopf()
  const kopf = document.querySelector('.topbar')
  if (kopf && typeof ResizeObserver === 'function') {
    kopfWaechter = new ResizeObserver(messeKopf)
    kopfWaechter.observe(kopf)
  }
  if (typeof IntersectionObserver === 'function') {
    naehe = new IntersectionObserver(
      (eintraege) => {
        const neu = eintraege.filter((e) => e.isIntersecting).map((e) => (e.target as HTMLElement).dataset.abschnitt ?? '')
        if (neu.some((bogenId) => !sichtbar.value.has(bogenId))) sichtbar.value = new Set([...sichtbar.value, ...neu])
      },
      // Eine gute Fensterhöhe voraus: Beim Rollen steht die Tabelle da, bevor sie zu sehen ist.
      { rootMargin: '800px 0px' },
    )
    for (const el of beobachtet.values()) naehe.observe(el)
  }
})
onBeforeUnmount(() => {
  kopfWaechter?.disconnect()
  naehe?.disconnect()
})

// ---- Scannen ----------------------------------------------------------------

/** Was der zuletzt gelesene Code bedeutet – gegen den Stand von jetzt. */
const scan = computed(() => {
  const s = scanStand.value
  if (!s) return null
  const k = konfig.value
  const lesung = leseCode(s.code, {
    kennung: state.value.kennung,
    regelwerk: state.value.regelwerk,
    aufbau: state.value.aufbau,
    regelwerke: k.getRegelwerke().map((r) => r.id),
    aufbauten: k.getAufbauten().map((a) => a.id),
    parcours: state.value.parcoursList.map((p) => p.id),
    listen: veranstaltungsListen(k, state.value),
    laufCount: state.value.laufCount,
    parallel: rundenListen.value.aufbau === undefined ? undefined : { aufbau: rundenListen.value.aufbau, listen: rundenListen.value.listen, runden: rundenListen.value.runden },
  })
  if (!lesung.ok) return { code: s.code, fehler: lesung.fehler as QrFehler | { art: 'bogen' }, angaben: angabenZu(lesung.fehler) }
  const { ziel } = lesung
  if (ziel.art === 'runde') {
    // Ein Blatt des Parallelslaloms: Runde und Racecourse statt Klasse und Lauf.
    const bogen = scanRundenBogen(ziel, rundenListen.value.boegen)
    const rundenTitel = rundenName(ziel.runde as ParallelRunde, t)
    if (!bogen) return { code: s.code, fehler: { art: 'bogen' as const }, angaben: { printed: rundenTitel } }
    const teile = [
      ziel.typeId ? k.getSheetDef(ziel.typeId).title : t('runsheet.title'),
      t('parallel.title'),
      rundenTitel,
      racecourseName(RACECOURSE_PARCOURS[ziel.racecourse]),
      ...(ziel.seite ? [t('scan.page', { n: ziel.seite })] : []),
    ]
    return { code: s.code, treffer: { bogen, klasse: bogen.klassen[0], genau: true }, lauf: 1, zettel: ziel.typeId === undefined, teile, runde: ziel.runde }
  }
  // Unter den Bögen des Manövrierens – gleich, welche Disziplin die Ansicht gerade zeigt.
  const treffer = scanBogen(ziel, listen.value.boegen, (typeId) => k.getSheetDef(typeId).showLauf === false)
  const klassenText = ziel.klassen.map((x) => classLabel(x)).join(', ')
  if (!treffer) return { code: s.code, fehler: { art: 'bogen' as const }, angaben: { printed: klassenText } }
  const teile = [
    ziel.typeId ? titel.value.get(ziel.typeId) ?? treffer.bogen.titel : t('runsheet.title'),
    ...(state.value.parcoursList.length > 1 ? [treffer.bogen.parcoursName] : []),
    klassenText,
    (treffer.bogen.versuche ?? 1) > 1 ? t('lists.wkr.runsTo', { n: treffer.bogen.versuche }) : t('lists.wkr.runN', { n: ziel.lauf }),
    ...(ziel.seite ? [t('scan.page', { n: ziel.seite })] : []),
  ]
  return { code: s.code, treffer, lauf: ziel.lauf, zettel: ziel.typeId === undefined, teile, runde: undefined }
})

/** Namen statt Kennungen für die Meldung: Gedrucktes und Eingestelltes. */
function angabenZu(f: QrFehler) {
  const k = konfig.value
  if (f.art === 'veranstaltung') return { own: state.value.kennung }
  if (f.art === 'regelwerk') {
    const name = (rid: string) => k.getRegelwerke().find((r) => r.id === rid)?.label ?? rid
    return { printed: f.id ? name(f.id) : f.wert, current: name(state.value.regelwerk) }
  }
  if (f.art === 'aufbau') {
    const name = (aid: string) => k.getAufbauten().find((a) => a.id === aid)?.name ?? aid
    return { printed: f.id ? name(f.id) : f.wert, current: name(state.value.aufbau) }
  }
  if (f.art === 'lauf') return { runs: state.value.laufCount }
  return {}
}

/** Zum Bogen des Codes springen und den Cursor in seine erste Zelle stellen. */
async function springe() {
  const s = scanStand.value
  if (!s || scanErledigt.nr === s.nr) return
  // Nur einmal je Scan: Wer danach selbst wählt, die Ansicht wechselt und zurückkommt, bleibt bei seiner Wahl.
  scanErledigt.nr = s.nr
  const treffer = scan.value?.treffer
  if (!treffer) return
  // Ein Laufzettel steht für den ganzen Stapel – alle seine Listen untereinander; ein Bogen für sich allein.
  const liste = scan.value!.zettel ? ALLE : treffer.bogen.typeId
  wahl.value =
    scan.value!.runde !== undefined
      ? { ...wahl.value, disziplin: 'parallel', runde: scan.value!.runde, parcours: treffer.bogen.parcoursId, liste }
      : { disziplin: 'manoever', runde: wahl.value.runde, parcours: treffer.bogen.parcoursId, klasse: treffer.klasse, lauf: scan.value!.lauf, liste }
  // Die Tabelle wird für den neuen Bogen neu aufgebaut.
  await nextTick()
  await nextTick()
  const zelle = document.querySelector<HTMLInputElement>('.erf-panel .erf-tabelle tbody input.erf-feld')
  zelle?.focus()
  // Gestapelt an den Anfang des Stapels: Die Sprungleiste und die erste Liste sollen zu sehen sein.
  if (gestapelt.value) document.querySelector('.eingabe-stapel')?.scrollIntoView?.({ block: 'start' })
  else zelle?.scrollIntoView?.({ block: 'center' })
}
watch(() => scanStand.value?.nr, springe, { immediate: true })

// Scan-Feld: Handscanner mit Klick ins Feld, getippte oder eingefügte Kennung (Enter).
const scanText = ref('')
function scanAbschicken() {
  meldeScan(scanText.value)
  // Stehen lassen, was nicht erkannt wurde – zum Berichtigen.
  if (scan.value?.treffer) scanText.value = ''
}
function scanMitTab(e: KeyboardEvent) {
  // Manche Scanner schließen mit Tab statt Enter ab.
  if (!scanText.value.trim()) return
  e.preventDefault()
  scanAbschicken()
}

/** Zur nächsten Liste, die noch nicht fertig ist – sonst einfach zur nächsten. */
function weiter() {
  if (gestapelt.value) {
    // Gestapelt gibt es keine „aktuelle“ Liste: zur ersten, die noch nicht fertig ist.
    const offen = stand.value.find((s) => s.erfasst < s.gesamt)
    if (offen) void springeZu(offen.bogen.id)
    return
  }
  const i = boegen.value.findIndex((b) => b.id === bogen.value?.id)
  const danach = [...stand.value.slice(i + 1), ...stand.value.slice(0, i)]
  const ziel = danach.find((s) => s.erfasst < s.gesamt) ?? danach[0]
  if (ziel) wahl.value = { ...wahl.value, liste: ziel.bogen.typeId }
}
</script>

<template>
  <div class="panel">
    <h2>{{ t('capture.title') }}</h2>
    <p class="hint">{{ t('capture.hint') }}</p>

    <ScanHinweis v-if="scan" :code="scan.code" :teile="scan.teile" :geaendert="scan.treffer && !scan.treffer.genau" :fehler="scan.fehler" :angaben="scan.angaben" @schliessen="scanBeenden" />

    <!-- Nur unter einem Regelwerk mit Parallelslalom: Was erfasst wird, wählt die Disziplin. -->
    <div v-if="parallel && state.starters.length > 0" class="row eingabe-disziplin">
      <div class="segmented" role="group" :aria-label="t('capture.discipline')">
        <button v-for="d in DISZIPLINEN" :key="d" type="button" :data-disziplin="d" :class="(imParallel ? 'parallel' : 'manoever') === d ? 'active' : ''" :aria-pressed="(imParallel ? 'parallel' : 'manoever') === d" @click="setzeDisziplin(d)">
          {{ t(`running.source.${d}`) }}
        </button>
      </div>
    </div>

    <p v-if="state.starters.length === 0" class="empty">{{ t('capture.empty') }}</p>
    <!-- Parallelslalom: Listen gibt es erst, wenn der Plan festgeschrieben ist – sonst stünde in der Erfassung etwas anderes als auf dem Papier. -->
    <p v-else-if="imParallel && alle.length === 0" class="boat-banner warn" role="status" data-hinweis="parallel-plan">
      {{ t('parallel.lists.needPlan') }} <a :href="adresse('verzahnung', { reiter: 'parallel' })">{{ t('nav.verzahnung') }} → {{ t('parallel.title') }}</a>
    </p>
    <p v-else-if="alle.length === 0" class="boat-banner warn" role="status">
      {{ t('capture.noSheets') }} <a :href="adresse('verzahnung')">{{ t('nav.verzahnung') }}</a>
    </p>
    <template v-else>
      <EingabenHinweis />
      <p v-if="fehlend > 0 || doppelt > 0" class="boat-banner warn" role="alert">
        <template v-if="fehlend > 0">{{ tn('lists.missingNumbers', fehlend) }} </template>
        <template v-if="doppelt > 0">{{ tn('lists.duplicateNumbers', doppelt) }} </template>
        {{ t('capture.numbersNote') }}
      </p>
      <div class="row eingabe-wahl">
        <div v-if="imParallel && rundenListen.runden.length > 1" class="field">
          <label :for="`${id}-runde`">{{ t('parallel.lists.round') }}</label>
          <select :id="`${id}-runde`" class="input" data-feld="erf-runde" :value="runde" @change="setze('runde', $event)">
            <option v-for="r in rundenListen.runden" :key="r" :value="r">{{ rundenName(r, t) }}</option>
          </select>
        </div>
        <div v-if="imParallel || state.parcoursList.length > 1" class="field">
          <label :for="`${id}-parcours`">{{ imParallel ? t('parallel.lists.racecourse') : t('lists.wkr.parcours') }}</label>
          <select :id="`${id}-parcours`" class="input" data-feld="erf-parcours" :value="parcoursId" @change="setze('parcours', $event)">
            <option v-for="p in parcoursListe" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div v-if="!imParallel" class="field">
          <label :for="`${id}-klasse`">{{ t('lists.class') }}</label>
          <select :id="`${id}-klasse`" class="input" data-feld="erf-klasse" :value="klasse" @change="setze('klasse', $event)">
            <option v-for="k in klassen" :key="k" :value="k">{{ classLabel(k) }}</option>
          </select>
        </div>
        <div v-if="!imParallel && laeufe.length > 1" class="field">
          <label :for="`${id}-lauf`">{{ t('lists.wkr.run') }}</label>
          <select :id="`${id}-lauf`" class="input" data-feld="erf-lauf" :value="lauf" @change="setze('lauf', $event)">
            <option v-for="l in laeufe" :key="l" :value="l">{{ t('lists.wkr.runN', { n: l }) }}</option>
          </select>
        </div>
        <div class="field">
          <label :for="`${id}-liste`">{{ t('lists.wkr.list') }}</label>
          <select :id="`${id}-liste`" class="input" data-feld="erf-liste" :value="gestapelt ? ALLE : bogen?.typeId" @change="setze('liste', $event)">
            <option v-for="b in boegen" :key="b.id" :value="b.typeId">{{ titel.get(b.typeId) ?? b.titel }}</option>
            <option :value="ALLE">{{ t('capture.allStacked') }}</option>
          </select>
        </div>
      </div>

      <!-- Überblick über den Lauf der Klasse: je Liste, wie viel abgetippt ist. Gestapelt steht er als Sprungleiste über den Listen. -->
      <div v-if="!gestapelt" class="eingabe-listen" role="group" :aria-label="t('capture.overview')">
        <button
          v-for="s in stand"
          :key="s.bogen.id"
          type="button"
          :class="['eingabe-chip', { aktiv: s.bogen.id === bogen?.id, fertig: s.gesamt > 0 && s.erfasst === s.gesamt }]"
          :aria-pressed="s.bogen.id === bogen?.id"
          :data-liste="s.bogen.typeId"
          @click="zeige(s.bogen.typeId)"
        >
          <span class="eingabe-chip-titel">{{ s.titel }}</span>
          <span class="eingabe-chip-zahl">{{ s.erfasst }}/{{ s.gesamt }}</span>
        </button>
      </div>
      <div class="row" style="align-items: center">
        <p class="note eingabe-summe" role="status" style="flex: 1; margin: 0">
          {{ t(gestapelt ? 'capture.sumStack' : imParallel ? 'capture.sumHeat' : 'capture.sum', { done: summe.erfasst, total: summe.gesamt, sheets: stand.length }) }}
        </p>
        <button type="button" class="btn" data-action="weiter" :disabled="gestapelt ? summe.erfasst >= summe.gesamt : stand.length < 2" @click="weiter">
          {{ t(gestapelt ? 'capture.nextOpen' : 'capture.next') }} {{ gestapelt ? '↓' : '→' }}
        </button>
      </div>
      <div class="scan-feld">
        <label :for="`${id}-scan`">{{ t('scan.label') }}</label>
        <input
          :id="`${id}-scan`"
          v-model="scanText"
          class="input"
          data-scan-feld
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          :placeholder="t('scan.placeholder')"
          @keydown.enter.prevent="scanAbschicken"
          @keydown.tab="scanMitTab"
        />
        <button type="button" class="btn" data-action="scan" :disabled="!scanText.trim()" @click="scanAbschicken">{{ t('scan.go') }}</button>
      </div>
      <p class="note">{{ t('scan.hint') }}</p>
      <p class="note">
        {{ t('capture.results') }} <a :href="adresse('listen')">{{ t('nav.listen') }}</a
        >.
      </p>
      <!-- Der Parallelslalom wird hier erfasst; gewertet wird bisher nur das Manövrieren. -->
      <p v-if="parallel" class="note" data-hinweis="parallel-wertung">{{ t('capture.parallel') }}</p>
    </template>
  </div>

  <!-- Der Blattstapel eines Laufzettels: alle Listen untereinander, darüber mitlaufend die Sprungleiste. -->
  <div v-if="gestapelt" class="eingabe-stapel" :style="{ '--kopf-hoehe': `${kopfHoehe}px` }">
    <nav class="eingabe-sprung" :aria-label="t('capture.jump')">
      <button
        v-for="s in stand"
        :key="s.bogen.id"
        type="button"
        :class="['eingabe-chip', { fertig: s.gesamt > 0 && s.erfasst === s.gesamt }]"
        :data-sprung="s.bogen.id"
        :data-liste="s.bogen.typeId"
        @click="springeZu(s.bogen.id)"
      >
        <span class="eingabe-chip-titel">{{ s.titel }}</span>
        <span class="eingabe-chip-zahl">{{ s.erfasst }}/{{ s.gesamt }}</span>
      </button>
    </nav>
    <div v-for="(b, i) in gezeigt" :key="b.id" :ref="(el) => beobachte(b.id, el)" class="panel erf-panel" :data-abschnitt="b.id">
      <ErfassungTabelle v-if="aufgebaut(b, i)" :bogen="b" />
      <div v-else class="erf-platz" :style="{ height: platz(b) }" aria-hidden="true" />
    </div>
  </div>
  <div v-else-if="bogen" class="panel erf-panel">
    <ErfassungTabelle :key="bogen.id" :bogen="bogen" />
  </div>
</template>
